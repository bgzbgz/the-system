/**
 * Quality API Routes
 * Feature: 020-self-improving-factory
 *
 * Endpoints for quality scoring, dashboard, and trends.
 * Uses Supabase for data storage.
 */

import { Router, Request, Response } from 'express';
import * as qualityStore from '../db/supabase/services/qualityStoreService';
import * as promptVersionStore from '../db/supabase/services/promptVersionService';
import { PromptName, DashboardSummary } from '../services/qualityScoring/types';
import { isSupabaseConfigured } from '../db/supabase/client';

/**
 * Default empty dashboard summary for when Supabase is unavailable
 */
function getEmptyDashboardSummary(days: number): DashboardSummary {
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

  return {
    period: { start: startDate, end: endDate, days },
    total_tools: 0,
    average_score: 0,
    pass_rate: 0,
    score_trend: 'stable',
    criterion_pass_rates: {
      decision: 0,
      zero_questions: 0,
      easy_steps: 0,
      feedback: 0,
      gamification: 0,
      results: 0,
      commitment: 0,
      brand: 0,
    },
    daily_scores: [],
    prompt_performance: [],
  };
}

const router = Router();

// ========== QUALITY SCORES ==========

/**
 * GET /quality/scores/:jobId
 * Get quality score for a specific job (T030)
 */
router.get('/scores/:jobId', async (req: Request, res: Response) => {
  try {
    if (!isSupabaseConfigured()) {
      return res.status(503).json({
        success: false,
        error: 'Quality scoring unavailable (Supabase not configured)',
      });
    }

    const score = await qualityStore.getScoreByJobId(req.params.jobId);

    if (!score) {
      return res.status(404).json({
        success: false,
        error: 'Score not found for this job',
      });
    }

    res.json({ success: true, data: score });
  } catch (error) {
    console.error('[Quality] Error fetching score:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch quality score',
    });
  }
});

// ========== DASHBOARD ==========

/**
 * GET /quality/dashboard
 * Get dashboard summary stats (T031)
 */
router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;

    if (!isSupabaseConfigured()) {
      console.log('[Quality] Supabase not configured, returning empty dashboard');
      return res.json({
        success: true,
        data: getEmptyDashboardSummary(days),
        supabase_available: false,
      });
    }

    const summary = await qualityStore.getDashboardSummary(days);

    res.json({ success: true, data: summary });
  } catch (error) {
    console.error('[Quality] Error fetching dashboard:', error);
    // Return empty data on error instead of 500
    const days = parseInt(req.query.days as string) || 30;
    res.json({
      success: true,
      data: getEmptyDashboardSummary(days),
      error: (error as Error).message,
    });
  }
});

// ========== TRENDS ==========

/**
 * GET /quality/trends
 * Get quality trends time-series data (T032)
 */
router.get('/trends', async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;

    if (!isSupabaseConfigured()) {
      console.log('[Quality] Supabase not configured, returning empty trends');
      return res.json({
        success: true,
        data: { daily: [], criterion_trends: {} },
        supabase_available: false,
      });
    }

    const trends = await qualityStore.getQualityTrends(days);

    res.json({ success: true, data: trends });
  } catch (error) {
    console.error('[Quality] Error fetching trends:', error);
    // Return empty data on error instead of 500
    res.json({
      success: true,
      data: { daily: [], criterion_trends: {} },
      error: (error as Error).message,
    });
  }
});

// ========== PROMPT VERSIONS (T101-T104) ==========

/**
 * GET /prompts/:name/versions
 * Get all versions for a prompt (T101)
 */
router.get('/prompts/:name/versions', async (req: Request, res: Response) => {
  try {
    const promptName = req.params.name as PromptName;

    if (!isSupabaseConfigured()) {
      return res.json({
        success: true,
        data: {
          prompt_name: promptName,
          versions: [],
          active_version: null,
        },
        supabase_available: false,
      });
    }

    const versions = await promptVersionStore.getVersionsByPromptName(promptName);
    const activeVersion = await promptVersionStore.getActiveVersionByPromptName(promptName);

    res.json({
      success: true,
      data: {
        prompt_name: promptName,
        versions,
        active_version: activeVersion?.version || null,
      },
    });
  } catch (error) {
    console.error('[Quality] Error fetching prompt versions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch prompt versions',
    });
  }
});

/**
 * GET /prompts/:name/versions/:version
 * Get a specific version of a prompt (T102)
 */
router.get('/prompts/:name/versions/:version', async (req: Request, res: Response) => {
  try {
    if (!isSupabaseConfigured()) {
      return res.status(503).json({
        success: false,
        error: 'Prompt versions unavailable (Supabase not configured)',
      });
    }

    const promptName = req.params.name as PromptName;
    const version = parseInt(req.params.version);

    const promptVersion = await promptVersionStore.getVersionByNumber(promptName, version);

    if (!promptVersion) {
      return res.status(404).json({
        success: false,
        error: 'Prompt version not found',
      });
    }

    res.json({ success: true, data: promptVersion });
  } catch (error) {
    console.error('[Quality] Error fetching prompt version:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch prompt version',
    });
  }
});

/**
 * POST /prompts/:name/versions
 * Create a new prompt version (T103)
 */
router.post('/prompts/:name/versions', async (req: Request, res: Response) => {
  try {
    if (!isSupabaseConfigured()) {
      return res.status(503).json({
        success: false,
        error: 'Prompt versioning unavailable (Supabase not configured)',
      });
    }

    const promptName = req.params.name as PromptName;
    const { content, author, change_summary } = req.body;

    if (!content) {
      return res.status(400).json({
        success: false,
        error: 'Content is required',
      });
    }

    // Import createPromptVersion from service (using Supabase version)
    const { createPromptVersion } = await import('../services/promptVersioningSupabase');
    const version = await createPromptVersion({
      prompt_name: promptName,
      content,
      author,
      change_summary,
    });

    res.status(201).json({ success: true, data: version });
  } catch (error) {
    console.error('[Quality] Error creating prompt version:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create prompt version',
    });
  }
});

/**
 * PATCH /prompts/:name/versions/:version/activate
 * Set a version as active (T104)
 */
router.patch('/prompts/:name/versions/:version/activate', async (req: Request, res: Response) => {
  try {
    if (!isSupabaseConfigured()) {
      return res.status(503).json({
        success: false,
        error: 'Prompt versioning unavailable (Supabase not configured)',
      });
    }

    const promptName = req.params.name as PromptName;
    const version = parseInt(req.params.version);

    const success = await promptVersionStore.setActiveVersion(promptName, version);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Prompt version not found',
      });
    }

    res.json({ success: true, message: `Version ${version} is now active` });
  } catch (error) {
    console.error('[Quality] Error activating prompt version:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to activate prompt version',
    });
  }
});

export default router;
