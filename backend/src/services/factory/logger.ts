/**
 * Tool Factory Engine - Pipeline Logger
 * Spec: 021-tool-factory-engine (FR-006)
 *
 * Structured logging for pipeline lifecycle events.
 * All logs include jobId for traceability.
 */

import { PipelineContext, StageName, StageOutput } from './types';

// ========== PIPELINE LIFECYCLE ==========

/**
 * Log pipeline start
 *
 * @param context - Pipeline context
 * @param userRequest - First 100 chars of user request for context
 */
export function logPipelineStart(context: PipelineContext, userRequest: string): void {
  const preview = userRequest.length > 100
    ? userRequest.slice(0, 100) + '...'
    : userRequest;

  console.log(`[Factory] Pipeline start: ${context.jobId} (request: "${preview}")`);
}

/**
 * Log pipeline completion
 *
 * @param context - Pipeline context
 * @param success - Whether pipeline succeeded
 */
export function logPipelineComplete(context: PipelineContext, success: boolean): void {
  const elapsed = Date.now() - context.startTime.getTime();
  const status = success ? 'success' : 'failed';

  console.log(
    `[Factory] Pipeline complete: ${context.jobId} (${elapsed}ms, ${status}, revisions: ${context.revisionCount})`
  );
}

/**
 * Log pipeline needs clarification
 *
 * @param context - Pipeline context
 * @param questionCount - Number of clarification questions
 */
export function logPipelineClarification(context: PipelineContext, questionCount: number): void {
  const elapsed = Date.now() - context.startTime.getTime();

  console.log(
    `[Factory] Pipeline needs clarification: ${context.jobId} (${elapsed}ms, ${questionCount} questions)`
  );
}

// ========== STAGE LIFECYCLE ==========

/**
 * Log stage start
 *
 * @param context - Pipeline context
 * @param stage - Stage name
 */
export function logStageStart(context: PipelineContext, stage: StageName): void {
  console.log(`[Factory] Stage start: ${stage} (job: ${context.jobId})`);
}

/**
 * Log stage completion with timing
 *
 * @param context - Pipeline context
 * @param stage - Stage name
 * @param output - Stage output (for summary logging)
 * @param durationMs - Stage duration in milliseconds
 */
export function logStageComplete(
  context: PipelineContext,
  stage: StageName,
  output: StageOutput,
  durationMs: number
): void {
  let summary = '';

  // Add stage-specific summary info
  switch (stage) {
    case 'secretary':
      if ('type' in output) {
        summary = output.type === 'spec' ? 'extracted spec' : 'needs clarification';
      }
      break;
    case 'toolBuilder':
      if ('html' in output) {
        summary = `generated ${output.html.length} bytes`;
      }
      break;
    case 'templateDecider':
      if ('decision' in output) {
        summary = `selected ${output.decision.template}`;
      }
      break;
    case 'qaDepartment':
      if ('result' in output) {
        summary = output.result.passed
          ? `PASS (${output.result.score}/8)`
          : `FAIL (${output.result.score}/8, ${output.result.mustFix.length} issues)`;
      }
      break;
    case 'feedbackApplier':
      if ('html' in output) {
        summary = `revised ${output.html.length} bytes`;
      }
      break;
  }

  console.log(
    `[Factory] Stage complete: ${stage} (${durationMs}ms${summary ? ', ' + summary : ''}) (job: ${context.jobId})`
  );
}

/**
 * Log stage failure
 *
 * @param context - Pipeline context
 * @param stage - Stage name
 * @param error - Error that occurred
 */
export function logStageFailed(context: PipelineContext, stage: StageName, error: Error): void {
  console.error(
    `[Factory] Stage failed: ${stage} (job: ${context.jobId}) - ${error.message}`
  );

  // Log stack trace at debug level
  if (process.env.DEBUG === 'true' && error.stack) {
    console.error(`[Factory] Stack trace: ${error.stack}`);
  }
}

// ========== QA LOOP ==========

/**
 * Log QA iteration
 *
 * @param context - Pipeline context
 * @param iteration - Current iteration number (1-based)
 * @param passed - Whether QA passed
 * @param score - QA score (0-8)
 */
export function logQAIteration(
  context: PipelineContext,
  iteration: number,
  passed: boolean,
  score: number
): void {
  const status = passed ? 'PASS' : 'FAIL';
  console.log(
    `[Factory] QA iteration ${iteration}: ${status} (score: ${score}/8) (job: ${context.jobId})`
  );
}

/**
 * Log revision attempt
 *
 * @param context - Pipeline context
 * @param issueCount - Number of issues to fix
 */
export function logRevisionAttempt(context: PipelineContext, issueCount: number): void {
  console.log(
    `[Factory] Revision attempt ${context.revisionCount + 1}/${context.maxRevisions} (${issueCount} issues) (job: ${context.jobId})`
  );
}

// ========== ERROR HANDLING ==========

/**
 * Log transient error with retry info
 *
 * @param context - Pipeline context
 * @param stage - Stage where error occurred
 * @param attempt - Current attempt number
 * @param maxAttempts - Maximum attempts
 * @param error - Error that occurred
 */
export function logRetryAttempt(
  context: PipelineContext,
  stage: StageName,
  attempt: number,
  maxAttempts: number,
  error: Error
): void {
  console.warn(
    `[Factory] Retry ${attempt}/${maxAttempts} for ${stage} (job: ${context.jobId}) - ${error.message}`
  );
}

/**
 * Log validation error
 *
 * @param jobId - Job identifier
 * @param field - Field that failed validation
 * @param message - Validation error message
 */
export function logValidationError(jobId: string, field: string, message: string): void {
  console.error(`[Factory] Validation error (job: ${jobId}): ${field} - ${message}`);
}
