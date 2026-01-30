/**
 * Request Logging Middleware
 * Spec: 016-backend-api (T061, FR-021)
 *
 * Logs all incoming HTTP requests with structured JSON
 */

import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

/**
 * Request logging middleware
 * Logs request start and completion with timing
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Attach request ID to request object for downstream use
  (req as any).requestId = requestId;

  // Log request start
  logger.info('Request started', {
    request_id: requestId,
    method: req.method,
    path: req.path,
    query: Object.keys(req.query).length > 0 ? req.query : undefined,
    ip: req.ip || req.socket.remoteAddress,
    user_agent: req.get('user-agent')
  });

  // Capture original end method
  const originalEnd = res.end;

  // Override end to log response
  res.end = function(chunk?: any, encoding?: any, callback?: any): Response {
    const duration = Date.now() - startTime;

    // Log request completion
    logger.info('Request completed', {
      request_id: requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration_ms: duration
    });

    // Call original end
    return originalEnd.call(this, chunk, encoding, callback);
  };

  next();
}

/**
 * Simplified request logger for high-volume endpoints
 * Logs only errors and slow requests (>1000ms)
 */
export function lightRequestLogger(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();

  // Capture original end method
  const originalEnd = res.end;

  // Override end to conditionally log response
  res.end = function(chunk?: any, encoding?: any, callback?: any): Response {
    const duration = Date.now() - startTime;

    // Log slow requests or errors
    if (duration > 1000 || res.statusCode >= 400) {
      logger.info('Request', {
        method: req.method,
        path: req.path,
        status: res.statusCode,
        duration_ms: duration,
        slow: duration > 1000
      });
    }

    // Call original end
    return originalEnd.call(this, chunk, encoding, callback);
  };

  next();
}

export default requestLogger;
