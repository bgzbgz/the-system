/**
 * Callback Routes
 * Spec: 016-backend-api
 * Per contracts/callbacks.yaml
 *
 * ============================================================================
 * DEPRECATED (spec 023-route-rewiring)
 * ============================================================================
 * These callback routes were used by n8n webhooks for tool build and deploy
 * results. As of spec 023, all processing is done in-house:
 * - Tool building: toolFactory.processRequest() (spec 021)
 * - Deployment: githubService.fullDeploy() (spec 022)
 *
 * These routes are kept for backward compatibility during the transition
 * period but will be removed in a future release.
 *
 * DO NOT add new functionality to these routes.
 * ============================================================================
 *
 * Endpoints:
 * - POST /api/factory/callback - Factory callback (tool build results) [DEPRECATED]
 * - POST /api/factory/deploy-callback - Deploy callback (deployment results) [DEPRECATED]
 */

import { Router, Request, Response } from 'express';

import { JobStatus, QAFinding } from '../models/job';
import { ActorType } from '../models/auditLog';
import { validateBody } from '../middleware/validate';
import {
  factoryCallbackSchema,
  deployCallbackSchema,
  FactoryCallbackInput,
  DeployCallbackInput
} from '../schemas/callback';
import { getJob, updateJob } from '../services/jobStore';
import { transitionJob, canTransition } from '../services/stateMachine';
import logger from '../utils/logger';
import {
  sendSuccess,
  sendNotFound,
  sendValidationError,
  sendUnauthorized,
  sendInvalidTransition
} from '../utils/response';

// ========== ROUTER ==========

const router = Router();

// ========== AUTHENTICATION MIDDLEWARE (FR-013) ==========

/**
 * Validate X-Callback-Secret header
 * FR-013: Callback authentication using shared secret
 */
function authenticateCallback(req: Request, res: Response, next: Function): void {
  const secret = req.headers['x-callback-secret'];
  const expectedSecret = process.env.CALLBACK_SECRET;

  // If no secret configured, allow (development mode)
  if (!expectedSecret) {
    logger.warn('CALLBACK_SECRET not configured - skipping authentication');
    return next();
  }

  if (!secret || secret !== expectedSecret) {
    logger.warn('Invalid callback secret', {
      ip: req.ip || req.socket.remoteAddress,
      has_secret: !!secret
    });
    sendUnauthorized(res, 'Invalid callback secret');
    return;
  }

  next();
}

// ========== IDEMPOTENCY TRACKING (FR-041) ==========

// Simple in-memory idempotency tracking
// TODO: Move to Redis/MongoDB for production
const processedCallbacks = new Set<string>();

/**
 * Generate idempotency key for a callback
 */
function getIdempotencyKey(jobId: string, callbackType: string, status?: string): string {
  return `${jobId}:${callbackType}:${status || 'default'}`;
}

/**
 * Check if callback was already processed (FR-041)
 */
function isAlreadyProcessed(key: string): boolean {
  return processedCallbacks.has(key);
}

/**
 * Mark callback as processed
 */
function markProcessed(key: string): void {
  processedCallbacks.add(key);

  // Clean up old entries after 1 hour (simple cleanup)
  setTimeout(() => {
    processedCallbacks.delete(key);
  }, 3600000);
}

// ========== ROUTES ==========

/**
 * POST /api/factory/callback
 * Factory callback - receives tool build results from n8n (FR-011, FR-014)
 * DEPRECATED: Use toolFactory.processRequest() instead (spec 023)
 */
