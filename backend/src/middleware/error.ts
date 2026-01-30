/**
 * Global Error Handler Middleware
 * Spec: 016-backend-api (FR-018, FR-019)
 *
 * Structured error responses with error codes
 */

import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { ErrorCode, sendError, sendInternalError, sendValidationError } from '../utils/response';
import logger from '../utils/logger';

// ========== CUSTOM ERROR CLASSES ==========

/**
 * Base application error
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;
  public readonly details?: Record<string, string[]>;

  constructor(
    message: string,
    statusCode: number,
    code: ErrorCode,
    details?: Record<string, string[]>
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;

    // Maintains proper stack trace for where error was thrown
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Not found error (404)
 */
export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(message, 404, ErrorCode.NOT_FOUND);
    this.name = 'NotFoundError';
  }
}

/**
 * Validation error (400)
 */
export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, string[]>) {
    super(message, 400, ErrorCode.VALIDATION_ERROR, details);
    this.name = 'ValidationError';
  }
}

/**
 * Invalid transition error (400)
 */
export class InvalidTransitionError extends AppError {
  constructor(message: string) {
    super(message, 400, ErrorCode.INVALID_TRANSITION);
    this.name = 'InvalidTransitionError';
  }
}

/**
 * External failure error (502)
 */
export class ExternalFailureError extends AppError {
  constructor(message: string) {
    super(message, 502, ErrorCode.EXTERNAL_FAILURE);
    this.name = 'ExternalFailureError';
  }
}

/**
 * Unauthorized error (401)
 */
export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401, ErrorCode.UNAUTHORIZED);
    this.name = 'UnauthorizedError';
  }
}

// ========== ERROR HANDLER MIDDLEWARE ==========

/**
 * Global error handler middleware
 * Must be registered last in middleware chain
 *
 * Handles:
 * - AppError and subclasses
 * - ZodError (validation)
 * - Generic errors
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Log the error
  logger.logError('Request error', err, {
    method: req.method,
    path: req.path,
    body: req.body,
    query: req.query
  });

  // Already sent response
  if (res.headersSent) {
    return next(err);
  }

  // Handle AppError and subclasses
  if (err instanceof AppError) {
    sendError(res, err.message, err.code, err.statusCode, err.details);
    return;
  }

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    const details: Record<string, string[]> = {};
    for (const issue of err.issues) {
      const field = issue.path.join('.') || '_root';
      if (!details[field]) {
        details[field] = [];
      }
      details[field].push(issue.message);
    }
    sendValidationError(res, 'Validation failed', details);
    return;
  }

  // Handle generic errors
  const message =
    process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message || 'Internal server error';

  sendInternalError(res, message);
}

/**
 * Not found handler middleware
 * Register after all routes to catch unmatched paths
 */
export function notFoundHandler(req: Request, res: Response): void {
  sendError(
    res,
    `Cannot ${req.method} ${req.path}`,
    ErrorCode.NOT_FOUND,
    404
  );
}

/**
 * Async handler wrapper
 * Catches errors from async route handlers and passes to error middleware
 *
 * @example
 * ```typescript
 * router.get('/jobs', asyncHandler(async (req, res) => {
 *   const jobs = await getJobs();
 *   res.json(jobs);
 * }));
 * ```
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
