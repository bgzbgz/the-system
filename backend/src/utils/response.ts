/**
 * Response Helpers
 * Spec: 016-backend-api (FR-018, FR-019)
 *
 * Standardized response factories for success and error responses
 */

import { Response } from 'express';

// ========== TYPES ==========

/**
 * Standard success response format
 */
export interface SuccessResponse<T> {
  data: T;
  meta?: {
    total?: number;
    limit?: number;
    offset?: number;
  };
}

/**
 * Standard error response format (FR-018)
 */
export interface ErrorResponse {
  error: string;
  code: string;
  details?: Record<string, string[]>;
}

/**
 * Error codes per FR-019
 */
export enum ErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  INVALID_TRANSITION = 'INVALID_TRANSITION',
  EXTERNAL_FAILURE = 'EXTERNAL_FAILURE',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  INVALID_SECRET = 'INVALID_SECRET',
  UNAUTHORIZED = 'UNAUTHORIZED',
  ALREADY_EXISTS = 'ALREADY_EXISTS'
}

// ========== SUCCESS RESPONSES ==========

/**
 * Send a success response with data
 */
export function sendSuccess<T>(
  res: Response,
  data: T,
  statusCode: number = 200
): Response {
  return res.status(statusCode).json({ data });
}

/**
 * Send a success response with data and pagination meta
 */
export function sendSuccessWithMeta<T>(
  res: Response,
  data: T,
  meta: { total: number; limit: number; offset: number },
  statusCode: number = 200
): Response {
  return res.status(statusCode).json({ data, meta });
}

/**
 * Send a created response (201)
 */
export function sendCreated<T>(res: Response, data: T): Response {
  return res.status(201).json(data);
}

// ========== ERROR RESPONSES ==========

/**
 * Send a validation error response (400)
 */
export function sendValidationError(
  res: Response,
  message: string,
  details?: Record<string, string[]>
): Response {
  const response: ErrorResponse = {
    error: message,
    code: ErrorCode.VALIDATION_ERROR,
    ...(details && { details })
  };
  return res.status(400).json(response);
}

/**
 * Send a not found error response (404)
 */
export function sendNotFound(res: Response, message: string = 'Resource not found'): Response {
  const response: ErrorResponse = {
    error: message,
    code: ErrorCode.NOT_FOUND
  };
  return res.status(404).json(response);
}

/**
 * Send an invalid transition error response (400)
 */
export function sendInvalidTransition(res: Response, message: string): Response {
  const response: ErrorResponse = {
    error: message,
    code: ErrorCode.INVALID_TRANSITION
  };
  return res.status(400).json(response);
}

/**
 * Send an external failure error response (502)
 */
export function sendExternalFailure(res: Response, message: string): Response {
  const response: ErrorResponse = {
    error: message,
    code: ErrorCode.EXTERNAL_FAILURE
  };
  return res.status(502).json(response);
}

/**
 * Send an internal error response (500)
 */
export function sendInternalError(
  res: Response,
  message: string = 'Internal server error'
): Response {
  const response: ErrorResponse = {
    error: message,
    code: ErrorCode.INTERNAL_ERROR
  };
  return res.status(500).json(response);
}

/**
 * Send an unauthorized error response (401)
 */
export function sendUnauthorized(res: Response, message: string = 'Unauthorized'): Response {
  const response: ErrorResponse = {
    error: message,
    code: ErrorCode.UNAUTHORIZED
  };
  return res.status(401).json(response);
}

/**
 * Send an invalid secret error response (401)
 */
export function sendInvalidSecret(res: Response): Response {
  const response: ErrorResponse = {
    error: 'Invalid callback secret',
    code: ErrorCode.INVALID_SECRET
  };
  return res.status(401).json(response);
}

/**
 * Generic error response with custom status code
 */
export function sendError(
  res: Response,
  message: string,
  code: ErrorCode,
  statusCode: number,
  details?: Record<string, string[]>
): Response {
  const response: ErrorResponse = {
    error: message,
    code,
    ...(details && { details })
  };
  return res.status(statusCode).json(response);
}
