/**
 * Fast Track State Machine - Status Transitions
 * Spec: 016-backend-api
 * Per data-model.md state machine
 *
 * Centralized control for all job status transitions with atomic audit logging
 */

import { Job, JobStatus } from '../models/job';
import {
  AuditLogEntry,
  AuditLogResponse,
  AuditLogListResponse,
  ActorType,
  CreateAuditLogInput,
  createAuditLogEntry,
  auditLogToResponse
} from '../models/auditLog';
import logger from '../utils/logger';

// ========== VALID TRANSITIONS (per data-model.md) ==========

/**
 * State machine: Valid status transitions
 * Key = from status (null for creation)
 * Value = array of valid target statuses
 *
 * Updated for spec 016-backend-api with 10 statuses
 */
export const VALID_TRANSITIONS: Map<JobStatus | null, JobStatus[]> = new Map([
  // Initial submission
  [null, [JobStatus.SENT]],

  // SENT: Workflow starts processing or fails immediately
  [JobStatus.SENT, [JobStatus.PROCESSING, JobStatus.QA_FAILED]],

  // PROCESSING: QA can pass, fail, or need escalation
  [JobStatus.PROCESSING, [
    JobStatus.READY_FOR_REVIEW,
    JobStatus.QA_FAILED,
    JobStatus.ESCALATED
  ]],

  // QA_FAILED: Boss can approve (deploy anyway), request revision, or reject
  [JobStatus.QA_FAILED, [
    JobStatus.DEPLOYING,    // Boss approves despite QA failure
    JobStatus.PROCESSING,   // Boss requests revision
    JobStatus.REJECTED      // Boss rejects
  ]],

  // ESCALATED: Can only be rejected (manual intervention)
  [JobStatus.ESCALATED, [JobStatus.REJECTED]],

  // READY_FOR_REVIEW: Boss can approve, reject, or request revision
  [JobStatus.READY_FOR_REVIEW, [
    JobStatus.DEPLOYING,        // Boss approves
    JobStatus.REJECTED,         // Boss rejects
    JobStatus.REVISION_REQUESTED, // Boss requests changes (legacy)
    JobStatus.PROCESSING        // Boss requests revision (spec 023 direct path)
  ]],

  // REVISION_REQUESTED: Goes back to processing
  [JobStatus.REVISION_REQUESTED, [JobStatus.PROCESSING]],

  // DEPLOYING: Deploy succeeds or fails
  [JobStatus.DEPLOYING, [
    JobStatus.DEPLOYED,
    JobStatus.DEPLOY_FAILED
  ]],

  // DEPLOY_FAILED: Can retry deployment
  [JobStatus.DEPLOY_FAILED, [JobStatus.DEPLOYING]],

  // Terminal states - no outgoing transitions
  [JobStatus.DEPLOYED, []],
  [JobStatus.REJECTED, []]
]);

// ========== TRANSITION VALIDATION ==========

/**
 * Check if a status transition is valid
 *
 * @param from - Current status (null for new job)
 * @param to - Target status
 * @returns true if transition is allowed
 */
export function canTransition(from: JobStatus | null, to: JobStatus): boolean {
  const allowedTargets = VALID_TRANSITIONS.get(from);
  if (!allowedTargets) {
    return false;
  }
  return allowedTargets.includes(to);
}

/**
 * Get error message for invalid transition
 *
 * @param from - Current status
 * @param to - Attempted target status
 * @returns Human-readable error message
 */
export function getInvalidTransitionError(from: JobStatus | null, to: JobStatus): string {
  const fromStr = from || 'null';
  const allowedTargets = VALID_TRANSITIONS.get(from);

  if (!allowedTargets || allowedTargets.length === 0) {
    return `Status ${fromStr} is terminal and cannot transition to any other status`;
  }

  return `Invalid transition: ${fromStr} → ${to}. Allowed: ${allowedTargets.join(', ')}`;
}

/**
 * Get list of valid next statuses for a given status
 *
 * @param from - Current status
 * @returns Array of valid target statuses
 */
export function getValidNextStatuses(from: JobStatus): JobStatus[] {
  return VALID_TRANSITIONS.get(from) || [];
}

/**
 * Check if a status is terminal (no outgoing transitions)
 *
 * @param status - Status to check
 * @returns true if terminal
 */
export function isTerminalStatus(status: JobStatus): boolean {
  const targets = VALID_TRANSITIONS.get(status);
  return !targets || targets.length === 0;
}

// ========== IN-MEMORY STORAGE (TODO: Replace with MongoDB) ==========

// Temporary in-memory storage for audit logs
// TODO: Replace with MongoDB collection
const auditLogStore: AuditLogEntry[] = [];
let auditIdCounter = 1;

/**
 * Create audit log entry in storage
 * Internal function - not exposed via API
 */
async function createAuditLog(input: CreateAuditLogInput): Promise<AuditLogEntry> {
  const entry: AuditLogEntry = {
    _id: `audit_${auditIdCounter++}`,
    ...createAuditLogEntry(input)
  };

  auditLogStore.push(entry);

  logger.logOperation({
    operation: 'AUDIT_LOG_CREATED',
    job_id: entry.job_id,
    status: entry.to_status,
    actor: entry.actor,
    details: {
      from_status: entry.from_status || 'null',
      to_status: entry.to_status,
      note: entry.note || 'N/A'
    }
  });

  return entry;
}

