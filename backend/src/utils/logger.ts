/**
 * JSON Logger Utility
 * Spec: 016-backend-api (FR-021)
 *
 * Structured JSON logging for requests, errors, and key operations
 */

// ========== TYPES ==========

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
}

export interface RequestLogContext {
  method: string;
  path: string;
  statusCode?: number;
  duration_ms?: number;
  job_id?: string;
  error?: string;
}

export interface OperationLogContext {
  operation: string;
  job_id?: string;
  status?: string;
  actor?: string;
  details?: Record<string, unknown>;
}

// ========== CORE LOGGING ==========

/**
 * Format and output a structured JSON log entry
 */
function outputLog(entry: LogEntry): void {
  const output = JSON.stringify(entry);

  if (entry.level === 'error') {
    console.error(output);
  } else if (entry.level === 'warn') {
    console.warn(output);
  } else {
    console.log(output);
  }
}

/**
 * Create a log entry with standard fields
 */
function createLogEntry(
  level: LogLevel,
  message: string,
  context?: Record<string, unknown>
): LogEntry {
  return {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(context && { context })
  };
}

// ========== PUBLIC API ==========

/**
 * Log an info-level message
 */
export function info(message: string, context?: Record<string, unknown>): void {
  outputLog(createLogEntry('info', message, context));
}

/**
 * Log a warning message
 */
export function warn(message: string, context?: Record<string, unknown>): void {
  outputLog(createLogEntry('warn', message, context));
}

/**
 * Log an error message
 */
export function error(message: string, context?: Record<string, unknown>): void {
  outputLog(createLogEntry('error', message, context));
}

/**
 * Log a debug message (only in development)
 */
export function debug(message: string, context?: Record<string, unknown>): void {
  if (process.env.NODE_ENV !== 'production') {
    outputLog(createLogEntry('debug', message, context));
  }
}

// ========== SPECIALIZED LOGGERS ==========

/**
 * Log an HTTP request/response
 */
export function logRequest(ctx: RequestLogContext): void {
  const message = `${ctx.method} ${ctx.path}`;
  info(message, {
    method: ctx.method,
    path: ctx.path,
    ...(ctx.statusCode && { statusCode: ctx.statusCode }),
    ...(ctx.duration_ms && { duration_ms: ctx.duration_ms }),
    ...(ctx.job_id && { job_id: ctx.job_id }),
    ...(ctx.error && { error: ctx.error })
  });
}

/**
 * Log a business operation (job creation, status change, callback, etc.)
 */
export function logOperation(ctx: OperationLogContext): void {
  const message = ctx.operation;
  info(message, {
    operation: ctx.operation,
    ...(ctx.job_id && { job_id: ctx.job_id }),
    ...(ctx.status && { status: ctx.status }),
    ...(ctx.actor && { actor: ctx.actor }),
    ...(ctx.details && { details: ctx.details })
  });
}

/**
 * Log an error with optional error object details
 */
export function logError(message: string, err?: Error, context?: Record<string, unknown>): void {
  error(message, {
    ...context,
    ...(err && {
      error_name: err.name,
      error_message: err.message,
      ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
    })
  });
}

// ========== DEFAULT EXPORT ==========

const logger = {
  info,
  warn,
  error,
  debug,
  logRequest,
  logOperation,
  logError
};

export default logger;
