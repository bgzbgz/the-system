/**
 * Audit Log Model
 * Spec: 017-mongodb-schema
 *
 * Per data-model.md Audit Log Collection schema
 * Immutable record of all system events - retained indefinitely
 */

import { ObjectId } from 'mongodb';

/**
 * Audit log entry document
 * Per data-model.md AuditLogEntry interface
 */
export interface AuditLogEntry {
  _id?: ObjectId;
  event_id: string;                   // UUID, unique
  event_type: string;                 // e.g., 'job.created', 'status.changed'
  job_id: string;                     // Reference to job
  details: Record<string, unknown>;   // Event-specific data
  timestamp: Date;
}

/**
 * Input for creating an audit log entry
 */
export interface CreateAuditLogInput {
  event_type: string;
  job_id: string;
  details: Record<string, unknown>;
}

/**
 * Create an audit log document
 *
 * @param eventId - UUID for the event
 * @param input - Audit log input
 * @returns Audit log document ready for insertion
 */
export function createAuditLogDocument(
  eventId: string,
  input: CreateAuditLogInput
): Omit<AuditLogEntry, '_id'> {
  return {
    event_id: eventId,
    event_type: input.event_type,
    job_id: input.job_id,
    details: input.details,
    timestamp: new Date()
  };
}

/**
 * Audit log API response
 */
export interface AuditLogResponse {
  event_id: string;
  event_type: string;
  job_id: string;
  details: Record<string, unknown>;
  timestamp: string;
}

/**
 * Convert audit log entry to response format
 */
export function auditLogToResponse(entry: AuditLogEntry): AuditLogResponse {
  return {
    event_id: entry.event_id,
    event_type: entry.event_type,
    job_id: entry.job_id,
    details: entry.details,
    timestamp: entry.timestamp.toISOString()
  };
}

/**
 * Audit log list response with pagination
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
