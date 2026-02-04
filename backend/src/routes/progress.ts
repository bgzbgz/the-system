/**
 * Progress Routes
 *
 * API endpoints for user progress tracking across sprints
 */

import express, { Request, Response } from 'express';
import {
  getUserProgress,
  getProgressStats,
  getToolStatus,
  hasToolAccess,
  initializeUserProgress,
} from '../db/supabase/services/progressService';

const router = express.Router();

/**
 * GET /api/users/:userId/progress
 *
 * Get complete progress for a user across all sprints
 * Implements FR-019: API endpoint to retrieve user progress
 */
router.get('/users/:userId/progress', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const progress = await getUserProgress(userId);
    const stats = await getProgressStats(userId);

    res.status(200).json({
      success: true,
      data: {
        progress,
        stats,
      },
    });
  } catch (error: any) {
    console.error('Get user progress error:', error);
    res.status(500).json({
      error: 'Failed to get user progress',
      message: error.message,
    });
  }
});

/**
 * GET /api/users/:userId/progress/stats
 *
 * Get progress statistics summary for a user
 */
router.get('/users/:userId/progress/stats', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const stats = await getProgressStats(userId);

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    console.error('Get progress stats error:', error);
    res.status(500).json({
      error: 'Failed to get progress stats',
      message: error.message,
    });
  }
});

/**
 * GET /api/users/:userId/tools/:slug/status
 *
 * Get progress status for a specific tool
 */
router.get('/users/:userId/tools/:slug/status', async (req: Request, res: Response) => {
  try {
    const { userId, slug } = req.params;

    const status = await getToolStatus(userId, slug);

    if (!status) {
      return res.status(404).json({
        error: 'Tool status not found',
        message: 'No progress record exists for this user and tool',
      });
    }

    res.status(200).json({
      success: true,
      data: status,
    });
  } catch (error: any) {
    console.error('Get tool status error:', error);
    res.status(500).json({
      error: 'Failed to get tool status',
      message: error.message,
    });
  }
});

/**
 * GET /api/users/:userId/tools/:slug/access
 *
 * Check if user has access to a tool
 */
router.get('/users/:userId/tools/:slug/access', async (req: Request, res: Response) => {
  try {
    const { userId, slug } = req.params;

    const hasAccess = await hasToolAccess(userId, slug);

    res.status(200).json({
      success: true,
      data: {
        has_access: hasAccess,
        tool_slug: slug,
      },
    });
  } catch (error: any) {
    console.error('Check tool access error:', error);
    res.status(500).json({
      error: 'Failed to check tool access',
      message: error.message,
    });
  }
});

/**
 * POST /api/users/:userId/progress/initialize
 *
 * Initialize progress for a new user (Sprint 1 unlocked, rest locked)
 */
router.post('/users/:userId/progress/initialize', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const progress = await initializeUserProgress(userId);

    res.status(200).json({
      success: true,
      data: {
        initialized_count: progress.length,
        progress,
      },
    });
  } catch (error: any) {
    console.error('Initialize progress error:', error);
    res.status(500).json({
      error: 'Failed to initialize progress',
      message: error.message,
    });
  }
});

export default router;
