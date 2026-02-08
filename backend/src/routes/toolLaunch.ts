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
import { getToolDefault } from '../db/supabase/services/toolDefaultService';

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

    // Build user params to append to tool URL
    const userParams = new URLSearchParams();
    userParams.set('user_id', user.id);
    userParams.set('email', user.email);
    const userName = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username;
    if (userName) userParams.set('name', userName);
    if (user.fields?.company) userParams.set('company', user.fields.company);
    if (course) userParams.set('course', course as string);

    // If explicit redirect URL provided, use it
    if (redirect) {
      const redirectUrl = new URL(redirect as string);
      userParams.forEach((val, key) => redirectUrl.searchParams.set(key, val));
      return res.redirect(redirectUrl.toString());
    }

    // Auto-redirect: look up tool's deployed URL from tool_defaults
    try {
      const toolDefault = await getToolDefault(toolSlug);
      if (toolDefault?.github_url) {
        const toolUrl = new URL(toolDefault.github_url);
        userParams.forEach((val, key) => toolUrl.searchParams.set(key, val));
        console.log(`[Tool Launch] Redirecting to: ${toolUrl.toString()}`);
        return res.redirect(toolUrl.toString());
      }
    } catch (lookupErr) {
      console.warn(`[Tool Launch] Could not look up deployed URL for ${toolSlug}:`, lookupErr);
    }

    // Fallback: return JSON if no deployed URL found (or ?format=json)
    res.json({
      success: true,
      message: 'User verified successfully',
      tool: {
        slug: toolSlug,
        url: `/tools/${toolSlug}`
      },
      user: {
        id: user.id,
        email: user.email,
        name: userName,
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
