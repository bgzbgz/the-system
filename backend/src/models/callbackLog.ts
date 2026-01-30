/**
 * Fast Track Factory Callback - Callback Log Model
 * Spec: 008-factory-callback
 * Per contracts/callback-log.yaml
 *
 * Audit record for all Factory callback attempts
 */

import { randomUUID } from 'crypto';

// ========== ENUMS ==========

/**
 * Result codes for callback processing
 */
export enum CallbackResult {
  SUCCESS = 'SUCCESS',
  AUTH_FAILED = 'AUTH_FAILED',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  JOB_NOT_FOUND = 'JOB_NOT_FOUND',
  INVALID_STATE = 'INVALID_STATE'
}

// ========== INTERFACES ==========

/**
 * Callback log entry - audit record for Factory callback attempts
 */
export interface CallbackLog {
  callback_id: string;
  job_id?: string;
  timestamp: Date;
  result: CallbackResult;
  request_hash: string;
  ip_address?: string;
  error_message?: string;
}

// ========== MONGOOSE SCHEMA ==========

/**
 * MongoDB schema definition for CallbackLog collection
 * Collection: fast_track_tools.callback_logs
 *
 * Indexes:
 * - callback_id: unique
 * - job_id: standard (for related lookups)
 * - timestamp: descending (for audit queries)
 * - TTL: 30 days auto-cleanup
 */
export const CallbackLogSchema = {
  callback_id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  job_id: {
    type: String,
    required: false,
    index: true
  },
  timestamp: {
    type: Date,
    required: true,
    default: Date.now,
    index: true
  },
  result: {
    type: String,
    required: true,
    enum: Object.values(CallbackResult)
  },
  request_hash: {
    type: String,
    required: true
  },
  ip_address: {
    type: String,
    required: false
  },
  error_message: {
    type: String,
    required: false,
    maxlength: 500
  }
};

// ========== FACTORY FUNCTIONS ==========

/**
 * Create a new CallbackLog entry
 */
export function createCallbackLog(
  result: CallbackResult,
  requestHash: string,
  jobId?: string,
  ipAddress?: string,
  errorMessage?: string
): CallbackLog {
  return {
    callback_id: randomUUID(),
    job_id: jobId,
    timestamp: new Date(),
    result,
    request_hash: requestHash,
    ip_address: ipAddress,
    error_message: errorMessage
  };
}