router.post('/callback',
  authenticateCallback,
  validateBody(factoryCallbackSchema),
  async (req: Request, res: Response) => {
    // DEPRECATION WARNING (spec 023-route-rewiring)
    console.warn('[DEPRECATED] /api/factory/callback route is deprecated. Use toolFactory.processRequest() instead.');
    logger.warn('Deprecated callback route hit', { route: '/api/factory/callback', deprecation: 'spec-023' });

    const payload = req.body as FactoryCallbackInput;
    const { job_id, tool_name, slug, tool_html, template_type, qa_report, status } = payload;

    try {
      // Get job
      const job = getJob(job_id);

      if (!job) {
        logger.warn('Factory callback for unknown job', { job_id });
        return sendNotFound(res, 'Job not found');
      }

      // Determine target status based on callback status and QA result
      let targetStatus: JobStatus;
      if (status === 'qa_failed' || !qa_report.passed) {
        targetStatus = JobStatus.QA_FAILED;
      } else if (status === 'escalated') {
        targetStatus = JobStatus.ESCALATED;
      } else {
        targetStatus = JobStatus.READY_FOR_REVIEW;
      }

      // Check idempotency (FR-041)
      const idempotencyKey = getIdempotencyKey(job_id, 'factory', targetStatus);
      if (isAlreadyProcessed(idempotencyKey)) {
        logger.info('Factory callback already processed (idempotent)', { job_id });
        return sendSuccess(res, {
          success: true,
          job_id,
          new_status: job.status,
          message: 'Callback already processed'
        });
      }

      // Validate transition (FR-010)
      if (!canTransition(job.status, targetStatus)) {
        logger.warn('Invalid factory callback transition', {
          job_id,
          current_status: job.status,
          target_status: targetStatus
        });
        return sendInvalidTransition(res, `Cannot transition from ${job.status} to ${targetStatus}`);
      }

      // Execute transition with audit logging (FR-015)
      const result = await transitionJob(
        job,
        targetStatus,
        ActorType.FACTORY,
        `Factory callback: ${status || 'success'}`
      );

      if (!result.success) {
        return sendInvalidTransition(res, result.error || 'Transition failed');
      }

      // Update job with tool data
      updateJob(job_id, {
        status: targetStatus,
        tool_name,
        slug,
        tool_html,
        template_type,
        qa_report: {
          score: qa_report.score,
          max_score: qa_report.max_score,
          passed: qa_report.passed,
          findings: (qa_report.findings || []) as QAFinding[]
        },
        callback_received_at: new Date()
      });

      // Mark as processed for idempotency
      markProcessed(idempotencyKey);

      logger.logOperation({
        operation: 'FACTORY_CALLBACK_PROCESSED',
        job_id,
        status: targetStatus,
        actor: 'FACTORY',
        details: {
          tool_name,
          qa_passed: qa_report.passed,
          qa_score: qa_report.score
        }
      });

      sendSuccess(res, {
        success: true,
        job_id,
        new_status: targetStatus,
        message: 'Tool received'
      });

    } catch (error) {
      logger.logError('Error processing factory callback', error as Error, { job_id });
      return res.status(500).json({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }
);

/**
 * POST /api/factory/deploy-callback
 * Deploy callback - receives deployment results from n8n (FR-012, FR-014)
 * DEPRECATED: Use githubService.fullDeploy() instead (spec 023)
 */
router.post('/deploy-callback',
  authenticateCallback,
  validateBody(deployCallbackSchema),
  async (req: Request, res: Response) => {
    // DEPRECATION WARNING (spec 023-route-rewiring)
    console.warn('[DEPRECATED] /api/factory/deploy-callback route is deprecated. Use githubService.fullDeploy() instead.');
    logger.warn('Deprecated callback route hit', { route: '/api/factory/deploy-callback', deprecation: 'spec-023' });

    const payload = req.body as DeployCallbackInput;
    const { job_id, success, deployed_url, error: deployError } = payload;

    try {
      // Get job
      const job = getJob(job_id);

      if (!job) {
        logger.warn('Deploy callback for unknown job', { job_id });
        return sendNotFound(res, 'Job not found');
      }

      // Determine target status
      const targetStatus = success ? JobStatus.DEPLOYED : JobStatus.DEPLOY_FAILED;

      // Check idempotency (FR-041)
      const idempotencyKey = getIdempotencyKey(job_id, 'deploy', targetStatus);
      if (isAlreadyProcessed(idempotencyKey)) {
        logger.info('Deploy callback already processed (idempotent)', { job_id });
        return sendSuccess(res, {
          success: true,
          job_id,
          new_status: job.status,
          message: 'Callback already processed'
        });
      }

      // Validate transition (FR-010)
      if (!canTransition(job.status, targetStatus)) {
        logger.warn('Invalid deploy callback transition', {
          job_id,
          current_status: job.status,
          target_status: targetStatus
        });
        return sendInvalidTransition(res, `Cannot transition from ${job.status} to ${targetStatus}`);
      }

      // Execute transition with audit logging (FR-015)
      const note = success
        ? `Deployed to ${deployed_url}`
        : `Deploy failed: ${deployError}`;

      const result = await transitionJob(
        job,
        targetStatus,
        ActorType.FACTORY,
        note
      );

      if (!result.success) {
        return sendInvalidTransition(res, result.error || 'Transition failed');
      }

      // Update job
      const updates: Partial<typeof job> = {
        status: targetStatus
      };

      if (success && deployed_url) {
        updates.deployed_url = deployed_url;
      }

      if (!success && deployError) {
        updates.deploy_error = deployError;
      }

      updateJob(job_id, updates);

      // Mark as processed for idempotency
      markProcessed(idempotencyKey);

      logger.logOperation({
        operation: 'DEPLOY_CALLBACK_PROCESSED',
        job_id,
        status: targetStatus,
        actor: 'FACTORY',
        details: {
          success,
          deployed_url: deployed_url || null,
          error: deployError || null
        }
      });

      sendSuccess(res, {
        success: true,
        job_id,
        new_status: targetStatus,
        message: success ? 'Tool deployed' : 'Deploy failed'
      });

    } catch (error) {
      logger.logError('Error processing deploy callback', error as Error, { job_id });
      return res.status(500).json({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }
);

export default router;
