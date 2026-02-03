/**
 * Fast Track Factory Callback - Factory Routes
 * Spec: 008-factory-callback, 012-config-secrets
 * Per contracts/callback.yaml and contracts/callback-auth.yaml
 *
 * POST /api/factory/callback - Receive tool package from Factory
 * Enhanced with config-based callback authentication per spec 012-config-secrets
 */

import { Router, Request, Response } from 'express';
import { Job, JobStatus } from '../models/job';
import { CallbackResult } from '../models/callbackLog';
import {
  authenticateCallback,
  computeRequestHash,
  logCallbackAttempt,
  validatePayload,
  validateJobStatus,
  processSuccessCallback,
  processFailureCallback,
  FactoryCallbackRequest
} from '../services/callback';
import callbackAuthMiddleware, { AuthenticatedRequest } from '../middleware/callbackAuth';
import { jobService, jobArtifactService } from '../db/supabase';

// ========== ROUTER ==========

const router = Router();

// ========== ERROR MESSAGES (Fast Track DNA - short, direct) ==========

const ERROR_MESSAGES = {
  UNAUTHORIZED: 'Unauthorized',
  MISSING_FIELD: (field: string) => `Missing required field: ${field}`,
  INVALID_FIELD: (field: string) => `Invalid field: ${field}`,
  JOB_NOT_FOUND: 'Job not found.',
  INVALID_STATE: 'Job not in valid state for callback.'
};

// ========== ROUTES ==========

/**
 * POST /api/factory/callback
 * Receive tool package from Factory
 *
 * Per spec 012-config-secrets (SR-004):
 * - Authentication MUST be verified BEFORE payload parsing
 * - callbackAuthMiddleware is applied first to enforce this
 */
router.post('/callback', callbackAuthMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  // Get raw body for hashing (auth already verified by middleware)
  const rawBody = JSON.stringify(req.body);
  const requestHash = computeRequestHash(rawBody);
  const ipAddress = req.ip || req.socket.remoteAddress;

  // Authentication already verified by callbackAuthMiddleware per spec 012-config-secrets
  // If we reach here, auth was successful (middleware returns 401 on failure)

  // Step 1: Payload Validation (auth was step 0 in middleware)
  const validationResult = validatePayload(req.body);

  if (!validationResult.valid) {
    const errorMessage = validationResult.missingField
      ? ERROR_MESSAGES.MISSING_FIELD(validationResult.missingField)
      : ERROR_MESSAGES.INVALID_FIELD(validationResult.invalidField!);

    // Log validation failure
    logCallbackAttempt(
      CallbackResult.VALIDATION_FAILED,
      requestHash,
      req.body?.job_id,
      ipAddress,
      errorMessage
    );

    return res.status(400).json({
      error: errorMessage,
      code: 'VALIDATION_FAILED'
    });
  }

  const payload = req.body as FactoryCallbackRequest & {
    status?: string;
    tool_html_base64?: string;
    revision_applied?: string;
    revision_count?: number;
    revised_at?: string;
  };

  // Step 3: Job Lookup from jobStore
  const job = await jobService.getJob(payload.job_id);

  if (!job) {
    // Log job not found
    logCallbackAttempt(
      CallbackResult.JOB_NOT_FOUND,
      requestHash,
      payload.job_id,
      ipAddress,
      'Job not found'
    );

    return res.status(404).json({
      error: ERROR_MESSAGES.JOB_NOT_FOUND,
      code: 'JOB_NOT_FOUND'
    });
  }

  // Step 4: Handle revision_complete callback from revision workflow
  if (payload.status === 'revision_complete') {
    console.log(`[Callback] Revision complete for job ${payload.job_id}`);

    // Decode the revised tool HTML
    const revisedHtml = payload.tool_html_base64
      ? Buffer.from(payload.tool_html_base64, 'base64').toString('utf-8')
      : undefined;

    // Save tool HTML as artifact if provided
    if (revisedHtml) {
      await jobArtifactService.saveToolHtml(payload.job_id, revisedHtml);
    }

    // Update job with revised tool metadata (without tool_html)
    const updatedJob = await jobService.updateJob(payload.job_id, {
      status: JobStatus.READY_FOR_REVIEW,
      revision_applied: payload.revision_applied,
      revision_count: payload.revision_count || (job.revision_count || 0) + 1,
      callback_received_at: new Date()
    });

    // Log success
    logCallbackAttempt(
      CallbackResult.SUCCESS,
      requestHash,
      payload.job_id,
      ipAddress,
      `Revision applied: ${payload.revision_applied}`
    );

    console.log(`[Callback] Job ${payload.job_id} revised and ready for review`);

    return res.status(200).json({
      job_id: payload.job_id,
      status: 'READY_FOR_REVIEW',
      message: 'Revision applied successfully.'
    });
  }

  // Step 5: Job Status Validation (for non-revision callbacks)
  const statusValidation = validateJobStatus(job);

  if (!statusValidation.canProcess) {
    // Log invalid state
    logCallbackAttempt(
      CallbackResult.INVALID_STATE,
      requestHash,
      payload.job_id,
      ipAddress,
      statusValidation.errorMessage
    );

    return res.status(400).json({
      error: statusValidation.errorMessage || ERROR_MESSAGES.INVALID_STATE,
      code: 'INVALID_STATE'
    });
  }

  // Step 6: Handle Idempotent Case
  if (statusValidation.isIdempotent) {
    // Already processed - return success without re-processing
    logCallbackAttempt(
      CallbackResult.SUCCESS,
      requestHash,
      payload.job_id,
      ipAddress,
      'Idempotent: already processed'
    );

    return res.status(200).json({
      job_id: job.job_id,
      status: job.status,
      message: 'Tool received.'
    });
  }

  // Step 7: Process Callback Based on QA Status
  let processResult;

  if (payload.qa_status === 'PASS') {
    processResult = await processSuccessCallback(job, payload);
  } else {
    processResult = await processFailureCallback(job, payload);
  }

  const updatedJob = processResult.job;

  // Save tool_html as artifact if present
  if (updatedJob.tool_html) {
    await jobArtifactService.saveToolHtml(payload.job_id, updatedJob.tool_html);
  }

  // Save to jobStore (without tool_html)
  const { tool_html, ...jobWithoutHtml } = updatedJob;
  await jobService.updateJob(payload.job_id, jobWithoutHtml);

  // Log success
  logCallbackAttempt(
    CallbackResult.SUCCESS,
    requestHash,
    payload.job_id,
    ipAddress
  );

  // Return success response per contracts/callback.yaml
  return res.status(200).json({
    job_id: updatedJob.job_id,
    status: updatedJob.status,
    message: 'Tool received.'
  });
});

export default router;
