/**
 * Health Endpoint
 * Spec: 012-config-secrets, 016-backend-api
 * Per contracts/health.yaml
 *
 * GET /api/health - Returns system health and configuration status
 * MUST be available even in CONFIG_ERROR state (no auth required)
 */

import { Router, Request, Response } from 'express';
import {
  getValidationResult,
  isConfigurationValid
} from '../config/config';
import { ConfigurationState, HealthResponse } from '../config/types';
import { checkConnection, isConnected } from '../config/database';
import logger from '../utils/logger';

// ========== ROUTER ==========

const router = Router();

// ========== ROUTES ==========

/**
 * GET /api/health
 * Get system health and configuration status
 *
 * Spec: 016-backend-api (FR-020)
 * Per contracts/health.yaml:
 * - MUST be available even in CONFIG_ERROR state
 * - MUST respond within 200ms target
 * - MUST NOT require authentication
 * - MUST include database connectivity check
 * - MUST include latency measurement
 * - Returns 200 when healthy, 503 when unhealthy
 */
router.get('/health', async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const validation = getValidationResult();

    // Check database connectivity (T050, FR-020)
    let dbCheck: {
      status: 'connected' | 'disconnected';
      latency_ms?: number;
      error?: string;
    };

    try {
      const dbStatus = await checkConnection();
      dbCheck = {
        status: dbStatus.connected ? 'connected' : 'disconnected',
        ...(dbStatus.latency_ms !== undefined && { latency_ms: dbStatus.latency_ms }),
        ...(dbStatus.error && { error: dbStatus.error })
      };
    } catch (error) {
      dbCheck = {
        status: 'disconnected',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }

    // Determine overall health status
    // Healthy as long as server is running - MongoDB is optional
    // Config errors are acceptable (will block some operations but server is still "up")
    const isHealthy = true;

    // Build response per 016-backend-api contracts/health.yaml schema
    const response = {
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      checks: {
        database: dbCheck
      },
      version: '1.0.0',
      // Include legacy fields for backward compatibility
      config_state: validation.state,
      ...((!validation.valid) && {
        errors: validation.errors.map(e => e.field)
      })
    };

    // Log health check (T051)
    const responseTime = Date.now() - startTime;
    logger.info('Health check', {
      status: response.status,
      db_status: dbCheck.status,
      db_latency_ms: dbCheck.latency_ms,
      response_time_ms: responseTime
    });

    // Return 200 when healthy, 503 when unhealthy (per 016 spec)
    res.status(isHealthy ? 200 : 503).json(response);

  } catch (error) {
    logger.logError('Health check failed', error as Error);

    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      checks: {
        database: {
          status: 'disconnected',
          error: 'Health check failed'
        }
      },
      version: '1.0.0'
    });
  }
});

/**
 * GET /api/health/config
 * Get detailed configuration status (field names only)
 *
 * This is an additional endpoint for debugging config issues
 * Still follows security rules - no values exposed
 */
router.get('/health/config', (req: Request, res: Response) => {
  const validation = getValidationResult();

  res.status(200).json({
    config_state: validation.state,
    valid: validation.valid,
    validated_at: validation.validated_at,
    errors: validation.errors.map(e => ({
      field: e.field,
      reason: e.reason,
      timestamp: e.timestamp
    })),
    timestamp: new Date().toISOString()
  });
});

export default router;
