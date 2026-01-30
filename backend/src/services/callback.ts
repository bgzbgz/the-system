/**
 * Fast Track Factory Callback - Callback Service
 * Spec: 008-factory-callback
 * Per contracts/callback.yaml
 *
 * Authentication, validation, and processing for Factory callbacks
 */

import { createHash, timingSafeEqual } from 'crypto';
import { Job, JobStatus, QAReport } from '../models/job';
import { CallbackLog, CallbackResult, createCallbackLog } from '../models/callbackLog';
import { transitionJob, ActorType, TransitionResult } from './stateMachine';

// ========== CONFIGURATION ==========

/**
 * Callback secret from environment variable
 * Used for X-Callback-Secret header authentication
 */
export const FACTORY_CALLBACK_SECRET = process.env.FACTORY_CALLBACK_SECRET || '';

// ========== INTERFACES ==========

/**
 * Payload sent by Factory in callback
 * Per contracts/callback.yaml
 */
export interface FactoryCallbackRequest {
  job_id: string;
  tool_id: string;
  qa_status: 'PASS' | 'FAIL';
  qa_report: QAReport;
  tool_html: string;
  timestamps?: {
    started_at?: string;
    completed_at?: string;
  };
}

/**
 * Result of payload validation
 */
export interface ValidationResult {
  valid: boolean;
  missingField?: string;
  invalidField?: string;
}

/**
 * Result of job status validation
 */
export interface JobStatusValidation {
  canProcess: boolean;
  isIdempotent: boolean;
  errorMessage?: string;
}

// ========== AUTHENTICATION ==========

/**
 * Authenticate using X-Callback-Secret header
 * Uses timing-safe comparison to prevent timing attacks
 *
 * @param providedSecret - Value from X-Callback-Secret header
 * @returns true if secret matches
 */
export function authenticateCallbackSecret(providedSecret: string): boolean {
  if (!FACTORY_CALLBACK_SECRET || !providedSecret) {
    return false;
  }

  try {
    const secretBuffer = Buffer.from(FACTORY_CALLBACK_SECRET);
    const providedBuffer = Buffer.from(providedSecret);

    // Timing-safe comparison
    if (secretBuffer.length !== providedBuffer.length) {
      return false;
    }

    return timingSafeEqual(secretBuffer, providedBuffer);
  } catch {
    return false;
  }
}

/**
 * Authenticate using X-HMAC-Signature header
 * Verifies HMAC-SHA256 signature of request body
 *
 * @param providedSignature - Value from X-HMAC-Signature header
 * @param requestBody - Raw request body string
 * @returns true if signature is valid
 */
export function authenticateHMAC(providedSignature: string, requestBody: string): boolean {
  if (!FACTORY_CALLBACK_SECRET || !providedSignature || !requestBody) {
    return false;
  }

  try {
    const expectedSignature = createHash('sha256')
      .update(FACTORY_CALLBACK_SECRET + requestBody)
      .digest('hex');

    const expectedBuffer = Buffer.from(expectedSignature);
    const providedBuffer = Buffer.from(providedSignature);

    if (expectedBuffer.length !== providedBuffer.length) {
      return false;
    }

    return timingSafeEqual(expectedBuffer, providedBuffer);
  } catch {
    return false;
  }
}

/**
 * Authenticate callback request using either method
 *
 * @param callbackSecret - Value from X-Callback-Secret header (optional)
 * @param hmacSignature - Value from X-HMAC-Signature header (optional)
 * @param requestBody - Raw request body string
 * @returns true if either authentication method succeeds
 */
export function authenticateCallback(
  callbackSecret: string | undefined,
  hmacSignature: string | undefined,
  requestBody: string
): boolean {
  // Try X-Callback-Secret first
  if (callbackSecret && authenticateCallbackSecret(callbackSecret)) {
    return true;
  }

  // Try HMAC signature
  if (hmacSignature && authenticateHMAC(hmacSignature, requestBody)) {
    return true;
  }

  return false;
}

// ========== LOGGING ==========

/**
 * Compute SHA-256 hash of request body for deduplication
 *
 * @param requestBody - Raw request body string
 * @returns Hex-encoded SHA-256 hash
 */
export function computeRequestHash(requestBody: string): string {
  return createHash('sha256').update(requestBody).digest('hex');
}

/**
 * Log a callback attempt for audit trail
 *
 * @param result - The result of callback processing
 * @param requestHash - SHA-256 hash of request body
 * @param jobId - Job ID if available
 * @param ipAddress - Source IP address
 * @param errorMessage - Error details if failed
 * @returns The created CallbackLog entry
 */
export function logCallbackAttempt(
  result: CallbackResult,
  requestHash: string,
  jobId?: string,
  ipAddress?: string,
  errorMessage?: string
): CallbackLog {
  const log = createCallbackLog(result, requestHash, jobId, ipAddress, errorMessage);

  // TODO: Save to MongoDB
  // await CallbackLogModel.create(log);

  // Log to console for now
  console.log('[Callback]', {
    callback_id: log.callback_id,
    job_id: log.job_id || 'N/A',
    result: log.result,
    error: log.error_message || 'N/A',
    timestamp: log.timestamp.toISOString()
  });

  return log;
}

// ========== VALIDATION ==========

