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
  validateSlug
} from '../services/toolResponses';
import logger from '../utils/logger';

// Tool Intelligence imports (018-tool-intelligence)
import {
  analyzeSubmission,
  checkAnalysisRateLimit,
  getAnalysisByResponseId,
  generateInputFeedback,
  CourseContext
} from '../services/toolIntelligence';
import { getDB, isConnected } from '../db/connection';
import { DeployedTool } from '../db/models/deployedTool';

// Feature 021: Unified tool collection service (replaces deprecated toolResponses for save/get/stats)
import * as toolCollectionService from '../db/services/toolCollectionService';
import { ToolDefaults, CreateResponseInput } from '../db/models/toolCollection';

// Supabase tool response service V2 (for saving responses to Supabase)
import * as toolResponseService from '../db/supabase/services/toolResponseService_v2';

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

      // Generate visitor ID if not provided
      const visitorId = req.body.visitorId || `anon-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Generate unique response ID
      const responseId = `resp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Build response data for Supabase (matching ToolResponseRow schema)
      const responseData = {
        tool_slug: slug,
        response_id: responseId,
        visitor_id: visitorId,
        user_id: req.body.learnworldsUserId || null,
        user_name: req.body.userName || null,
        user_email: req.body.userEmail || null,
        learnworlds_user_id: req.body.learnworldsUserId || null,
        answers: inputs,  // User's input values
        result: result,   // Calculated result object
        score: result.score || null,
        verdict: result.verdict || null,
        status: 'completed',
        source: req.body.source || 'direct',
        course_id: req.body.courseId || null,
        lesson_id: req.body.lessonId || null,
        referrer: req.body.referrer || null
      };

      // Save response to Supabase
      const savedResponse = await toolResponseService.createResponse(responseData);

      // Return 201 Created (FR-005)
      return res.status(201).json({
        success: true,
        id: savedResponse.id,
        visitorId: visitorId
      });

    } catch (error) {
      logger.logError('Error saving tool response', error as Error, { slug });

      // Check if it's a database connection error
      if ((error as Error).message?.includes('connection') || (error as Error).message?.includes('unavailable')) {
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
      if (!isConnected()) {
        return res.status(503).json({
          success: false,
          error: 'Service temporarily unavailable',
          code: 'DATABASE_UNAVAILABLE'
        });
      }

      // Parse query parameters - page-based pagination
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      // Legacy support: convert skip to page if provided
      const skip = req.query.skip ? parseInt(req.query.skip as string, 10) : undefined;
      const effectivePage = skip !== undefined ? Math.floor(skip / limit) + 1 : page;

      // Validate query parameters
      if (isNaN(limit) || limit < 1 || limit > 100) {
        return res.status(400).json({
          success: false,
          error: 'Invalid "limit" parameter. Must be between 1 and 100.',
          code: 'VALIDATION_ERROR'
        });
      }

      if (isNaN(effectivePage) || effectivePage < 1) {
        return res.status(400).json({
          success: false,
          error: 'Invalid "page" or "skip" parameter.',
          code: 'VALIDATION_ERROR'
        });
      }

      // Feature 021: Get responses from unified collection
      const result = await toolCollectionService.getResponses(slug, { page: effectivePage, limit });

      return res.status(200).json({
        success: true,
        data: result.responses,
        pagination: {
          total: result.pagination.total,
          limit: result.pagination.limit,
          page: result.pagination.page,
          pages: result.pagination.pages,
          hasMore: result.pagination.page < result.pagination.pages
        }
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
      if (!isConnected()) {
        return res.status(503).json({
          success: false,
          error: 'Service temporarily unavailable',
          code: 'DATABASE_UNAVAILABLE'
        });
      }

      // Feature 021: Get statistics from unified collection
      const stats = await toolCollectionService.getStats(slug);

      return res.status(200).json({
        success: true,
        data: {
          totalResponses: stats.totalResponses,
          avgScore: stats.avgScore,
          verdictCounts: stats.verdictCounts
        }
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

// ========== TOOL INTELLIGENCE ENDPOINTS (018-tool-intelligence) ==========

/**
 * Helper: Get tool defaults from unified collection (Feature 021)
 * Replaces the deprecated getDeployedToolBySlug function that queried deployed_tools
 */
async function getToolDefaults(slug: string): Promise<ToolDefaults | null> {
  try {
    return await toolCollectionService.getDefaults(slug);
  } catch (error) {
    logger.logError('Error getting tool defaults', error as Error, { slug });
    return null;
  }
}

/**
 * @deprecated Use getToolDefaults instead (Feature 021)
 * Kept for backward compatibility - returns data in DeployedTool shape
 */
async function getDeployedToolBySlug(slug: string): Promise<DeployedTool | null> {
  try {
    // First try the unified collection (Feature 021)
    const defaults = await toolCollectionService.getDefaults(slug);
    if (defaults) {
      // Map ToolDefaults to DeployedTool shape for backward compatibility
      return {
        tool_id: defaults.tool_id,
        tool_slug: defaults.tool_slug,
        tool_name: defaults.tool_name,
        github_url: defaults.github_url,
        deployed_at: defaults.created_at,
        response_count: 0, // Will be calculated separately if needed
        courseContext: defaults.courseContext,
        qualityGate: defaults.qualityGate
      } as unknown as DeployedTool;
    }

    // Fallback to legacy deployed_tools collection (for tools deployed before Feature 021)
    const db = getDB();
    return await db.collection<DeployedTool>('deployed_tools').findOne({ tool_slug: slug });
  } catch (error) {
    logger.logError('Error getting deployed tool', error as Error, { slug });
    return null;
  }
}

/**
 * Helper: Build course context from tool defaults or deployed tool
 */
function buildCourseContext(tool: DeployedTool | ToolDefaults): CourseContext {
  const ctx = tool.courseContext || {};
  return {
    terminology: ctx.terminology || [],
    frameworks: ctx.frameworks || [],
    expertQuotes: ctx.expertQuotes || [],
    inputRanges: ctx.inputRanges || []
  };
}

// ========== POST /api/tools/:slug/analyze ==========

/**
 * Request AI analysis for a tool submission
 * Feature: 018-tool-intelligence
 *
 * - Checks rate limit (1 analysis per user per tool per 5 minutes)
 * - Gets tool context and input ranges
 * - Generates AI analysis with insights and recommendations
 * - Calculates quality score
 * - Stores analysis for retrieval
 */
router.post(
  '/:slug/analyze',
  validateSlugMiddleware,
  async (req: Request, res: Response) => {
    const { slug } = req.params;

    try {
      // Check database availability
      if (!isConnected()) {
        return res.status(503).json({
          success: false,
          status: 'unavailable',
          message: 'Service temporarily unavailable'
        });
      }

      // Validate required fields
      const { responseId, inputs, verdict, score, userId } = req.body;

      if (!responseId || !inputs || !verdict) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: responseId, inputs, verdict',
          code: 'VALIDATION_ERROR'
        });
      }

      // Check rate limit
      const userIdentifier = userId || req.body.visitorId || 'anonymous';
      const rateLimit = await checkAnalysisRateLimit(slug, userIdentifier);

      if (rateLimit.limited) {
        return res.status(429).json({
          success: false,
          status: 'rate_limited',
          message: 'Please wait before requesting another analysis',
          retryAfter: rateLimit.retryAfter
        });
      }

      // Get deployed tool for context
      const tool = await getDeployedToolBySlug(slug);
      if (!tool) {
        return res.status(404).json({
          success: false,
          error: 'Tool not found',
          code: 'TOOL_NOT_FOUND'
        });
      }

      // Build course context
      const courseContext = buildCourseContext(tool);

      // Get quality threshold
      const qualityThreshold = tool.qualityGate?.enabled
        ? tool.qualityGate.minimumScore
        : 0;

      // Generate analysis
      const analysis = await analyzeSubmission(
        {
          responseId,
          toolSlug: slug,
          inputs,
          verdict,
          score,
          userId: userIdentifier
        },
        courseContext,
        qualityThreshold
      );

      // Return response
      return res.status(200).json({
        success: true,
        analysis: {
          id: analysis._id?.toString(),
          insights: analysis.insights,
          recommendations: analysis.recommendations,
          verdictExplanation: analysis.verdictExplanation,
          qualityScore: analysis.qualityScore,
          courseReferences: analysis.courseReferences,
          generatedAt: analysis.generatedAt.toISOString()
        }
      });

    } catch (error) {
      logger.logError('Error analyzing tool submission', error as Error, { slug });

      return res.status(500).json({
        success: false,
        status: 'unavailable',
        message: 'Analysis temporarily unavailable'
      });
    }
  }
);

// ========== GET /api/tools/:slug/analysis/:responseId ==========

/**
 * Get cached analysis for a response
 * Feature: 018-tool-intelligence
 */
router.get(
  '/:slug/analysis/:responseId',
  validateSlugMiddleware,
  async (req: Request, res: Response) => {
    const { responseId } = req.params;

    try {
      if (!isConnected()) {
        return res.status(503).json({
          success: false,
          error: 'Service temporarily unavailable'
        });
      }

      const analysis = await getAnalysisByResponseId(responseId);

      if (!analysis) {
        return res.status(200).json({
          success: true,
          analysis: null
        });
      }

      return res.status(200).json({
        success: true,
        analysis: {
          id: analysis._id?.toString(),
          insights: analysis.insights,
          recommendations: analysis.recommendations,
          verdictExplanation: analysis.verdictExplanation,
          qualityScore: analysis.qualityScore,
          courseReferences: analysis.courseReferences,
          generatedAt: analysis.generatedAt.toISOString()
        }
      });

    } catch (error) {
      logger.logError('Error getting analysis', error as Error, { responseId });

      return res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
);

// ========== POST /api/tools/:slug/validate-input ==========

/**
 * Get feedback for a single input value
 * Feature: 018-tool-intelligence
 */
router.post(
  '/:slug/validate-input',
  validateSlugMiddleware,
  async (req: Request, res: Response) => {
    const { slug } = req.params;

    try {
      if (!isConnected()) {
        return res.status(503).json({
          success: false,
          error: 'Service temporarily unavailable'
        });
      }

      const { fieldId, value } = req.body;

      if (!fieldId || value === undefined) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: fieldId, value',
          code: 'VALIDATION_ERROR'
        });
      }

      // Get tool for input ranges
      const tool = await getDeployedToolBySlug(slug);
      if (!tool) {
        return res.status(404).json({
          success: false,
          error: 'Tool not found',
          code: 'TOOL_NOT_FOUND'
        });
      }

      const inputRanges = tool.courseContext?.inputRanges || [];
      const feedback = generateInputFeedback(fieldId, value, inputRanges);

      return res.status(200).json({
        success: true,
        feedback
      });

    } catch (error) {
      logger.logError('Error validating input', error as Error, { slug });

      return res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
);

// ========== GET /api/tools/:slug/ranges ==========

/**
 * Get input ranges for a tool
 * Feature: 018-tool-intelligence
 */
router.get(
  '/:slug/ranges',
  validateSlugMiddleware,
  async (req: Request, res: Response) => {
    const { slug } = req.params;

    try {
      if (!isConnected()) {
        return res.status(503).json({
          success: false,
          error: 'Service temporarily unavailable'
        });
      }

      const tool = await getDeployedToolBySlug(slug);
      if (!tool) {
        return res.status(404).json({
          success: false,
          error: 'Tool not found',
          code: 'TOOL_NOT_FOUND'
        });
      }

      return res.status(200).json({
        success: true,
        ranges: tool.courseContext?.inputRanges || []
      });

    } catch (error) {
      logger.logError('Error getting input ranges', error as Error, { slug });

      return res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
);

// ========== GET /api/tools/:slug/context ==========

/**
 * Get full CourseContext for a tool
 * Fix #3: Expose CourseContext via public API
 *
 * Returns the tool's course connection data including:
 * - terminology: Course-specific terms with usage guidance
 * - frameworks: Numbered frameworks extracted from course
 * - expertQuotes: Quotes from course instructors/authors
 * - inputRanges: Expected ranges for numeric inputs
 */
router.get(
  '/:slug/context',
  validateSlugMiddleware,
  async (req: Request, res: Response) => {
    const { slug } = req.params;

    try {
      if (!isConnected()) {
        return res.status(503).json({
          success: false,
          error: 'Service temporarily unavailable'
        });
      }

      const tool = await getDeployedToolBySlug(slug);
      if (!tool) {
        return res.status(404).json({
          success: false,
          error: 'Tool not found',
          code: 'TOOL_NOT_FOUND'
        });
      }

      const courseContext = buildCourseContext(tool);

      return res.status(200).json({
        success: true,
        tool_slug: slug,
        tool_name: tool.tool_name,
        courseContext: {
          terminology: courseContext.terminology,
          frameworks: courseContext.frameworks,
          expertQuotes: courseContext.expertQuotes,
          inputRanges: courseContext.inputRanges
        }
      });

    } catch (error) {
      logger.logError('Error getting course context', error as Error, { slug });

      return res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
);

// ========== GET /api/tools/:slug/analyses (Admin) ==========

/**
 * Get all analyses for a tool (admin only)
 * Feature: 018-tool-intelligence
 */
router.get(
  '/:slug/analyses',
  apiKeyAuthMiddleware,
  validateSlugMiddleware,
  async (req: Request, res: Response) => {
    const { slug } = req.params;

    try {
      if (!isConnected()) {
        return res.status(503).json({
          success: false,
          error: 'Service temporarily unavailable'
        });
      }

      const db = getDB();
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
      const skip = parseInt(req.query.skip as string) || 0;

      // Get analyses for this tool
      const analyses = await db
        .collection('tool_analyses')
        .find({ toolSlug: slug })
        .sort({ generatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray();

      const total = await db
        .collection('tool_analyses')
        .countDocuments({ toolSlug: slug });

      return res.status(200).json({
        success: true,
        data: analyses.map(a => ({
          id: a._id?.toString(),
          responseId: a.responseId?.toString(),
          userId: a.userId,
          insights: a.insights,
          recommendations: a.recommendations,
          verdictExplanation: a.verdictExplanation,
          qualityScore: a.qualityScore,
          courseReferences: a.courseReferences,
          status: a.status,
          generatedAt: a.generatedAt,
          generationDurationMs: a.generationDurationMs,
          tokenUsage: a.tokenUsage
        })),
        pagination: {
          total,
          limit,
          skip,
          hasMore: skip + analyses.length < total
        }
      });

    } catch (error) {
      logger.logError('Error getting analyses', error as Error, { slug });

      return res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
);

// ========== PUT /api/tools/:slug/quality-gate ==========

/**
 * Configure quality gate for a tool (admin only)
 * Feature: 018-tool-intelligence
 */
router.put(
  '/:slug/quality-gate',
  apiKeyAuthMiddleware,
  validateSlugMiddleware,
  async (req: Request, res: Response) => {
    const { slug } = req.params;

    try {
      if (!isConnected()) {
        return res.status(503).json({
          success: false,
          error: 'Service temporarily unavailable'
        });
      }

      const { enabled, minimumScore } = req.body;

      if (typeof enabled !== 'boolean' || typeof minimumScore !== 'number') {
        return res.status(400).json({
          success: false,
          error: 'Invalid request body. Required: enabled (boolean), minimumScore (number)',
          code: 'VALIDATION_ERROR'
        });
      }

      if (minimumScore < 0 || minimumScore > 100) {
        return res.status(400).json({
          success: false,
          error: 'minimumScore must be between 0 and 100',
          code: 'VALIDATION_ERROR'
        });
      }

      // Feature 021: Update quality gate in unified collection
      const updated = await toolCollectionService.updateDefaults(slug, {
        qualityGate: { enabled, minimumScore }
      });

      if (!updated) {
        // Fallback to legacy deployed_tools collection for backward compatibility
        const db = getDB();
        const result = await db.collection<DeployedTool>('deployed_tools').updateOne(
          { tool_slug: slug },
          {
            $set: {
              qualityGate: { enabled, minimumScore }
            }
          }
        );

        if (result.matchedCount === 0) {
          return res.status(404).json({
            success: false,
            error: 'Tool not found',
            code: 'TOOL_NOT_FOUND'
          });
        }
      }

      return res.status(200).json({
        success: true,
        qualityGate: { enabled, minimumScore }
      });

    } catch (error) {
      logger.logError('Error updating quality gate', error as Error, { slug });

      return res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
);

export default router;
