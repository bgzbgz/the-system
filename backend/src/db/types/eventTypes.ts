/**
 * Audit Event Types
 * Spec: 017-mongodb-schema
 *
 * Per data-model.md Event Types table
 * Constants for all audit log event types
 */

/**
 * Audit log event type constants
 * Per data-model.md: Standard event types for audit trail
 */
export const EventTypes = {
  // Job lifecycle events
  JOB_CREATED: 'job.created',
  STATUS_CHANGED: 'status.changed',

  // QA events
  QA_STARTED: 'qa.started',
  QA_PASSED: 'qa.passed',
  QA_FAILED: 'qa.failed',

  // Revision events
  REVISION_REQUESTED: 'revision.requested',
  REVISION_COMPLETED: 'revision.completed',

  // Deployment events
  DEPLOYMENT_STARTED: 'deployment.started',
  DEPLOYMENT_COMPLETED: 'deployment.completed',
  DEPLOYMENT_FAILED: 'deployment.failed',

  // Boss actions
  JOB_REJECTED: 'job.rejected',
  JOB_ESCALATED: 'job.escalated'
} as const;

/**
 * Event type union type
 */
export type EventType = typeof EventTypes[keyof typeof EventTypes];

/**
 * All valid event types as array
 */
export const ALL_EVENT_TYPES: EventType[] = Object.values(EventTypes);

/**
 * Validate that a string is a valid event type
 * @param eventType - String to validate
 * @returns true if valid event type
 */
export function isValidEventType(eventType: string): eventType is EventType {
  return ALL_EVENT_TYPES.includes(eventType as EventType);
}
