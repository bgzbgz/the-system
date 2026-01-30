/**
 * Audit Service
 * Spec: 017-mongodb-schema
 *
 * Per contracts/database.yaml operations.audit_log
 * Operations for immutable audit trail
 */

import { Collection, Document } from 'mongodb';
import { getDB, COLLECTIONS } from '../connection';
import { generateUUID } from '../utils/uuid';
import {
  AuditLogEntry,
  CreateAuditLogInput,
  createAuditLogDocument,
  auditLogToResponse,
  AuditLogResponse,
  AuditLogListResponse
} from '../models/auditLog';
import { EventTypes, EventType } from '../types/eventTypes';
import { JobStatus } from '../types/status';

// ========== COLLECTION ACCESS ==========

/**
 * Get audit_log collection
 */
function getAuditLogCollection(): Collection<AuditLogEntry & Document> {
  return getDB().collection<AuditLogEntry & Document>(COLLECTIONS.AUDIT_LOG);
}

// ========== CREATE ==========

/**
 * Log an event to the audit trail
 * Per contracts/database.yaml operations.audit_log.create
 *
 * @param input - Audit log input
 * @returns Created audit log entry
 */
export async function logEvent(input: CreateAuditLogInput): Promise<AuditLogEntry> {
  const collection = getAuditLogCollection();
  const eventId = generateUUID();
  const entry = createAuditLogDocument(eventId, input);

  await collection.insertOne(entry as AuditLogEntry & Document);

  return { ...entry, event_id: eventId } as AuditLogEntry;
}

// ========== CONVENIENCE METHODS ==========

/**
 * Log job created event
 */
export async function logJobCreated(
  jobId: string,
  fileName: string,
  category: string
): Promise<AuditLogEntry> {
  return logEvent({
    event_type: EventTypes.JOB_CREATED,
    job_id: jobId,
    details: { file_name: fileName, category }
  });
}

/**
 * Log status changed event
 */
export async function logStatusChanged(
  jobId: string,
  fromStatus: JobStatus,
  toStatus: JobStatus
): Promise<AuditLogEntry> {
  return logEvent({
    event_type: EventTypes.STATUS_CHANGED,
    job_id: jobId,
    details: { from_status: fromStatus, to_status: toStatus }
  });
}

/**
 * Log QA started event
 */
export async function logQAStarted(jobId: string, attemptNumber: number): Promise<AuditLogEntry> {
  return logEvent({
    event_type: EventTypes.QA_STARTED,
    job_id: jobId,
    details: { attempt_number: attemptNumber }
  });
}

/**
 * Log QA passed event
 */
export async function logQAPassed(
  jobId: string,
  score: number,
  maxScore: number
): Promise<AuditLogEntry> {
  return logEvent({
    event_type: EventTypes.QA_PASSED,
    job_id: jobId,
    details: { score, max_score: maxScore }
  });
}

/**
 * Log QA failed event
 */
export async function logQAFailed(
  jobId: string,
  score: number,
  failedCriteria: string[]
): Promise<AuditLogEntry> {
  return logEvent({
    event_type: EventTypes.QA_FAILED,
    job_id: jobId,
    details: { score, failed_criteria: failedCriteria }
  });
}

/**
 * Log revision requested event
 */
export async function logRevisionRequested(jobId: string, notes: string): Promise<AuditLogEntry> {
  return logEvent({
    event_type: EventTypes.REVISION_REQUESTED,
    job_id: jobId,
    details: { notes }
  });
}

/**
 * Log revision completed event
 */
export async function logRevisionCompleted(jobId: string): Promise<AuditLogEntry> {
  return logEvent({
    event_type: EventTypes.REVISION_COMPLETED,
    job_id: jobId,
    details: {}
  });
}

/**
 * Log deployment started event
 */
export async function logDeploymentStarted(jobId: string): Promise<AuditLogEntry> {
  return logEvent({
    event_type: EventTypes.DEPLOYMENT_STARTED,
    job_id: jobId,
    details: {}
  });
}

/**
 * Log deployment completed event
 */
export async function logDeploymentCompleted(
  jobId: string,
  deployedUrl: string
): Promise<AuditLogEntry> {
  return logEvent({
    event_type: EventTypes.DEPLOYMENT_COMPLETED,
    job_id: jobId,
    details: { deployed_url: deployedUrl }
  });
}

/**
 * Log deployment failed event
 */
export async function logDeploymentFailed(jobId: string, error: string): Promise<AuditLogEntry> {
  return logEvent({
    event_type: EventTypes.DEPLOYMENT_FAILED,
    job_id: jobId,
    details: { error }
  });
}

/**
 * Log job rejected event
 */
export async function logJobRejected(jobId: string, reason?: string): Promise<AuditLogEntry> {
  return logEvent({
    event_type: EventTypes.JOB_REJECTED,
    job_id: jobId,
    details: { reason: reason || 'No reason provided' }
  });
}

/**
 * Log job escalated event
 */
export async function logJobEscalated(jobId: string, reason?: string): Promise<AuditLogEntry> {
  return logEvent({
    event_type: EventTypes.JOB_ESCALATED,
    job_id: jobId,
    details: { reason: reason || 'No reason provided' }
  });
}

// ========== QUERY ==========

/**
 * Get audit log entries for a job
 * Per contracts/database.yaml operations.audit_log.query_by_job
 *
 * @param jobId - Job UUID
 * @returns Audit entries in chronological order
 */
export async function getByJobId(jobId: string): Promise<AuditLogEntry[]> {
  const collection = getAuditLogCollection();

  const entries = await collection
    .find({ job_id: jobId })
    .sort({ timestamp: 1 })  // Chronological order (oldest first)
    .toArray();

  return entries as AuditLogEntry[];
}

/**
 * Get audit log entries by event type
 * Per contracts/database.yaml operations.audit_log.query_by_type
 *
 * @param eventType - Event type to filter by
 * @param options - Pagination options
 * @returns Audit entries
 */
export async function getByEventType(
  eventType: EventType,
  options: { limit?: number; offset?: number } = {}
): Promise<{ entries: AuditLogEntry[]; total: number }> {
  const collection = getAuditLogCollection();
  const { limit = 50, offset = 0 } = options;

  const [entries, total] = await Promise.all([
    collection
      .find({ event_type: eventType })
      .sort({ timestamp: -1 })  // Newest first
      .skip(offset)
      .limit(limit)
      .toArray(),
    collection.countDocuments({ event_type: eventType })
  ]);

  return { entries: entries as AuditLogEntry[], total };
}

/**
 * Get paginated audit log entries for a job
 *
 * @param jobId - Job UUID
 * @param page - Page number (1-indexed)
 * @param limit - Entries per page (max 100)
 * @returns Paginated audit log
 */
export async function getByJobIdPaginated(
  jobId: string,
  page: number = 1,
  limit: number = 50
): Promise<AuditLogListResponse> {
  const collection = getAuditLogCollection();

  const safePage = Math.max(1, page);
  const safeLimit = Math.min(Math.max(1, limit), 100);
  const skip = (safePage - 1) * safeLimit;

  const [entries, total] = await Promise.all([
    collection
      .find({ job_id: jobId })
      .sort({ timestamp: 1 })
      .skip(skip)
      .limit(safeLimit)
      .toArray(),
    collection.countDocuments({ job_id: jobId })
  ]);

  return {
    entries: (entries as AuditLogEntry[]).map(auditLogToResponse),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      pages: Math.ceil(total / safeLimit)
    }
  };
}