/**
 * Validate required fields in callback payload
 *
 * @param payload - The callback payload to validate
 * @returns ValidationResult indicating validity and any missing/invalid fields
 */
export function validateRequiredFields(payload: any): ValidationResult {
  const requiredFields = ['job_id', 'tool_id', 'qa_status', 'qa_report', 'tool_html'];

  for (const field of requiredFields) {
    if (payload[field] === undefined || payload[field] === null) {
      // tool_html can be empty string for FAIL
      if (field === 'tool_html' && payload[field] === '') {
        continue;
      }
      return { valid: false, missingField: field };
    }
  }

  return { valid: true };
}

/**
 * Validate qa_status is PASS or FAIL
 *
 * @param qaStatus - The qa_status value to validate
 * @returns ValidationResult indicating validity
 */
export function validateQaStatus(qaStatus: any): ValidationResult {
  if (qaStatus !== 'PASS' && qaStatus !== 'FAIL') {
    return { valid: false, invalidField: 'qa_status' };
  }
  return { valid: true };
}

/**
 * Validate complete callback payload
 *
 * @param payload - The callback payload to validate
 * @returns ValidationResult indicating validity and any issues
 */
export function validatePayload(payload: any): ValidationResult {
  // Check required fields
  const requiredResult = validateRequiredFields(payload);
  if (!requiredResult.valid) {
    return requiredResult;
  }

  // Check qa_status enum
  const qaStatusResult = validateQaStatus(payload.qa_status);
  if (!qaStatusResult.valid) {
    return qaStatusResult;
  }

  return { valid: true };
}

// ========== JOB STATUS VALIDATION ==========

/**
 * Validate job status for callback processing
 *
 * @param job - The job to validate
 * @returns JobStatusValidation indicating if callback can be processed
 */
export function validateJobStatus(job: Job): JobStatusValidation {
  // Idempotent: already processed callbacks return 200
  if (job.status === JobStatus.READY_FOR_REVIEW || job.status === JobStatus.FACTORY_FAILED) {
    return {
      canProcess: true,
      isIdempotent: true
    };
  }

  // Normal flow: only SENT jobs can receive callbacks (spec-011 renamed SUBMITTED → SENT)
  if (job.status === JobStatus.SENT) {
    return {
      canProcess: true,
      isIdempotent: false
    };
  }

  // Invalid states (spec-011: Updated status list)
  const invalidMessages: Record<string, string> = {
    [JobStatus.DRAFT]: 'Job not yet submitted.',
    [JobStatus.FAILED_SEND]: 'Job never reached Factory.',
    [JobStatus.DEPLOY_REQUESTED]: 'Job already approved.',
    [JobStatus.DEPLOYED]: 'Job already deployed.',
    [JobStatus.REJECTED]: 'Job already rejected.',
    [JobStatus.REVISION_REQUESTED]: 'Job revision in progress.'
  };

  return {
    canProcess: false,
    isIdempotent: false,
    errorMessage: invalidMessages[job.status] || 'Job not in valid state for callback.'
  };
}

// ========== CALLBACK PROCESSING ==========

/**
 * Result from callback processing including transition result
 */
export interface CallbackProcessResult {
  job: Job;
  transitionResult: TransitionResult;
}

/**
 * Process successful callback (qa_status=PASS)
 * Updates job to READY_FOR_REVIEW status with audit logging
 * Spec: 011-status-audit-log (US2)
 *
 * @param job - The job to update
 * @param payload - The callback payload
 * @returns Updated job with transition result
 */
export async function processSuccessCallback(job: Job, payload: FactoryCallbackRequest): Promise<CallbackProcessResult> {
  // First update job fields from callback
  const updatedJob: Job = {
    ...job,
    tool_id: payload.tool_id,
    tool_html: payload.tool_html,
    qa_status: 'PASS',
    qa_report: payload.qa_report,
    callback_received_at: new Date()
  };

  // Execute transition with audit logging (SENT → READY_FOR_REVIEW)
  const transitionResult = await transitionJob(
    updatedJob,
    JobStatus.READY_FOR_REVIEW,
    ActorType.FACTORY
  );

  return {
    job: transitionResult.success ? transitionResult.job! : updatedJob,
    transitionResult
  };
}

/**
 * Process failure callback (qa_status=FAIL)
 * Updates job to FACTORY_FAILED status with audit logging
 * Spec: 011-status-audit-log (US2)
 *
 * @param job - The job to update
 * @param payload - The callback payload
 * @returns Updated job with transition result
 */
export async function processFailureCallback(job: Job, payload: FactoryCallbackRequest): Promise<CallbackProcessResult> {
  // First update job fields from callback
  const updatedJob: Job = {
    ...job,
    tool_id: payload.tool_id,
    tool_html: payload.tool_html || '',  // May be empty for failures
    qa_status: 'FAIL',
    qa_report: payload.qa_report,
    callback_received_at: new Date()
  };

  // Execute transition with audit logging (SENT → FACTORY_FAILED)
  const transitionResult = await transitionJob(
    updatedJob,
    JobStatus.FACTORY_FAILED,
    ActorType.FACTORY
  );

  return {
    job: transitionResult.success ? transitionResult.job! : updatedJob,
    transitionResult
  };
}
