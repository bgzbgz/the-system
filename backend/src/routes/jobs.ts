/**
 * Jobs API Routes
 * Spec: 016-backend-api, 023-route-rewiring
 * Per contracts/jobs.yaml
 *
 * Endpoints (mounted at /api/jobs):
 * - POST /api/jobs - Create job from questionnaire (JSON body)
 * - GET /api/jobs - List jobs with filter and pagination
 * - GET /api/jobs/:jobId - Get job details
 * - GET /api/jobs/:jobId/logs - Get AI reasoning logs
 * - POST /api/jobs/:jobId/retry - Retry failed job (factory or deploy)
 * - POST /api/jobs/:jobId/approve - Approve for deployment
 * - POST /api/jobs/:jobId/reject - Reject with reason
 * - POST /api/jobs/:jobId/revise - Request revision
 *
 * Route Rewiring (spec 023):
 * - Job creation triggers toolFactory.processRequest() directly
 * - Job approval triggers githubService.fullDeploy() directly
 * - Job revision triggers toolFactory.processRequest() with revision context
 * - No n8n webhooks - all processing is in-house
 */

import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';

import {
  Job,
  JobStatus,
  CategoryType,
  createJobFromSubmission,
  jobToListItem,
  jobToDetail,
  jobToCreatedResponse
} from '../models/job';
import { validateBody, validateQuery } from '../middleware/validate';
import { jobSubmissionSchema, jobListQuerySchema, rejectJobSchema } from '../schemas/job';
import { revisionRequestSchema } from '../schemas/revision';
import { jobService, jobArtifactService } from '../db/supabase';
import { transitionJob, createInitialAuditEntry, ActorType, canTransition } from '../services/stateMachine';
import { generateUniqueSlug, slugFromFileName } from '../utils/slug';
import logger from '../utils/logger';
import {
  sendSuccess,
  sendSuccessWithMeta,
  sendCreated,
  sendNotFound,
  sendValidationError,
  sendInvalidTransition,
  sendInternalError
} from '../utils/response';

// ========== SERVICE IMPORTS (spec 023-route-rewiring) ==========

import { toolFactory } from '../services/factory/index';
import { githubService } from '../services/github';
import { aiService } from '../services/ai';
import { getLogsByJobId, getLogsByStage, AgentStage } from '../services/logStore';

// ========== ROUTER ==========

const router = Router();

// ========== ROUTES ==========

/**
 * GET /api/jobs/inbox
 * List jobs ready for review (READY_FOR_REVIEW status only)
 * Legacy endpoint - kept for backward compatibility
 */
router.get('/inbox', async (req: Request, res: Response) => {
  try {
    const inboxJobs = await jobService.getInboxJobs();
    logger.info('Inbox request', { count: inboxJobs.length });
    res.json(inboxJobs);
  } catch (error) {
    logger.logError('Error fetching inbox', error as Error);
    sendInternalError(res);
  }
});

/**
 * POST /api/jobs
 * Create a new Job from questionnaire submission (FR-001, FR-002, FR-003)
 * Spec 023: Triggers toolFactory.processRequest() directly (no n8n)
 */
