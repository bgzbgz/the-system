/**
 * Configuration & Secrets - Error Types
 * Spec: 012-config-secrets
 * Per contracts/errors.yaml
 *
 * All error messages are specific and actionable per FR-021
 */

// ========== ERROR CODES ==========

/**
 * Configuration error codes
 * Per contracts/errors.yaml x-error-codes.configuration
 */
export enum ConfigErrorCode {
  /** FACTORY_WEBHOOK_URL is missing or empty */
  FACTORY_WEBHOOK_NOT_CONFIGURED = 'FACTORY_WEBHOOK_NOT_CONFIGURED',
  /** DEPLOY_WEBHOOK_URL is missing or empty */
  DEPLOY_WEBHOOK_NOT_CONFIGURED = 'DEPLOY_WEBHOOK_NOT_CONFIGURED',
  /** CALLBACK_SECRET is missing or empty */
  CALLBACK_SECRET_NOT_CONFIGURED = 'CALLBACK_SECRET_NOT_CONFIGURED'
}

/**
 * Runtime error codes
 * Per contracts/errors.yaml x-error-codes.runtime
 */
export enum RuntimeErrorCode {
  /** Factory webhook returned non-200 */
  FACTORY_WEBHOOK_ERROR = 'FACTORY_WEBHOOK_ERROR',
  /** Deployment webhook returned non-200 */
  DEPLOY_WEBHOOK_ERROR = 'DEPLOY_WEBHOOK_ERROR',
  /** Factory webhook timeout */
  FACTORY_WEBHOOK_TIMEOUT = 'FACTORY_WEBHOOK_TIMEOUT',
  /** Deployment webhook timeout */
  DEPLOY_WEBHOOK_TIMEOUT = 'DEPLOY_WEBHOOK_TIMEOUT'
}

/**
 * Authentication error codes
 * Per contracts/errors.yaml x-error-codes.authentication
 */
export enum AuthErrorCode {
  /** No authentication header provided */
  CALLBACK_AUTH_MISSING = 'CALLBACK_AUTH_MISSING',
  /** Authentication header invalid */
  CALLBACK_AUTH_INVALID = 'CALLBACK_AUTH_INVALID'
}

// ========== ERROR MESSAGES ==========

/**
 * Configuration error messages - specific and actionable
 * Per contracts/errors.yaml and FR-021
 */
export const CONFIG_ERROR_MESSAGES: Record<ConfigErrorCode, string> = {
  [ConfigErrorCode.FACTORY_WEBHOOK_NOT_CONFIGURED]: 'Factory webhook URL not configured',
  [ConfigErrorCode.DEPLOY_WEBHOOK_NOT_CONFIGURED]: 'Deployment webhook URL not configured',
  [ConfigErrorCode.CALLBACK_SECRET_NOT_CONFIGURED]: 'Callback authentication secret not configured'
};

/**
 * Runtime error messages - specific and actionable
 * Per contracts/errors.yaml
 */
export const RUNTIME_ERROR_MESSAGES: Record<RuntimeErrorCode, string> = {
  [RuntimeErrorCode.FACTORY_WEBHOOK_ERROR]: 'Factory webhook returned {status}',
  [RuntimeErrorCode.DEPLOY_WEBHOOK_ERROR]: 'Deployment webhook returned {status}',
  [RuntimeErrorCode.FACTORY_WEBHOOK_TIMEOUT]: 'Unable to reach Factory. Check your connection.',
  [RuntimeErrorCode.DEPLOY_WEBHOOK_TIMEOUT]: 'Unable to reach Deployment service. Check your connection.'
};

/**
 * Authentication error messages - generic for security
 * Per contracts/callback-auth.yaml x-security.secret_exposure_prevention
 */
export const AUTH_ERROR_MESSAGES: Record<AuthErrorCode, string> = {
  [AuthErrorCode.CALLBACK_AUTH_MISSING]: 'Callback authentication required',
  [AuthErrorCode.CALLBACK_AUTH_INVALID]: 'Invalid callback signature'
};

// ========== HTTP STATUS CODES ==========

/**
 * HTTP status codes for error types
 * Per contracts/errors.yaml x-error-codes
 */
export const ERROR_HTTP_STATUS: Record<ConfigErrorCode | RuntimeErrorCode | AuthErrorCode, number> = {
  // Configuration errors - 503 Service Unavailable
  [ConfigErrorCode.FACTORY_WEBHOOK_NOT_CONFIGURED]: 503,
  [ConfigErrorCode.DEPLOY_WEBHOOK_NOT_CONFIGURED]: 503,
  [ConfigErrorCode.CALLBACK_SECRET_NOT_CONFIGURED]: 503,
  // Runtime errors - 502 Bad Gateway or 504 Gateway Timeout
  [RuntimeErrorCode.FACTORY_WEBHOOK_ERROR]: 502,
  [RuntimeErrorCode.DEPLOY_WEBHOOK_ERROR]: 502,
  [RuntimeErrorCode.FACTORY_WEBHOOK_TIMEOUT]: 504,
  [RuntimeErrorCode.DEPLOY_WEBHOOK_TIMEOUT]: 504,
  // Authentication errors - 401 Unauthorized
  [AuthErrorCode.CALLBACK_AUTH_MISSING]: 401,
  [AuthErrorCode.CALLBACK_AUTH_INVALID]: 401
};

// ========== ERROR CLASSES ==========

/**
 * Base configuration error class
 */
export class ConfigError extends Error {
  public readonly code: ConfigErrorCode;
  public readonly field: string;
  public readonly httpStatus: number;

  constructor(code: ConfigErrorCode, field: string) {
    super(CONFIG_ERROR_MESSAGES[code]);
    this.name = 'ConfigError';
    this.code = code;
    this.field = field;
    this.httpStatus = ERROR_HTTP_STATUS[code];
  }

  toJSON() {
    return {
      error: this.message,
      code: this.code,
      field: this.field,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Runtime webhook error class
 */
export class WebhookError extends Error {
  public readonly code: RuntimeErrorCode;
  public readonly statusCode?: number;
  public readonly httpStatus: number;
  public readonly retryable: boolean;

  constructor(code: RuntimeErrorCode, statusCode?: number) {
    const message = RUNTIME_ERROR_MESSAGES[code].replace('{status}', statusCode?.toString() || 'unknown');
    super(message);
    this.name = 'WebhookError';
    this.code = code;
    this.statusCode = statusCode;
    this.httpStatus = ERROR_HTTP_STATUS[code];
    this.retryable = true; // All runtime errors are retryable per spec
  }

  toJSON() {
    return {
      error: this.message,
      code: this.code,
      status_code: this.statusCode,
      retryable: this.retryable,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Callback authentication error class
 */
export class CallbackAuthError extends Error {
  public readonly code: AuthErrorCode;
  public readonly httpStatus: number;
  public readonly auditLogged: boolean;

  constructor(code: AuthErrorCode) {
    super(AUTH_ERROR_MESSAGES[code]);
    this.name = 'CallbackAuthError';
    this.code = code;
    this.httpStatus = ERROR_HTTP_STATUS[code];
    this.auditLogged = true; // All auth failures are audit logged per FR-016
  }

  toJSON() {
    return {
      error: this.message,
      code: this.code,
      audit_logged: this.auditLogged,
      timestamp: new Date().toISOString()
    };
  }
}

// ========== BLOCKING MESSAGE ==========

/**
 * Blocking message shown when system is in CONFIG_ERROR state
 * Per contracts/startup.yaml x-error-messages.startup_block
 */
export const CONFIG_BLOCKING_MESSAGE = 'Boss Office is not configured. Fix configuration before proceeding.';
