/**
 * Configuration & Secrets - Config Guard Middleware
 * Spec: 012-config-secrets
 * Per contracts/startup.yaml blocking behavior
 *
 * Blocks requests when ConfigurationState is CONFIG_ERROR
 */

import { Request, Response, NextFunction } from 'express';
import {
  isConfigurationValid,
  getMissingConfigFields
} from '../config/config';
import { CONFIG_BLOCKING_MESSAGE } from '../config/errors';

// ========== MIDDLEWARE ==========

/**
 * Configuration guard middleware
 * Blocks requests when system is in CONFIG_ERROR state
 *
 * Per contracts/startup.yaml x-startup-rules.blocking_behavior:
 * - Returns 503 Service Unavailable
 * - Includes specific error message
 * - Lists missing field names (not values)
 *
 * @param req - Express request
 * @param res - Express response
 * @param next - Next middleware function
 */
export function configGuard(req: Request, res: Response, next: NextFunction): void {
  if (isConfigurationValid()) {
    // Configuration valid - proceed normally
    next();
    return;
  }

  // Configuration error - block the request
  const missingFields = getMissingConfigFields();

  res.status(503).json({
    error: CONFIG_BLOCKING_MESSAGE,
    code: 'CONFIG_ERROR',
    missing_fields: missingFields,
    timestamp: new Date().toISOString()
  });
}

/**
 * Factory-specific configuration guard
 * Blocks factory-related operations when FACTORY_WEBHOOK_URL is not configured
 *
 * @param req - Express request
 * @param res - Express response
 * @param next - Next middleware function
 */
export function factoryConfigGuard(req: Request, res: Response, next: NextFunction): void {
  const missingFields = getMissingConfigFields();

  if (missingFields.includes('FACTORY_WEBHOOK_URL')) {
    res.status(503).json({
      error: 'Factory webhook URL not configured',
      code: 'FACTORY_WEBHOOK_NOT_CONFIGURED',
      field: 'FACTORY_WEBHOOK_URL',
      timestamp: new Date().toISOString()
    });
    return;
  }

  next();
}

/**
 * Deployment-specific configuration guard
 * Blocks deployment operations when DEPLOY_WEBHOOK_URL is not configured
 *
 * @param req - Express request
 * @param res - Express response
 * @param next - Next middleware function
 */
export function deployConfigGuard(req: Request, res: Response, next: NextFunction): void {
  const missingFields = getMissingConfigFields();

  if (missingFields.includes('DEPLOY_WEBHOOK_URL')) {
    res.status(503).json({
      error: 'Deployment webhook URL not configured',
      code: 'DEPLOY_WEBHOOK_NOT_CONFIGURED',
      field: 'DEPLOY_WEBHOOK_URL',
      timestamp: new Date().toISOString()
    });
    return;
  }

  next();
}

export default configGuard;