router.post('/',
  validateBody(jobSubmissionSchema),
  async (req: Request, res: Response) => {
    try {
      // Pre-flight check: AI service must be configured (spec 023 EC-003)
      if (!aiService.isConfigured()) {
        return res.status(503).json({
          success: false,
          error: 'AI service not configured',
          code: 'SERVICE_UNAVAILABLE',
          details: 'Set ANTHROPIC_API_KEY environment variable'
        });
      }

      const input = req.body;

      // Generate job ID and slug
      const jobId = randomUUID();
      const baseSlug = slugFromFileName(input.file_name);
      const slug = generateUniqueSlug(baseSlug);

      // Create job from submission
      const job = createJobFromSubmission(input, jobId, slug);

      // Create initial audit entry (FR-015)
      await createInitialAuditEntry(jobId);

      // Save job to store FIRST (before async processing)
      await jobService.createJob(job);

      logger.logOperation({
        operation: 'JOB_CREATED',
        job_id: jobId,
        status: job.status,
        actor: 'SYSTEM',
        details: {
          file_name: input.file_name,
          category: input.category,
          slug
        }
      });

      // Build user request string for toolFactory
      const userRequest = buildUserRequestFromJob(input);

      // Fire-and-forget: Trigger factory processing (spec 023)
      toolFactory.processRequest({
        jobId,
        userRequest
      }).then(async (result) => {
        logger.logOperation({
          operation: 'FACTORY_COMPLETED',
          job_id: jobId,
          status: result.success ? 'success' : 'failed',
          actor: 'FACTORY',
          details: {
            status: result.status,
            revisionCount: result.revisionCount
          }
        });

        // Helper to convert QACriteria object to array of findings
        const criteriaToFindings = (criteria: Record<string, { passed: boolean; feedback: string }> | undefined) => {
          if (!criteria) return undefined;
          return Object.entries(criteria).map(([name, c]) => ({
            check: name,
            passed: c.passed,
            message: c.feedback
          }));
        };

        // Save the generated HTML and update status based on result
        if (result.success && result.toolHtml) {
          // Save HTML to artifacts table
          await jobArtifactService.saveToolHtml(jobId, result.toolHtml);

          // Update job metadata (without tool_html)
          await jobService.updateJob(jobId, {
            status: JobStatus.READY_FOR_REVIEW,
            tool_name: result.toolSpec?.name || input.file_name.replace(/\.[^/.]+$/, ''),
            qa_report: result.qaResult ? {
              passed: result.qaResult.passed,
              score: result.qaResult.score,
              max_score: 8,
              findings: criteriaToFindings(result.qaResult.criteria as unknown as Record<string, { passed: boolean; feedback: string }>)
            } : undefined
          });
          logger.logOperation({
            operation: 'STATUS_UPDATED',
            job_id: jobId,
            status: JobStatus.READY_FOR_REVIEW,
            actor: 'FACTORY'
          });
        } else if (!result.success) {
          // Mark as QA failed - but still save the tool_html so users can preview it
          if (result.toolHtml) {
            await jobArtifactService.saveToolHtml(jobId, result.toolHtml);
          }

          await jobService.updateJob(jobId, {
            status: JobStatus.QA_FAILED,
            tool_name: result.toolSpec?.name || input.file_name.replace(/\.[^/.]+$/, ''),
            qa_report: result.qaResult ? {
              passed: result.qaResult.passed,
              score: result.qaResult.score,
              max_score: 8,
              findings: criteriaToFindings(result.qaResult.criteria as unknown as Record<string, { passed: boolean; feedback: string }>)
            } : undefined,
            workflow_error: result.error?.message || 'Factory processing failed'
          });
        }
      }).catch(async (err) => {
        logger.logError('Factory processing failed', err as Error, { job_id: jobId });
        await jobService.updateJob(jobId, {
          status: JobStatus.QA_FAILED,
          workflow_error: (err as Error).message
        });
      });

      logger.logOperation({
        operation: 'FACTORY_SUBMITTED',
        job_id: jobId,
        actor: 'SYSTEM'
      });

      // Return created response immediately (fire-and-forget pattern)
      sendCreated(res, {
        success: true,
        job_id: jobId,
        status: JobStatus.PROCESSING,
        slug,
        message: 'Job created and submitted for processing'
      });

    } catch (error) {
      logger.logError('Error creating job', error as Error);
      sendInternalError(res);
    }
  }
);

/**
 * POST /api/jobs/:jobId/retry
 * Retry a failed job (spec 023)
 * - FACTORY_FAILED → triggers toolFactory.processRequest()
 * - DEPLOY_FAILED → triggers githubService.fullDeploy()
 */
