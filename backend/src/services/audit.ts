/**
 * Audit Service
 * Spec: 016-backend-api (FR-015, FR-016, FR-017)
 *
 * Service for creating and querying audit events
 */

import { JobStatus } from '../models/job';
import { ActorType, AuditLogEntry, AuditLogResponse, auditLogToResponse } from '../models/auditLog';
import logger from '../utils/logger';

// ========== EVENT TYPES (T045) ==========

/**
 * Event types for audit logging (per contracts/audit.yaml)
 */
export enum EventType {
  JOB_CREATED = 'JOB_CREATED',
  STATUS_CHANGED = 'STATUS_CHANGED',
  WORKFLOW_TRIGGERED = 'WORKFLOW_TRIGGERED',
  WORKFLOW_FAILED = 'WORKFLOW_FAILED',
  CALLBACK_RECEIVED = 'CALLBACK_RECEIVED',
  BOSS_APPROVED = 'BOSS_APPROVED',
  BOSS_REJECTED = 'BOSS_REJECTED',
  BOSS_REVISION_REQUESTED = 'BOSS_REVISION_REQUESTED',
  DEPLOYMENT_STARTED = 'DEPLOYMENT_STARTED',
  DEPLOYMENT_COMPLETED = 'DEPLOYMENT_COMPLETED',
  DEPLOYMENT_FAILED = 'DEPLOYMENT_FAILED'
}

// ========== IN-MEMORY STORAGE (TODO: Replace with MongoDB) ==========

// Temporary in-memory storage for audit events
// TODO: Replace with MongoDB collection
const auditEventStore: AuditLogEntry[] = [];
let auditIdCounter = 1;

// ========== CREATE EVENT ==========

/**
 * Input for creating an audit event
 */
export interface CreateAuditEventInput {
  job_id: string;
  event_type: EventType;
  from_status: JobStatus | null;
  to_status: JobStatus;
  actor: ActorType;
  details?: string;
}

/**
 * Create a new audit event (FR-015)
 *
 * @param input - Event creation input
 * @returns Created audit entry
 */
export async function createEvent(input: CreateAuditEventInput): Promise<AuditLogEntry> {
  const entry: AuditLogEntry = {
    _id: `audit_${auditIdCounter++}`,
    job_id: input.job_id,
    from_status: input.from_status,
    to_status: input.to_status,
    timestamp: new Date(),
    actor: input.actor,
    note: input.details ? `[${input.event_type}] ${input.details}` : `[${input.event_type}]`
  };

  auditEventStore.push(entry);

  logger.logOperation({
    operation: 'AUDIT_EVENT_CREATED',
    job_id: entry.job_id,
    status: entry.to_status,
    actor: entry.actor,
    details: {
      event_type: input.event_type,
      from_status: entry.from_status || 'null',
      to_status: entry.to_status
    }
  });

  return entry;
}

// ========== QUERY EVENTS ==========

/**
 * Query options for audit events
 */
export interface QueryEventsOptions {
  job_id?: string;
  limit?: number;
  offset?: number;
}

/**
 * Query result for audit events
 */
export interface QueryEventsResult {
  data: AuditLogResponse[];
  meta: {
    total: number;
    limit: number;
    offset: number;
  };
}

/**
 * Query audit events with optional filters (FR-016)
 *
 * @param options - Query options
 * @returns Paginated audit events
 */
export async function queryEvents(options: QueryEventsOptions): Promise<QueryEventsResult> {
  const { job_id, limit = 50, offset = 0 } = options;
  const safeLimit = Math.min(Math.max(1, limit), 100);
  const safeOffset = Math.max(0, offset);

  // Filter by job_id if specified
  let events = job_id
    ? auditEventStore.filter(e => e.job_id === job_id)
    : [...auditEventStore];

  // Sort by timestamp descending (newest first) for general queries
  events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  const total = events.length;

  // Apply pagination
  const pageEvents = events.slice(safeOffset, safeOffset + safeLimit);

  return {
    data: pageEvents.map(auditLogToResponse),
    meta: {
      total,
      limit: safeLimit,
      offset: safeOffset
    }
  };
}

/**
 * Get audit events for a specific job in chronological order (FR-016)
 *
 * @param jobId - Job ID
 * @returns Audit events sorted oldest to newest
 */
export async function getJobAuditHistory(jobId: string): Promise<QueryEventsResult> {
  // Filter by job_id
  let events = auditEventStore.filter(e => e.job_id === jobId);

  // Sort by timestamp ascending (oldest first) for job history
  events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  return {
    data: events.map(auditLogToResponse),
    meta: {
      total: events.length,
      limit: events.length,
      offset: 0
    }
  };
}

/**
 * Check if a job has any audit entries
 *
 * @param jobId - Job ID
 * @returns true if job has audit entries
 */
export async function jobHasAuditEntries(jobId: string): Promise<boolean> {
  return auditEventStore.some(e => e.job_id === jobId);
}

/**
 * Get audit event store for testing/debugging
 * @internal
 */
export function _getAuditEventStore(): AuditLogEntry[] {
  return auditEventStore;
}

// ========== EXPORTS ==========

export default {
  createEvent,
  queryEvents,
  getJobAuditHistory,
  jobHasAuditEntries,
  EventType
};
