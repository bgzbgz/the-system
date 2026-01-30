/**
 * Tool Response API - Tools Routes
 * Spec: 026-tool-response-api
 * Per contracts/tools-api.yaml
 *
 * Endpoints for deployed tools to save and retrieve user responses
 */

import { Router, Request, Response } from 'express';
import { apiKeyAuthMiddleware } from '../middleware/apiKeyAuth';
import {
  validateSlug,
  saveResponse,
  getResponses,
  getStats,
  checkRateLimit,
  getToolCollection,
  isDatabaseAvailable,
  SaveResponseInput
} from '../services/toolResponses';
import logger from '../utils/logger';

const router = Router();

// ========== PAYLOAD SIZE LIMIT ==========

// Apply 100KB limit to tools routes (FR-011)
import * as express from 'express';
router.use(express.json({ limit: '100kb' }));

// ========== SLUG VALIDATION MIDDLEWARE ==========

/**
 * Validate tool slug format
 * Per FR-003: lowercase alphanumeric with hyphens only
 */
function validateSlugMiddleware(req: Request, res: Response, next: Function): void {
  const { slug } = req.params;

  if (!validateSlug(slug)) {
    res.status(400).json({
      success: false,
      error: 'Invalid tool slug format. Must be lowercase alphanumeric with hyphens only, max 100 chars.',
      code: 'INVALID_SLUG'
    });
    return;
  }

  next();
}

// ========== POST /api/tools/:slug/responses ==========

/**
 * Save a tool response
 * Per FR-001, FR-002, FR-004, FR-005, FR-006, FR-007, FR-010, FR-011
 *
 * - Validates slug format (FR-003)
 * - Validates required fields: inputs, result (FR-007)
 * - Generates visitorId if not provided (FR-004)
 * - Checks rate limit (FR-010)
 * - Saves to tool-specific collection (FR-002)
 * - Returns 201 with document ID (FR-005)
 */