router.post('/:jobId/retry', async (req: Request, res: Response) => {
  const { jobId } = req.params;

  try {
    const job = await jobService.getJob(jobId);

    if (!job) {
      return sendNotFound(res, 'Job not found');
    }

    // Determine retry type based on job status (spec 023)
    // Note: No FACTORY_FAILED status exists - use workflow_error or QA_FAILED
    const isFactoryFailed = job.workflow_error || job.status === JobStatus.QA_FAILED;
    const isDeployFailed = job.status === JobStatus.DEPLOY_FAILED;

    if (!isFactoryFailed && !isDeployFailed) {
      return sendValidationError(res, 'Job is not in a failed state. Cannot retry.');
    }

    // Pre-flight checks based on retry type (spec 023 EC-003, EC-004)
    if (isFactoryFailed && !aiService.isConfigured()) {
      return res.status(503).json({
        success: false,
        error: 'AI service not configured',
        code: 'SERVICE_UNAVAILABLE',
        details: 'Set ANTHROPIC_API_KEY environment variable'
      });
    }

    if (isDeployFailed && !githubService.isConfigured()) {
      return res.status(503).json({
        success: false,
        error: 'GitHub service not configured',
        code: 'SERVICE_UNAVAILABLE',
        details: 'Set GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO environment variables'
      });
    }

    if (isFactoryFailed) {
      // Factory retry: rebuild the tool
      const userRequest = buildUserRequestFromJob(job);

      // Update job status
      await jobService.updateJob(jobId, {
        status: JobStatus.PROCESSING,
        workflow_error: undefined
      });

      // Fire-and-forget factory processing with result handling
      toolFactory.processRequest({
        jobId,
        userRequest
      }).then(async (result) => {
        logger.logOperation({
          operation: 'FACTORY_RETRY_COMPLETED',
          job_id: jobId,
          status: result.success ? 'success' : 'failed',
          actor: 'FACTORY',
          details: {
            status: result.status,
            revisionCount: result.revisionCount
          }
        });

        // Helper to convert QACriteria object to array of findings
        const criteriaToFindings = (criteria: Record<string, { passed: boolean; feedback: string }> | undefined) => {
          if (!criteria) return undefined;
          return Object.entries(criteria).map(([name, c]) => ({
            check: name,
            passed: c.passed,
            message: c.feedback
          }));
        };

        // Save the generated HTML and update status based on result
        if (result.success && result.toolHtml) {
          // Save HTML to artifacts table
          await jobArtifactService.saveToolHtml(jobId, result.toolHtml);

          // Update job metadata (without tool_html)
          await jobService.updateJob(jobId, {
            status: JobStatus.READY_FOR_REVIEW,
            tool_name: result.toolSpec?.name || job.tool_name,
            qa_report: result.qaResult ? {
              passed: result.qaResult.passed,
              score: result.qaResult.score,
              max_score: 8,
              findings: criteriaToFindings(result.qaResult.criteria as unknown as Record<string, { passed: boolean; feedback: string }>)
            } : undefined
          });
          logger.logOperation({
            operation: 'STATUS_UPDATED',
            job_id: jobId,
            status: JobStatus.READY_FOR_REVIEW,
            actor: 'FACTORY'
          });
        } else if (!result.success) {
          // Mark as QA failed - but still save the tool_html so users can preview it
          if (result.toolHtml) {
            await jobArtifactService.saveToolHtml(jobId, result.toolHtml);
          }

          await jobService.updateJob(jobId, {
            status: JobStatus.QA_FAILED,
            tool_name: result.toolSpec?.name || job.tool_name,
            qa_report: result.qaResult ? {
              passed: result.qaResult.passed,
              score: result.qaResult.score,
              max_score: 8,
              findings: criteriaToFindings(result.qaResult.criteria as unknown as Record<string, { passed: boolean; feedback: string }>)
            } : undefined,
            workflow_error: result.error?.message || 'Factory processing failed'
          });
        }
      }).catch(async (err) => {
        logger.logError('Factory retry failed', err as Error, { job_id: jobId });
        await jobService.updateJob(jobId, {
          status: JobStatus.QA_FAILED,
          workflow_error: (err as Error).message
        });
      });

      logger.logOperation({
        operation: 'FACTORY_RETRY',
        job_id: jobId,
        actor: 'BOSS'
      });

      return sendSuccess(res, {
        success: true,
        job_id: jobId,
        status: JobStatus.PROCESSING,
        retry_type: 'factory',
        message: 'Factory processing re-triggered'
      });

    } else {
      // Deploy retry: redeploy to GitHub
      await jobService.updateJob(jobId, { status: JobStatus.DEPLOYING });

      // Fire-and-forget deployment
      githubService.fullDeploy(jobId).catch(err => {
        logger.logError('Deploy retry failed', err as Error, { job_id: jobId });
      });

      logger.logOperation({
        operation: 'DEPLOY_RETRY',
        job_id: jobId,
        actor: 'BOSS'
      });

      return sendSuccess(res, {
        success: true,
        job_id: jobId,
        status: JobStatus.DEPLOYING,
        retry_type: 'deploy',
        message: 'Deployment re-triggered'
      });
    }

  } catch (error) {
    logger.logError('Error retrying job', error as Error, { job_id: jobId });
    sendInternalError(res);
  }
});