// ========== CORE TRANSITION FUNCTION ==========

/**
 * Result of a job transition
 */
export interface TransitionResult {
  success: boolean;
  job?: Job;
  auditEntry?: AuditLogEntry;
  error?: string;
}

/**
 * Execute status transition with atomic audit logging
 *
 * This is the ONLY way to change a job's status.
 * Every call creates an audit log entry (FR-015).
 *
 * @param job - The job to transition
 * @param toStatus - Target status
 * @param actor - Who initiated the transition (SR-003: server-determined)
 * @param note - Optional note (max 1000 chars)
 * @returns TransitionResult with updated job and audit entry
 */
export async function transitionJob(
  job: Job,
  toStatus: JobStatus,
  actor: ActorType,
  note?: string
): Promise<TransitionResult> {
  const fromStatus = job.status;

  // Validate transition (FR-010)
  if (!canTransition(fromStatus, toStatus)) {
    return {
      success: false,
      error: getInvalidTransitionError(fromStatus, toStatus)
    };
  }

  // Validate note length
  if (note && note.length > 1000) {
    return {
      success: false,
      error: 'Note exceeds maximum length of 1000 characters'
    };
  }

  // Create audit log entry (FR-015: automatic logging)
  const auditEntry = await createAuditLog({
    job_id: job.job_id,
    from_status: fromStatus,
    to_status: toStatus,
    actor,
    note
  });

  // Update job status and timestamp
  const updatedJob: Job = {
    ...job,
    status: toStatus,
    updated_at: new Date()
  };

  // TODO: In production, this should be an atomic MongoDB transaction
  // to ensure both job update and audit log creation succeed or both fail

  return {
    success: true,
    job: updatedJob,
    auditEntry
  };
}

/**
 * Create initial audit entry for a new job (null → SENT)
 * Called during job creation
 *
 * @param jobId - The new job's ID
 * @returns The created audit entry
 */
export async function createInitialAuditEntry(jobId: string): Promise<AuditLogEntry> {
  return createAuditLog({
    job_id: jobId,
    from_status: null,
    to_status: JobStatus.SENT,
    actor: ActorType.SYSTEM
  });
}

// ========== AUDIT LOG RETRIEVAL (FR-016) ==========

/**
 * Get audit log entries for a job with pagination
 *
 * @param jobId - Job ID to get audit log for
 * @param page - Page number (1-indexed), defaults to 1
 * @param limit - Entries per page, defaults to 50, max 100
 * @returns Paginated audit log entries in chronological order (oldest first)
 */
export async function getAuditLog(
  jobId: string,
  page: number = 1,
  limit: number = 50
): Promise<AuditLogListResponse> {
  // Clamp limit to max 100
  const safeLimit = Math.min(Math.max(1, limit), 100);
  const safePage = Math.max(1, page);

  // Filter entries for this job
  const jobEntries = auditLogStore.filter(e => e.job_id === jobId);

  // Sort by timestamp ascending (oldest first)
  const sorted = [...jobEntries].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
  );

  // Calculate pagination
  const total = sorted.length;
  const pages = Math.ceil(total / safeLimit);
  const skip = (safePage - 1) * safeLimit;

  // Get page of entries
  const pageEntries = sorted.slice(skip, skip + safeLimit);

  return {
    entries: pageEntries.map(auditLogToResponse),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      pages
    }
  };
}

/**
 * Get all audit log entries with optional job filter and pagination
 *
 * @param options - Query options
 * @returns Paginated audit log entries
 */
export async function getAllAuditLogs(options: {
  jobId?: string;
  limit?: number;
  offset?: number;
}): Promise<{ data: AuditLogResponse[]; meta: { total: number; limit: number; offset: number } }> {
  const { jobId, limit = 50, offset = 0 } = options;
  const safeLimit = Math.min(Math.max(1, limit), 100);
  const safeOffset = Math.max(0, offset);

  // Filter by job if specified
  let entries = jobId
    ? auditLogStore.filter(e => e.job_id === jobId)
    : [...auditLogStore];

  // Sort by timestamp descending (newest first)
  entries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  const total = entries.length;

  // Apply pagination
  const pageEntries = entries.slice(safeOffset, safeOffset + safeLimit);

  return {
    data: pageEntries.map(auditLogToResponse),
    meta: {
      total,
      limit: safeLimit,
      offset: safeOffset
    }
  };
}

/**
 * Check if any audit entries exist for a job
 * Used to verify job exists before returning 404
 */
export async function hasAuditEntries(jobId: string): Promise<boolean> {
  return auditLogStore.some(e => e.job_id === jobId);
}

/**
 * Get audit log store for testing/debugging
 * @internal
 */
export function _getAuditLogStore(): AuditLogEntry[] {
  return auditLogStore;
}

// ========== EXPORTS ==========

export { ActorType } from '../models/auditLog';
