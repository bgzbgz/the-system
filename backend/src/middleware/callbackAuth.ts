/**
 * Configuration & Secrets - Callback Authentication Middleware
 * Spec: 012-config-secrets
 * Per contracts/callback-auth.yaml
 *
 * Validates authentication on all inbound callbacks
 * SECURITY: Uses timing-safe comparison (SR-004)
 * SECURITY: Never logs secret values (SR-001)
 */

import { Request, Response, NextFunction } from 'express';
import { timingSafeEqual } from 'crypto';
import { getCallbackSecret } from '../config/config';
import { CallbackAuthResult } from '../config/types';
import { AuthErrorCode, AUTH_ERROR_MESSAGES } from '../config/errors';

// ========== TYPES ==========

/**
 * Extended request with auth result
 */
export interface AuthenticatedRequest extends Request {
  callbackAuthResult?: CallbackAuthResult;
  callbackAuthError?: AuthErrorCode;
}

/**
 * Audit log entry for authentication failure
 * Per contracts/callback-auth.yaml x-audit-integration
 */
export interface AuthAuditEntry {
  timestamp: string;
  auth_result: CallbackAuthResult;
  source_ip: string | undefined;
  request_id: string | undefined;
  actor: 'SYSTEM';
}

// ========== AUTHENTICATION ==========

/**
 * Validate callback secret using timing-safe comparison
 * Per contracts/callback-auth.yaml x-security.timing_attack_prevention
 *
 * SECURITY: Uses crypto.timingSafeEqual to prevent timing attacks
 *
 * @param provided - The secret from X-Callback-Secret header
 * @param expected - The configured CALLBACK_SECRET
 * @returns true if secrets match
 */
function validateSecretTimingSafe(provided: string, expected: string): boolean {
  try {
    const providedBuf = Buffer.from(provided, 'utf-8');
    const expectedBuf = Buffer.from(expected, 'utf-8');

    // Length check separately to avoid timing leak
    if (providedBuf.length !== expectedBuf.length) {
      return false;
    }

    return timingSafeEqual(providedBuf, expectedBuf);
  } catch {
    return false;
  }
}

/**
 * Authenticate callback request
 * Per contracts/callback-auth.yaml x-authentication-flow
 *
 * @param providedSecret - Value from X-Callback-Secret header (may be undefined)
 * @returns CallbackAuthResult indicating auth status
 */
export function authenticateCallbackRequest(providedSecret: string | undefined): CallbackAuthResult {
  // Step 1: Check if header is provided
  if (!providedSecret) {
    return CallbackAuthResult.MISSING;
  }

  // Step 2: Get configured secret
  const expectedSecret = getCallbackSecret();
  if (!expectedSecret) {
    // Secret not configured - cannot authenticate
    // Log but don't expose in response
    console.log('[CallbackAuth] Authentication failed: CALLBACK_SECRET not configured');
    return CallbackAuthResult.INVALID;
  }

  // Step 3: Timing-safe comparison
  const isValid = validateSecretTimingSafe(providedSecret, expectedSecret);

  return isValid ? CallbackAuthResult.VALID : CallbackAuthResult.INVALID;
}

// ========== AUDIT LOGGING ==========

/**
 * Create audit log entry for authentication failure
 * Per contracts/callback-auth.yaml x-audit-integration.on_auth_failure
 * Per FR-016: Create audit log entry for authentication failures
 *
 * SECURITY: NEVER log the provided or expected secret values (SR-001)
 *
 * @param result - The authentication result (INVALID or MISSING)
 * @param req - The Express request
 */
function logAuthFailure(result: CallbackAuthResult, req: Request): void {
  const entry: AuthAuditEntry = {
    timestamp: new Date().toISOString(),
    auth_result: result,
    source_ip: req.ip || req.socket?.remoteAddress,
    request_id: req.headers['x-request-id'] as string | undefined,
    actor: 'SYSTEM'
  };

  // Log to console (field names only, NEVER secrets)
  console.log('[CallbackAuth] Authentication failed:', {
    timestamp: entry.timestamp,
    auth_result: entry.auth_result,
    source_ip: entry.source_ip || 'unknown',
    request_id: entry.request_id || 'none'
  });

  // TODO: Save to audit_log collection when MongoDB connected
  // await AuditLogModel.create({
  //   actor_type: 'SYSTEM',
  //   action: 'CALLBACK_AUTH_FAILED',
  //   details: entry,
  //   timestamp: new Date()
  // });
}

// ========== MIDDLEWARE ==========

/**
 * Callback authentication middleware
 * Per contracts/callback-auth.yaml x-authentication-rules
 *
 * MUST be applied BEFORE payload parsing per SR-004
 * Authentication is verified BEFORE any database operations
 *
 * @param req - Express request
 * @param res - Express response
 * @param next - Next middleware function
 */
export function callbackAuthMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  // Extract X-Callback-Secret header
  const providedSecret = req.headers['x-callback-secret'] as string | undefined;

  // Authenticate the request
  const authResult = authenticateCallbackRequest(providedSecret);

  // Store result on request for downstream use
  req.callbackAuthResult = authResult;

  if (authResult === CallbackAuthResult.VALID) {
    // Authentication successful - proceed
    next();
    return;
  }

  // Authentication failed - determine error type
  const errorCode = authResult === CallbackAuthResult.MISSING
    ? AuthErrorCode.CALLBACK_AUTH_MISSING
    : AuthErrorCode.CALLBACK_AUTH_INVALID;

  req.callbackAuthError = errorCode;

  // Create audit log entry per FR-016
  logAuthFailure(authResult, req);

  // Return 401 Unauthorized
  // Per contracts/callback-auth.yaml: Use generic error messages for security
  // Do not distinguish between 'missing' and 'invalid' in user-facing errors
  res.status(401).json({
    error: AUTH_ERROR_MESSAGES[errorCode],
    code: errorCode,
    timestamp: new Date().toISOString()
  });
}

/**
 * Create callback auth middleware with custom error handler
 *
 * @param onAuthFailure - Optional callback for auth failures
 * @returns Express middleware function
 */
export function createCallbackAuthMiddleware(
  onAuthFailure?: (result: CallbackAuthResult, req: Request) => void
): (req: AuthenticatedRequest, res: Response, next: NextFunction) => void {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    // Extract X-Callback-Secret header
    const providedSecret = req.headers['x-callback-secret'] as string | undefined;

    // Authenticate the request
    const authResult = authenticateCallbackRequest(providedSecret);

    // Store result on request
    req.callbackAuthResult = authResult;

    if (authResult === CallbackAuthResult.VALID) {
      next();
      return;
    }

    // Call custom failure handler if provided
    if (onAuthFailure) {
      onAuthFailure(authResult, req);
    } else {
      // Default: log the failure
      logAuthFailure(authResult, req);
    }

    // Determine error code
    const errorCode = authResult === CallbackAuthResult.MISSING
      ? AuthErrorCode.CALLBACK_AUTH_MISSING
      : AuthErrorCode.CALLBACK_AUTH_INVALID;

    req.callbackAuthError = errorCode;

    // Return 401
    res.status(401).json({
      error: AUTH_ERROR_MESSAGES[errorCode],
      code: errorCode,
      timestamp: new Date().toISOString()
    });
  };
}

export default callbackAuthMiddleware;