/**
 * GET /api/jobs/:jobId
 * Get job details (FR-005)
 */
router.get('/:jobId', async (req: Request, res: Response) => {
  const { jobId } = req.params;

  try {
    // Get job with HTML from artifacts table
    const job = await jobService.getJobWithHtml(jobId);

    if (!job) {
      return sendNotFound(res, 'Job not found');
    }

    // Return full detail including questionnaire and tool_html
    sendSuccess(res, jobToDetail(job));

  } catch (error) {
    logger.logError('Error fetching job detail', error as Error, { job_id: jobId });
    sendInternalError(res);
  }
});

/**
 * GET /api/jobs/:jobId/logs
 * Get AI agent reasoning logs for a job (spec 024-agent-reasoning-logs)
 * Per contracts/logs.yaml
 */
router.get('/:jobId/logs', async (req: Request, res: Response) => {
  const { jobId } = req.params;
  const { stage } = req.query;

  try {
    // Verify job exists
    const job = await jobService.getJob(jobId);
    if (!job) {
      return sendNotFound(res, 'Job not found');
    }

    // Get logs, optionally filtered by stage
    let logs;
    if (stage && typeof stage === 'string') {
      logs = await getLogsByStage(jobId, stage as AgentStage);
    } else {
      logs = await getLogsByJobId(jobId);
    }

    // Return logs with count (spec FR-005)
    sendSuccess(res, {
      logs,
      count: logs.length
    });

  } catch (error) {
    logger.logError('Error fetching job logs', error as Error, { job_id: jobId });
    sendInternalError(res);
  }
});

/**
 * GET /api/jobs
 * List all jobs with optional status filter and pagination (FR-004)
 */
router.get('/',
  validateQuery(jobListQuerySchema),
  async (req: Request, res: Response) => {
    try {
      const query = (req as any).validatedQuery || { limit: 50, offset: 0 };
      const { status, limit, offset } = query;

      // Get jobs from Supabase with filtering and pagination
      const { jobs, total } = await jobService.listJobs({
        status,
        limit,
        offset
      });

      // Convert to list items (excludes tool_html)
      const items = jobs.map(job => jobToListItem(job));

      logger.info('Job list request', {
        status: status || 'all',
        total,
        returned: items.length
      });

      sendSuccessWithMeta(res, items, { total, limit, offset });

    } catch (error) {
      logger.logError('Error listing jobs', error as Error);
      sendInternalError(res);
    }
  }
);

// ========== BOSS ACTION ROUTES ==========

