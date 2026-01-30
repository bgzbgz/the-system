/**
 * Job Status Types and Transitions
 * Spec: 017-mongodb-schema
 *
 * Per data-model.md and contracts/status-transitions.yaml
 * Defines the state machine for job lifecycle
 */

/**
 * Job lifecycle status values
 * Per spec: 11 status values with defined transitions
 */
export enum JobStatus {
  DRAFT = 'DRAFT',
  SENT = 'SENT',
  PROCESSING = 'PROCESSING',
  QA_IN_PROGRESS = 'QA_IN_PROGRESS',
  QA_FAILED = 'QA_FAILED',
  READY_FOR_REVIEW = 'READY_FOR_REVIEW',
  REVISION_REQUESTED = 'REVISION_REQUESTED',
  DEPLOYING = 'DEPLOYING',
  DEPLOYED = 'DEPLOYED',
  REJECTED = 'REJECTED',
  ESCALATED = 'ESCALATED'
}

/**
 * Valid status transitions map
 * Per contracts/status-transitions.yaml
 *
 * Key = current status
 * Value = array of valid next statuses
 */
export const VALID_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  [JobStatus.DRAFT]: [JobStatus.SENT],
  [JobStatus.SENT]: [JobStatus.PROCESSING],
  [JobStatus.PROCESSING]: [JobStatus.QA_IN_PROGRESS],
  [JobStatus.QA_IN_PROGRESS]: [JobStatus.QA_FAILED, JobStatus.READY_FOR_REVIEW, JobStatus.ESCALATED],
  [JobStatus.QA_FAILED]: [JobStatus.QA_IN_PROGRESS],
  [JobStatus.READY_FOR_REVIEW]: [JobStatus.DEPLOYING, JobStatus.REVISION_REQUESTED, JobStatus.REJECTED],
  [JobStatus.REVISION_REQUESTED]: [JobStatus.PROCESSING],
  [JobStatus.DEPLOYING]: [JobStatus.DEPLOYED, JobStatus.READY_FOR_REVIEW],
  [JobStatus.DEPLOYED]: [],
  [JobStatus.REJECTED]: [],
  [JobStatus.ESCALATED]: []
};

/**
 * Terminal statuses (no outgoing transitions)
 */
export const TERMINAL_STATUSES: JobStatus[] = [
  JobStatus.DEPLOYED,
  JobStatus.REJECTED,
  JobStatus.ESCALATED
];

/**
 * Check if a status transition is valid
 * @param from - Current status
 * @param to - Target status
 * @returns true if transition is allowed
 */
export function canTransition(from: JobStatus, to: JobStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Check if a status is terminal (no outgoing transitions)
 * @param status - Status to check
 * @returns true if terminal
 */
export function isTerminalStatus(status: JobStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

/**
 * Get valid next statuses for a given status
 * @param status - Current status
 * @returns Array of valid next statuses
 */
export function getValidNextStatuses(status: JobStatus): JobStatus[] {
  return VALID_TRANSITIONS[status] || [];
}

/**
 * Get human-readable error message for invalid transition
 * @param from - Current status
 * @param to - Attempted target status
 * @returns Error message
 */
export function getTransitionError(from: JobStatus, to: JobStatus): string {
  const validTargets = VALID_TRANSITIONS[from];

  if (!validTargets || validTargets.length === 0) {
    return `Status ${from} is terminal and cannot transition to any other status`;
  }

  return `Invalid status transition from ${from} to ${to}. Valid transitions: ${validTargets.join(', ')}`;
}

/**
 * Validate that a string is a valid JobStatus
 * @param status - String to validate
 * @returns true if valid JobStatus
 */
export function isValidJobStatus(status: string): status is JobStatus {
  return Object.values(JobStatus).includes(status as JobStatus);
}
