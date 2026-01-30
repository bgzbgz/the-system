/**
 * Fast Track Audit Log - Model
 * Spec: 011-status-audit-log
 * Per data-model.md
 *
 * Append-only audit log for job status transitions
 */

import { JobStatus } from './job';

// ========== ENUMS ==========

/**
 * Actor types for audit log entries
 * Who/what initiated a status transition
 */
export enum ActorType {
  BOSS = 'BOSS',         // Authenticated human user
  FACTORY = 'FACTORY',   // External Factory webhook callback
  SYSTEM = 'SYSTEM'      // Automated process (creation, timeouts)
}

/**
 * Event types for audit logging (per contracts/audit.yaml)
 * Spec: 016-backend-api (T045)
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

// ========== INTERFACES ==========

/**
 * Audit log entry - single status transition record
 * Immutable after creation (FR-006)
 */
export interface AuditLogEntry {
  _id: string;                      // MongoDB ObjectId as string
  job_id: string;                   // Reference to Job.job_id
  from_status: JobStatus | null;    // Previous status (null for creation)
  to_status: JobStatus;             // New status
  timestamp: Date;                  // Server-generated (SR-002)
  actor: ActorType;                 // Server-determined (SR-003)
  note?: string;                    // Optional, max 1000 chars
}

/**
 * Audit log entry for creation (without _id)
 */
export interface CreateAuditLogInput {
  job_id: string;
  from_status: JobStatus | null;
  to_status: JobStatus;
  actor: ActorType;
  note?: string;
}

/**
 * Audit log API response (single entry)
 */
export interface AuditLogResponse {
  id: string;
  job_id: string;
  from_status: string | null;
  to_status: string;
  timestamp: string;     // ISO 8601
  actor: string;
  note?: string;
}

/**
 * Audit log list API response with pagination
 */
export interface AuditLogListResponse {
  entries: AuditLogResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// ========== MONGOOSE SCHEMA ==========

/**
 * MongoDB schema definition for AuditLog collection
 * Collection: fast_track_tools.audit_logs
 *
 * Indexes:
 * - { job_id: 1, timestamp: 1 } - Primary query pattern
 *
 * Note: This collection is APPEND-ONLY (FR-006)
 * No UPDATE or DELETE operations should be exposed
 */
export const AuditLogSchema = {
  job_id: {
    type: String,
    required: true,
    index: true
  },
  from_status: {
    type: String,
    required: false,
    enum: [...Object.values(JobStatus), null],
    default: null
  },
  to_status: {
    type: String,
    required: true,
    enum: Object.values(JobStatus)
  },
  timestamp: {
    type: Date,
    required: true,
    default: Date.now
  },
  actor: {
    type: String,
    required: true,
    enum: Object.values(ActorType)
  },
  note: {
    type: String,
    required: false,
    maxlength: 1000,
    default: null
  }
};

// Compound index for efficient queries (defined separately for Mongoose)
// db.audit_logs.createIndex({ job_id: 1, timestamp: 1 })

// ========== TRANSFORM FUNCTIONS ==========

/**
 * Convert AuditLogEntry to API response format
 */
export function auditLogToResponse(entry: AuditLogEntry): AuditLogResponse {
  const response: AuditLogResponse = {
    id: entry._id,
    job_id: entry.job_id,
    from_status: entry.from_status,
    to_status: entry.to_status,
    timestamp: entry.timestamp.toISOString(),
    actor: entry.actor
  };

  if (entry.note) {
    response.note = entry.note;
  }

  return response;
}

/**
 * Create audit log entry with server-generated timestamp
 * Timestamp is ALWAYS set server-side (SR-002)
 */
export function createAuditLogEntry(input: CreateAuditLogInput): Omit<AuditLogEntry, '_id'> {
  return {
    job_id: input.job_id,
    from_status: input.from_status,
    to_status: input.to_status,
    timestamp: new Date(),  // Server-generated (SR-002)
    actor: input.actor,
    note: input.note
  };
}

// ========== VALIDATION ==========

/**
 * Validate actor type string
 */
export function isValidActorType(actor: string): actor is ActorType {
  return Object.values(ActorType).includes(actor as ActorType);
}

/**
 * Validate note length
 */
export function isValidNote(note: string | undefined): boolean {
  if (note === undefined || note === null) {
    return true;
  }
  return note.length <= 1000;
}