/**
 * POST /api/jobs/:jobId/approve
 * Approve a job for deployment (FR-006)
 * Spec 023: Triggers githubService.fullDeploy() directly (no n8n)
 * Transitions: READY_FOR_REVIEW → DEPLOYING
 */
router.post('/:jobId/approve', async (req: Request, res: Response) => {
  const { jobId } = req.params;

  try {
    // Pre-flight check: GitHub service must be configured (spec 023 EC-004)
    if (!githubService.isConfigured()) {
      return res.status(503).json({
        success: false,
        error: 'GitHub service not configured',
        code: 'SERVICE_UNAVAILABLE',
        details: 'Set GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO environment variables'
      });
    }

    const job = await jobService.getJob(jobId);

    if (!job) {
      return sendNotFound(res, 'Job not found');
    }

    // Validate transition is allowed (FR-010)
    if (!canTransition(job.status, JobStatus.DEPLOYING)) {
      return sendInvalidTransition(res, `Cannot approve job in ${job.status} status. Must be READY_FOR_REVIEW or QA_FAILED.`);
    }

    // Execute transition with audit logging (FR-015)
    const result = await transitionJob(
      job,
      JobStatus.DEPLOYING,
      ActorType.BOSS,
      'Approved for deployment'
    );

    if (!result.success) {
      return sendInvalidTransition(res, result.error || 'Transition failed');
    }

    // Update job in store
    await jobService.updateJob(jobId, { status: JobStatus.DEPLOYING });

    logger.logOperation({
      operation: 'DEPLOY_STARTED',
      job_id: jobId,
      status: JobStatus.DEPLOYING,
      actor: 'BOSS'
    });

    // Wait for deployment to complete (synchronous for better UX)
    const deployResult = await githubService.fullDeploy(jobId);

    logger.logOperation({
      operation: 'DEPLOY_COMPLETED',
      job_id: jobId,
      status: deployResult.success ? 'success' : 'failed',
      actor: 'GITHUB',
      details: {
        pagesUrl: deployResult.pagesUrl,
        error: deployResult.error
      }
    });

    if (!deployResult.success) {
      // Deployment failed - job is already reverted to READY_FOR_REVIEW by fullDeploy
      return res.status(500).json({
        success: false,
        error: deployResult.error || 'Deployment failed',
        code: 'DEPLOY_FAILED'
      });
    }

    // Get the updated job with deployed_url
    const updatedJob = await jobService.getJob(jobId);

    sendSuccess(res, {
      success: true,
      job_id: jobId,
      status: JobStatus.DEPLOYED,
      deployed_url: deployResult.pagesUrl,
      message: 'Tool deployed successfully',
      audit_event_id: result.auditEntry?._id,
      job: updatedJob ? jobToDetail(updatedJob) : undefined
    });

  } catch (error) {
    logger.logError('Error approving job', error as Error, { job_id: jobId });
    sendInternalError(res);
  }
});

/**
 * POST /api/jobs/:jobId/reject
 * Reject a job (FR-007)
 * Synchronous - no external service calls
 * Transitions: READY_FOR_REVIEW, QA_FAILED, ESCALATED → REJECTED
 */
router.post('/:jobId/reject',
  validateBody(rejectJobSchema),
  async (req: Request, res: Response) => {
    const { jobId } = req.params;
    const { reason } = req.body;

    try {
      const job = await jobService.getJob(jobId);

      if (!job) {
        return sendNotFound(res, 'Job not found');
      }

      // Validate transition is allowed (FR-010)
      if (!canTransition(job.status, JobStatus.REJECTED)) {
        return sendInvalidTransition(res, `Cannot reject job in ${job.status} status.`);
      }

      // Execute transition with audit logging (FR-015)
      const result = await transitionJob(
        job,
        JobStatus.REJECTED,
        ActorType.BOSS,
        reason
      );

      if (!result.success) {
        return sendInvalidTransition(res, result.error || 'Transition failed');
      }

      // Update job in store
      await jobService.updateJob(jobId, { status: JobStatus.REJECTED });

      logger.logOperation({
        operation: 'BOSS_REJECTED',
        job_id: jobId,
        status: JobStatus.REJECTED,
        actor: 'BOSS',
        details: { reason }
      });

      sendSuccess(res, {
        success: true,
        job_id: jobId,
        status: JobStatus.REJECTED,
        message: 'Job rejected',
        audit_event_id: result.auditEntry?._id
      });

    } catch (error) {
      logger.logError('Error rejecting job', error as Error, { job_id: jobId });
      sendInternalError(res);
    }
  }
);

