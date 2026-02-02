/**
 * Tool Launch Routes
 *
 * Handles secure tool access from LearnWorlds courses
 * Verifies user identity via LearnWorlds API and logs visits
 */

import { Router, Request, Response } from 'express';
import {
  getUserById,
  getUserByEmail,
  logToolVisit,
  getToolStats,
  getToolVisits
} from '../services/learnworlds';
import { isLearnWorldsConfigured } from '../config/learnworlds';

const router = Router();

/**
 * GET /api/tools/launch/:toolSlug
 *
 * Main endpoint for launching tools from LearnWorlds
 * Query params:
 *   - lw_user: LearnWorlds user ID (required)
 *   - email: User email (optional, for fallback verification)
 *   - course: Source course slug (optional, for tracking)
 *   - redirect: URL to redirect to after verification (optional)
 */
router.get('/launch/:toolSlug', async (req: Request, res: Response) => {
  const { toolSlug } = req.params;
  const { lw_user, email, course, redirect } = req.query;

  console.log(`[Tool Launch] Request: ${toolSlug} | user: ${lw_user} | email: ${email}`);

  // Check if LearnWorlds is configured
  if (!isLearnWorldsConfigured()) {
    console.error('[Tool Launch] LearnWorlds not configured');
    return res.status(503).json({
      success: false,
      error: 'LearnWorlds integration not configured'
    });
  }

  // Require at least user ID or email
  if (!lw_user && !email) {
    console.warn('[Tool Launch] No user identification provided');
    return res.status(400).json({
      success: false,
      error: 'Missing user identification. Provide lw_user or email parameter.'
    });
  }

  try {
    // Verify user with LearnWorlds API
    let user = null;

    if (lw_user) {
      user = await getUserById(lw_user as string);
    }

    if (!user && email) {
      user = await getUserByEmail(email as string);
    }

    if (!user) {
      console.warn(`[Tool Launch] User not found: ${lw_user || email}`);
      return res.status(404).json({
        success: false,
        error: 'User not found in LearnWorlds'
      });
    }

    // Log the visit
    const visit = await logToolVisit(toolSlug, user, {
      sourceCourse: course as string,
      ipAddress: req.ip || req.socket.remoteAddress,
      userAgent: req.headers['user-agent']
    });

    console.log(`[Tool Launch] ✓ Verified: ${user.email} accessing ${toolSlug}`);

    // If redirect URL provided, redirect there with user info
    if (redirect) {
      const redirectUrl = new URL(redirect as string);
      redirectUrl.searchParams.set('verified', 'true');
      redirectUrl.searchParams.set('user_id', user.id);
      redirectUrl.searchParams.set('email', user.email);
      if (user.first_name) redirectUrl.searchParams.set('first_name', user.first_name);
      if (user.last_name) redirectUrl.searchParams.set('last_name', user.last_name);
      if (user.fields?.company) redirectUrl.searchParams.set('company', user.fields.company);

      return res.redirect(redirectUrl.toString());
    }

    // Otherwise return JSON response with user info and tool access
    res.json({
      success: true,
      message: 'User verified successfully',
      tool: {
        slug: toolSlug,
        // Tool URL will be constructed by frontend or returned here
        url: `/tools/${toolSlug}`
      },
      user: {
        id: user.id,
        email: user.email,
        name: [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username,
        company: user.fields?.company,
        tags: user.tags
      },
      visit: {
        id: visit._id,
        timestamp: visit.visited_at
      }
    });

  } catch (error) {
    console.error('[Tool Launch] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify user access'
    });
  }
});

/**
 * GET /api/tools/stats/:toolSlug
 *
 * Get visit statistics for a tool (admin endpoint)
 */
router.get('/stats/:toolSlug', async (req: Request, res: Response) => {
  const { toolSlug } = req.params;

  try {
    const stats = await getToolStats(toolSlug);

    res.json({
      success: true,
      tool: toolSlug,
      stats
    });
  } catch (error) {
    console.error('[Tool Stats] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch tool statistics'
    });
  }
});

/**
 * GET /api/tools/visits/:toolSlug
 *
 * Get recent visits for a tool (admin endpoint)
 */
router.get('/visits/:toolSlug', async (req: Request, res: Response) => {
  const { toolSlug } = req.params;
  const limit = parseInt(req.query.limit as string) || 50;

  try {
    const visits = await getToolVisits(toolSlug, limit);

    res.json({
      success: true,
      tool: toolSlug,
      count: visits.length,
      visits
    });
  } catch (error) {
    console.error('[Tool Visits] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch tool visits'
    });
  }
});

export default router;