router.post(
  '/:slug/responses',
  validateSlugMiddleware,
  async (req: Request, res: Response) => {
    const { slug } = req.params;

    try {
      // Check database availability (edge case: MongoDB unavailable)
      if (!isDatabaseAvailable()) {
        logger.logError('Database unavailable for tool response', new Error('MongoDB not connected'));
        return res.status(503).json({
          success: false,
          error: 'Service temporarily unavailable',
          code: 'DATABASE_UNAVAILABLE'
        });
      }

      // Validate required fields (FR-007)
      const { inputs, result } = req.body;

      if (!inputs || typeof inputs !== 'object') {
        return res.status(400).json({
          success: false,
          error: 'Missing or invalid "inputs" field. Must be an object.',
          code: 'VALIDATION_ERROR'
        });
      }

      if (!result || typeof result !== 'object') {
        return res.status(400).json({
          success: false,
          error: 'Missing or invalid "result" field. Must be an object.',
          code: 'VALIDATION_ERROR'
        });
      }

      // Check rate limit (FR-010)
      const visitorId = req.body.visitorId;
      if (visitorId) {
        const collection = await getToolCollection(slug);
        const isRateLimited = await checkRateLimit(collection, visitorId);

        if (isRateLimited) {
          return res.status(429).json({
            success: false,
            error: 'Rate limit exceeded. Maximum 10 requests per minute.',
            code: 'RATE_LIMIT_EXCEEDED'
          });
        }
      }

      // Build input from request body
      const input: SaveResponseInput = {
        // User Identity
        visitorId: req.body.visitorId,
        userName: req.body.userName,
        userEmail: req.body.userEmail,
        learnworldsUserId: req.body.learnworldsUserId,

        // Tool Data
        inputs: req.body.inputs,
        result: req.body.result,

        // Context
        source: req.body.source,
        courseId: req.body.courseId,
        lessonId: req.body.lessonId,
        referrer: req.body.referrer || req.headers.referer,

        // Metadata
        completedAt: req.body.completedAt ? new Date(req.body.completedAt) : undefined,
        toolVersion: req.body.toolVersion,
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip || req.socket?.remoteAddress
      };

      // Save response (FR-001, FR-002, FR-004, FR-005)
      const saveResult = await saveResponse(slug, input);

      // Return 201 Created (FR-005)
      return res.status(201).json({
        success: true,
        id: saveResult.id,
        visitorId: saveResult.visitorId
      });

    } catch (error) {
      logger.logError('Error saving tool response', error as Error, { slug });

      // Check if it's a MongoDB connection error
      if ((error as Error).message?.includes('not connected')) {
        return res.status(503).json({
          success: false,
          error: 'Service temporarily unavailable',
          code: 'DATABASE_UNAVAILABLE'
        });
      }

      return res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }
);

// ========== GET /api/tools/:slug/responses ==========

/**
 * Retrieve tool responses
 * Per FR-008, FR-012, FR-013
 *
 * - Requires API key authentication (FR-012, FR-013)
 * - Supports pagination (limit, skip)
 * - Supports visitorId filter
 * - Returns sorted by most recent first
 */
router.get(
  '/:slug/responses',
  apiKeyAuthMiddleware,
  validateSlugMiddleware,
  async (req: Request, res: Response) => {
    const { slug } = req.params;

    try {
      // Check database availability
      if (!isDatabaseAvailable()) {
        return res.status(503).json({
          success: false,
          error: 'Service temporarily unavailable',
          code: 'DATABASE_UNAVAILABLE'
        });
      }

      // Parse query parameters
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      const skip = req.query.skip ? parseInt(req.query.skip as string, 10) : 0;
      const visitorId = req.query.visitorId as string | undefined;

      // Validate query parameters
      if (isNaN(limit) || limit < 1 || limit > 100) {
        return res.status(400).json({
          success: false,
          error: 'Invalid "limit" parameter. Must be between 1 and 100.',
          code: 'VALIDATION_ERROR'
        });
      }

      if (isNaN(skip) || skip < 0) {
        return res.status(400).json({
          success: false,
          error: 'Invalid "skip" parameter. Must be 0 or greater.',
          code: 'VALIDATION_ERROR'
        });
      }

      // Get responses
      const result = await getResponses(slug, { limit, skip, visitorId });

      return res.status(200).json({
        success: true,
        data: result.data,
        pagination: result.pagination
      });

    } catch (error) {
      logger.logError('Error retrieving tool responses', error as Error, { slug });

      if ((error as Error).message?.includes('not connected')) {
        return res.status(503).json({
          success: false,
          error: 'Service temporarily unavailable',
          code: 'DATABASE_UNAVAILABLE'
        });
      }

      return res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }
);

// ========== GET /api/tools/:slug/stats ==========

/**
 * Get tool statistics
 * Per FR-009, FR-012, FR-013
 *
 * - Requires API key authentication (FR-012, FR-013)
 * - Returns aggregate statistics (total, unique visitors, avg score)
 */
router.get(
  '/:slug/stats',
  apiKeyAuthMiddleware,
  validateSlugMiddleware,
  async (req: Request, res: Response) => {
    const { slug } = req.params;

    try {
      // Check database availability
      if (!isDatabaseAvailable()) {
        return res.status(503).json({
          success: false,
          error: 'Service temporarily unavailable',
          code: 'DATABASE_UNAVAILABLE'
        });
      }

      // Get statistics
      const stats = await getStats(slug);

      return res.status(200).json({
        success: true,
        data: stats
      });

    } catch (error) {
      logger.logError('Error retrieving tool stats', error as Error, { slug });

      if ((error as Error).message?.includes('not connected')) {
        return res.status(503).json({
          success: false,
          error: 'Service temporarily unavailable',
          code: 'DATABASE_UNAVAILABLE'
        });
      }

      return res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }
);

export default router;