/**
 * POST /api/jobs/:jobId/revise
 * Request revision (FR-008, FR-009)
 * Spec 023: Triggers toolFactory.processRequest() with revision context (no n8n)
 * Transitions: READY_FOR_REVIEW → PROCESSING
 */
router.post('/:jobId/revise',
  validateBody(revisionRequestSchema),
  async (req: Request, res: Response) => {
    const { jobId } = req.params;
    const { revision_notes } = req.body;

    try {
      // Pre-flight check: AI service must be configured (spec 023 EC-003)
      if (!aiService.isConfigured()) {
        return res.status(503).json({
          success: false,
          error: 'AI service not configured',
          code: 'SERVICE_UNAVAILABLE',
          details: 'Set ANTHROPIC_API_KEY environment variable'
        });
      }

      const job = await jobService.getJob(jobId);

      if (!job) {
        return sendNotFound(res, 'Job not found');
      }

      // Validate job is in READY_FOR_REVIEW or QA_FAILED (boss can revise failed tools)
      if (job.status !== JobStatus.READY_FOR_REVIEW && job.status !== JobStatus.QA_FAILED) {
        return sendInvalidTransition(res, `Cannot request revision for job in ${job.status} status. Must be READY_FOR_REVIEW or QA_FAILED.`);
      }

      // Execute transition with audit logging (FR-015)
      // Note: Transition directly to PROCESSING (spec 023 - toolFactory handles full cycle)
      const result = await transitionJob(
        job,
        JobStatus.PROCESSING,
        ActorType.BOSS,
        `Revision requested: ${revision_notes}`
      );

      if (!result.success) {
        return sendInvalidTransition(res, result.error || 'Transition failed');
      }

      // Update job in store with revision notes and new status
      await jobService.updateJob(jobId, {
        status: JobStatus.PROCESSING,
        revision_notes
      });

      // Build user request with revision context (Boss Authority Supremacy)
      const userRequest = buildUserRequestFromJob(job, revision_notes);

      // Fire-and-forget: Trigger factory processing with revision (spec 023)
      toolFactory.processRequest({
        jobId,
        userRequest
      }).then(async (factoryResult) => {
        logger.logOperation({
          operation: 'REVISION_COMPLETED',
          job_id: jobId,
          status: factoryResult.success ? 'success' : 'failed',
          actor: 'FACTORY',
          details: {
            status: factoryResult.status,
            revisionCount: factoryResult.revisionCount
          }
        });

        // Helper to convert QACriteria object to array of findings
        const criteriaToFindings = (criteria: Record<string, { passed: boolean; feedback: string }> | undefined) => {
          if (!criteria) return undefined;
          return Object.entries(criteria).map(([name, c]) => ({
            check: name,
            passed: c.passed,
            message: c.feedback
          }));
        };

        // Save the generated HTML and update status based on result
        if (factoryResult.success && factoryResult.toolHtml) {
          // Save HTML to artifacts table
          await jobArtifactService.saveToolHtml(jobId, factoryResult.toolHtml);

          // Update job metadata (without tool_html)
          await jobService.updateJob(jobId, {
            status: JobStatus.READY_FOR_REVIEW,
            tool_name: factoryResult.toolSpec?.name || job.file_name?.replace(/\.[^/.]+$/, ''),
            qa_report: factoryResult.qaResult ? {
              passed: factoryResult.qaResult.passed,
              score: factoryResult.qaResult.score,
              max_score: 8,
              findings: criteriaToFindings(factoryResult.qaResult.criteria as unknown as Record<string, { passed: boolean; feedback: string }>)
            } : undefined
          });
          logger.logOperation({
            operation: 'STATUS_UPDATED',
            job_id: jobId,
            status: JobStatus.READY_FOR_REVIEW,
            actor: 'FACTORY'
          });
        } else if (!factoryResult.success) {
          // Mark as QA failed - but still save the tool_html so users can preview it
          if (factoryResult.toolHtml) {
            await jobArtifactService.saveToolHtml(jobId, factoryResult.toolHtml);
          }

          await jobService.updateJob(jobId, {
            status: JobStatus.QA_FAILED,
            tool_name: factoryResult.toolSpec?.name || job.file_name?.replace(/\.[^/.]+$/, ''),
            qa_report: factoryResult.qaResult ? {
              passed: factoryResult.qaResult.passed,
              score: factoryResult.qaResult.score,
              max_score: 8,
              findings: criteriaToFindings(factoryResult.qaResult.criteria as unknown as Record<string, { passed: boolean; feedback: string }>)
            } : undefined,
            workflow_error: factoryResult.error?.message || 'Revision processing failed'
          });
        }
      }).catch(async (err) => {
        logger.logError('Revision processing failed', err as Error, { job_id: jobId });
        await jobService.updateJob(jobId, {
          status: JobStatus.QA_FAILED,
          workflow_error: (err as Error).message
        });
      });

      logger.logOperation({
        operation: 'REVISION_SUBMITTED',
        job_id: jobId,
        status: JobStatus.PROCESSING,
        actor: 'BOSS',
        details: { notes_length: revision_notes.length }
      });

      // Return the job in the expected format for frontend
      const updatedJob = await jobService.getJob(jobId);
      sendSuccess(res, jobToDetail(updatedJob!));

    } catch (error) {
      logger.logError('Error requesting revision', error as Error, { job_id: jobId });
      sendInternalError(res);
    }
  }
);

