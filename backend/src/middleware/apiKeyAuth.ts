/**
 * Tool Response API - API Key Authentication Middleware
 * Spec: 026-tool-response-api
 * Per contracts/tools-api.yaml
 *
 * Validates X-API-Key header for protected GET endpoints
 * SECURITY: Uses timing-safe comparison (per SR-004)
 * SECURITY: Never logs secret values (per SR-001)
 */

import { Request, Response, NextFunction } from 'express';
import { timingSafeEqual } from 'crypto';

// ========== TYPES ==========

/**
 * Extended request with API key auth result
 */
export interface ApiKeyAuthenticatedRequest extends Request {
  apiKeyValid?: boolean;
}

// ========== CONFIGURATION ==========

/**
 * Get BOSS_API_KEY from environment
 * SECURITY: Use only for comparison, NEVER log
 *
 * @returns API key or undefined if not configured
 */
function getBossApiKey(): string | undefined {
  return process.env.BOSS_API_KEY;
}

// ========== AUTHENTICATION ==========

/**
 * Validate API key using timing-safe comparison
 * Per contracts/tools-api.yaml x-security.timing_attack_prevention
 *
 * SECURITY: Uses crypto.timingSafeEqual to prevent timing attacks
 *
 * @param provided - The key from X-API-Key header
 * @param expected - The configured BOSS_API_KEY
 * @returns true if keys match
 */
function validateApiKeyTimingSafe(provided: string, expected: string): boolean {
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

// ========== MIDDLEWARE ==========

/**
 * API Key authentication middleware
 * Per contracts/tools-api.yaml security requirements
 *
 * Checks X-API-Key header against configured BOSS_API_KEY
 * Returns 401 if missing or invalid
 *
 * @param req - Express request
 * @param res - Express response
 * @param next - Next middleware function
 */
export function apiKeyAuthMiddleware(
  req: ApiKeyAuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  // Extract X-API-Key header
  const providedKey = req.headers['x-api-key'] as string | undefined;

  // Check if header is provided
  if (!providedKey) {
    console.log('[ApiKeyAuth] Authentication failed: Missing X-API-Key header');
    res.status(401).json({
      success: false,
      error: 'Missing API key',
      code: 'API_KEY_MISSING'
    });
    return;
  }

  // Get configured key
  const expectedKey = getBossApiKey();
  if (!expectedKey) {
    // Key not configured - cannot authenticate
    console.log('[ApiKeyAuth] Authentication failed: BOSS_API_KEY not configured');
    res.status(401).json({
      success: false,
      error: 'API key authentication not configured',
      code: 'API_KEY_NOT_CONFIGURED'
    });
    return;
  }

  // Timing-safe comparison
  const isValid = validateApiKeyTimingSafe(providedKey, expectedKey);

  if (!isValid) {
    console.log('[ApiKeyAuth] Authentication failed: Invalid API key');
    res.status(401).json({
      success: false,
      error: 'Invalid API key',
      code: 'API_KEY_INVALID'
    });
    return;
  }

  // Authentication successful
  req.apiKeyValid = true;
  next();
}

export default apiKeyAuthMiddleware;
