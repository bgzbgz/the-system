/**
 * Field Responses Routes
 *
 * API endpoints for field-by-field response storage
 */

import express, { Request, Response } from 'express';
import {
  saveFieldResponseWithRetry,
  getFieldResponsesByUser,
  changeStatusToSubmitted,
  getResponseCount,
} from '../db/supabase/services/fieldResponseService';
import { markToolAsCompleted, unlockNextTool } from '../db/supabase/services/progressService';

const router = express.Router();

/**
 * POST /api/field-responses
 *
 * Save a single field response (auto-save on blur)
 * Implements FR-017: API endpoint to save individual field responses
 * Implements FR-003: Auto-save with retry logic
 */
router.post('/field-responses', async (req: Request, res: Response) => {
  try {
    const { user_id, tool_slug, field_id, value, status = 'draft' } = req.body;

    // Validation
    if (!user_id || !tool_slug || !field_id || value === undefined) {
      return res.status(400).json({
        error: 'Missing required fields: user_id, tool_slug, field_id, value',
      });
    }

    // Save with retry logic
    const startTime = Date.now();
    const response = await saveFieldResponseWithRetry({
      user_id,
      tool_slug,
      field_id,
      value,
      status,
    });
    const duration_ms = Date.now() - startTime;

    // FR-026: Log field save operation (basic observability)
    console.log(
      JSON.stringify({
        operation: 'field_save',
        user_id,
        tool_slug,
        field_id,
        status: 'success',
        duration_ms,
      })
    );

    res.status(200).json({
      success: true,
      data: response,
      duration_ms,
    });
  } catch (error: any) {
    console.error('Field save error:', error);

    // FR-026: Log failure
    console.log(
      JSON.stringify({
        operation: 'field_save',
        user_id: req.body.user_id,
        tool_slug: req.body.tool_slug,
        field_id: req.body.field_id,
        status: 'failure',
        error: error.message,
      })
    );

    res.status(500).json({
      error: 'Failed to save field response',
      message: error.message,
    });
  }
});

/**
 * GET /api/field-responses
 *
 * Get field responses for a user with optional filters
 * Implements FR-021: Query responses by user_id with filters
 */
router.get('/field-responses', async (req: Request, res: Response) => {
  try {
    const { user_id, tool_slug, field_id, status } = req.query;

    if (!user_id) {
      return res.status(400).json({
        error: 'Missing required parameter: user_id',
      });
    }

    const responses = await getFieldResponsesByUser(user_id as string, {
      tool_slug: tool_slug as string | undefined,
      field_id: field_id as string | undefined,
      status: status as 'draft' | 'submitted' | undefined,
    });

    res.status(200).json({
      success: true,
      data: responses,
      count: responses.length,
    });
  } catch (error: any) {
    console.error('Get field responses error:', error);
    res.status(500).json({
      error: 'Failed to get field responses',
      message: error.message,
    });
  }
});

/**
 * POST /api/tools/:slug/submit
 *
 * Submit a sprint tool - convert all draft responses to submitted
 * Implements FR-004: Convert all drafts to submitted when sprint submitted
 * Implements FR-018: Submit endpoint
 * Implements FR-011: Unlock next tool after submission
 */
router.post('/tools/:slug/submit', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({
        error: 'Missing required field: user_id',
      });
    }

    const startTime = Date.now();

    // Change all draft responses to submitted
    const updatedResponses = await changeStatusToSubmitted(user_id, slug);

    // Mark tool as completed in progress
    await markToolAsCompleted(user_id, slug);

    // Unlock next tool in sequence
    const nextTool = await unlockNextTool(user_id, slug);

    const duration_ms = Date.now() - startTime;

    // FR-026: Log sprint submission (basic observability)
    console.log(
      JSON.stringify({
        operation: 'sprint_submission',
        user_id,
        tool_slug: slug,
        fields_submitted: updatedResponses.length,
        next_tool_unlocked: nextTool?.tool_slug || null,
        status: 'success',
        duration_ms,
      })
    );

    res.status(200).json({
      success: true,
      data: {
        submitted_count: updatedResponses.length,
        next_tool: nextTool
          ? {
              tool_slug: nextTool.tool_slug,
              status: nextTool.status,
            }
          : null,
      },
      duration_ms,
    });
  } catch (error: any) {
    console.error('Submit sprint error:', error);

    // FR-026: Log failure
    console.log(
      JSON.stringify({
        operation: 'sprint_submission',
        user_id: req.body.user_id,
        tool_slug: req.params.slug,
        status: 'failure',
        error: error.message,
      })
    );

    res.status(500).json({
      error: 'Failed to submit sprint',
      message: error.message,
    });
  }
});

/**
 * GET /api/tools/:slug/response-count
 *
 * Get count of responses for a user/tool
 */
router.get('/tools/:slug/response-count', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const { user_id, status } = req.query;

    if (!user_id) {
      return res.status(400).json({
        error: 'Missing required parameter: user_id',
      });
    }

    const count = await getResponseCount(
      user_id as string,
      slug,
      status as 'draft' | 'submitted' | undefined
    );

    res.status(200).json({
      success: true,
      data: { count },
    });
  } catch (error: any) {
    console.error('Get response count error:', error);
    res.status(500).json({
      error: 'Failed to get response count',
      message: error.message,
    });
  }
});

export default router;
// Railway cache bust Thu, Feb  5, 2026  9:09:12 AM