/**
 * POST /api/jobs/:jobId/request-revision
 * Legacy endpoint - same implementation as /revise
 */
router.post('/:jobId/request-revision',
  validateBody(revisionRequestSchema),
  async (req: Request, res: Response) => {
    const { jobId } = req.params;
    const { revision_notes } = req.body;

    try {
      // Pre-flight check
      if (!aiService.isConfigured()) {
        return res.status(503).json({
          success: false,
          error: 'AI service not configured',
          code: 'SERVICE_UNAVAILABLE'
        });
      }

      const job = await jobService.getJob(jobId);

      if (!job) {
        return sendNotFound(res, 'Job not found');
      }

      if (job.status !== JobStatus.READY_FOR_REVIEW && job.status !== JobStatus.QA_FAILED) {
        return sendInvalidTransition(res, `Cannot request revision for job in ${job.status} status. Must be READY_FOR_REVIEW or QA_FAILED.`);
      }

      const result = await transitionJob(
        job,
        JobStatus.PROCESSING,
        ActorType.BOSS,
        `Revision requested: ${revision_notes}`
      );

      if (!result.success) {
        return sendInvalidTransition(res, result.error || 'Transition failed');
      }

      await jobService.updateJob(jobId, {
        status: JobStatus.PROCESSING,
        revision_notes
      });

      // Fire-and-forget revision processing
      const userRequest = buildUserRequestFromJob(job, revision_notes);
      toolFactory.processRequest({ jobId, userRequest }).catch(err => {
        logger.logError('Revision processing failed (legacy)', err as Error, { job_id: jobId });
      });

      // Return the job in the expected format for frontend
      const updatedJob = await jobService.getJob(jobId);
      sendSuccess(res, jobToDetail(updatedJob!));

    } catch (error) {
      logger.logError('Error requesting revision (legacy)', error as Error, { job_id: jobId });
      sendInternalError(res);
    }
  }
);

// ========== CANCEL ENDPOINT ==========

/**
 * POST /api/jobs/:jobId/cancel
 * Cancel a stuck deployment or processing job
 * Transitions: DEPLOYING, PROCESSING → READY_FOR_REVIEW (if has tool_html) or QA_FAILED
 */
router.post('/:jobId/cancel', async (req: Request, res: Response) => {
  const { jobId } = req.params;

  try {
    const job = await jobService.getJob(jobId);

    if (!job) {
      return sendNotFound(res, 'Job not found');
    }

    // Only allow cancelling DEPLOYING or PROCESSING jobs
    if (job.status !== JobStatus.DEPLOYING && job.status !== JobStatus.PROCESSING) {
      return sendInvalidTransition(res, `Cannot cancel job in ${job.status} status. Only DEPLOYING or PROCESSING jobs can be cancelled.`);
    }

    // Check if job has tool_html to determine target status
    const toolHtml = await jobArtifactService.getToolHtml(jobId);
    const targetStatus = toolHtml ? JobStatus.READY_FOR_REVIEW : JobStatus.QA_FAILED;

    // Update job status
    await jobService.updateJob(jobId, {
      status: targetStatus,
      workflow_error: 'Cancelled by user'
    });

    logger.logOperation({
      operation: 'JOB_CANCELLED',
      job_id: jobId,
      status: targetStatus,
      actor: 'BOSS',
      details: { previous_status: job.status }
    });

    sendSuccess(res, {
      success: true,
      job_id: jobId,
      status: targetStatus,
      message: `Job cancelled and moved to ${targetStatus}`
    });

  } catch (error) {
    logger.logError('Error cancelling job', error as Error, { job_id: jobId });
    sendInternalError(res);
  }
});

// ========== ADMIN ENDPOINT (TEMPORARY FOR DEMO) ==========

/**
 * PATCH /api/jobs/:jobId/admin-patch
 * Directly update job fields (for demo/testing only)
 */
router.patch('/:jobId/admin-patch',
  async (req: Request, res: Response) => {
    try {
      const { jobId } = req.params;
      const updates = req.body;

      const job = await jobService.getJob(jobId);
      if (!job) {
        return sendNotFound(res, 'Job not found');
      }

      // Extract tool_html if present
      const { tool_html, ...jobUpdates } = updates;

      // Save tool_html to artifacts if provided
      if (tool_html !== undefined) {
        await jobArtifactService.saveToolHtml(jobId, tool_html);
      }

      // Allow direct updates for demo purposes
      await jobService.updateJob(jobId, {
        ...jobUpdates,
        updated_at: new Date()
      });

      console.log(`[Admin] Patched job ${jobId}:`, Object.keys(updates));

      sendSuccess(res, {
        success: true,
        job_id: jobId,
        updated_fields: Object.keys(updates)
      });
    } catch (error) {
      logger.logError('Error in admin patch', error as Error);
      sendInternalError(res);
    }
  }
);

// ========== HELPER FUNCTIONS ==========

/**
 * Build user request string for toolFactory from job data
 * Per spec 021: Natural language description of the tool to build
 */
function buildUserRequestFromJob(job: any, revisionNotes?: string): string {
  const parts = [
    `Create a decision tool for: ${job.file_name || 'Tool'}`,
    `Category: ${job.category}`,
    `Decision to make: ${job.decision}`,
    `Teaching point: ${job.teaching_point}`,
    `User inputs: ${job.inputs}`,
    `Verdict criteria: ${job.verdict_criteria}`
  ];

  if (job.file_content) {
    parts.push(`Source content:\n${job.file_content}`);
  }

  if (revisionNotes) {
    // Boss Authority Supremacy: Revision notes override everything
    parts.unshift(`BOSS REVISION REQUEST (HIGHEST PRIORITY): ${revisionNotes}`);
  }

  return parts.join('\n\n');
}

export default router;
