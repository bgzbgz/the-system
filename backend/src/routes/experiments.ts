/**
 * Experiments API Routes
 * Feature: 020-self-improving-factory
 *
 * Endpoints for A/B testing management.
 */

import { Router, Request, Response } from 'express';
import * as experimentStore from '../db/services/experimentStore';
import * as promptVersionStore from '../db/services/promptVersionStore';
import {
  calculateABResults,
  updateTestResultsAndCheck,
} from '../services/abTesting';
import {
  ABTest,
  ABTestStatus,
  CreateABTestRequest,
  PromptName,
} from '../services/qualityScoring/types';

const router = Router();

// Default test configuration
const DEFAULT_CONFIG = {
  min_samples_per_variant: 10,
  significance_threshold: 0.05,
  auto_adopt: false,
  min_improvement: 10,
};

// ========== LIST EXPERIMENTS ==========

/**
 * GET /experiments
 * List all A/B tests (T079)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const status = req.query.status as ABTestStatus | undefined;
    const promptName = req.query.prompt_name as PromptName | undefined;
    const limit = parseInt(req.query.limit as string) || 50;

    const tests = await experimentStore.getABTests({ status, promptName, limit });

    res.json({
      success: true,
      data: {
        tests,
        count: tests.length,
      },
    });
  } catch (error) {
    console.error('[Experiments] Error fetching experiments:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch experiments',
    });
  }
});

// ========== CREATE EXPERIMENT ==========

/**
 * POST /experiments
 * Create a new A/B test (T080)
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      name,
      prompt_name,
      variant_b_version_id,
      variant_b_description,
      config,
    } = req.body as CreateABTestRequest;

    // Validate required fields
    if (!name || !prompt_name || !variant_b_version_id) {
      return res.status(400).json({
        success: false,
        error: 'name, prompt_name, and variant_b_version_id are required',
      });
    }

    // Get current active version for variant A
    const activeVersion = await promptVersionStore.getActiveVersionByPromptName(prompt_name);
    if (!activeVersion) {
      return res.status(400).json({
        success: false,
        error: `No active version found for prompt: ${prompt_name}`,
      });
    }

    // Verify variant B version exists
    const variantBVersion = await promptVersionStore.getPromptVersionById(variant_b_version_id);
    if (!variantBVersion) {
      return res.status(400).json({
        success: false,
        error: `Variant B version not found: ${variant_b_version_id}`,
      });
    }

    // Create test
    const test: Omit<ABTest, '_id'> = {
      name,
      prompt_name,
      variant_a: {
        variant_id: 'A',
        prompt_version_id: activeVersion._id || '',
        description: 'Current production version',
      },
      variant_b: {
        variant_id: 'B',
        prompt_version_id: variant_b_version_id,
        description: variant_b_description,
      },
      status: 'draft',
      config: {
        ...DEFAULT_CONFIG,
        ...config,
      },
      created_by: req.body.created_by || 'operator',
      created_at: new Date(),
    };

    const created = await experimentStore.createABTest(test);

    res.status(201).json({
      success: true,
      data: created,
    });
  } catch (error) {
    console.error('[Experiments] Error creating experiment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create experiment',
    });
  }
});

// ========== GET SINGLE EXPERIMENT ==========

/**
 * GET /experiments/:id
 * Get a specific experiment (T081)
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const test = await experimentStore.getABTestById(req.params.id);

    if (!test) {
      return res.status(404).json({
        success: false,
        error: 'Experiment not found',
      });
    }

    // Calculate fresh results if test is running
    if (test.status === 'running') {
      const results = await calculateABResults(req.params.id);
      test.results = results;
    }

    res.json({
      success: true,
      data: test,
    });
  } catch (error) {
    console.error('[Experiments] Error fetching experiment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch experiment',
    });
  }
});

// ========== START EXPERIMENT ==========

/**
 * PATCH /experiments/:id/start
 * Start an A/B test (T082)
 */
router.patch('/:id/start', async (req: Request, res: Response) => {
  try {
    const test = await experimentStore.getABTestById(req.params.id);

    if (!test) {
      return res.status(404).json({
        success: false,
        error: 'Experiment not found',
      });
    }

    if (test.status !== 'draft' && test.status !== 'paused') {
      return res.status(400).json({
        success: false,
        error: `Cannot start test in ${test.status} status`,
      });
    }

    // Check for existing running test on same prompt
    const existing = await experimentStore.getActiveTestForPrompt(test.prompt_name);
    if (existing && existing._id !== test._id) {
      return res.status(400).json({
        success: false,
        error: `Another test is already running for ${test.prompt_name}`,
      });
    }

    await experimentStore.updateABTestStatus(req.params.id, 'running');

    res.json({
      success: true,
      message: 'Experiment started',
    });
  } catch (error) {
    console.error('[Experiments] Error starting experiment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start experiment',
    });
  }
});

// ========== STOP EXPERIMENT ==========

/**
 * PATCH /experiments/:id/stop
 * Stop an A/B test (T083)
 */
router.patch('/:id/stop', async (req: Request, res: Response) => {
  try {
    const test = await experimentStore.getABTestById(req.params.id);

    if (!test) {
      return res.status(404).json({
        success: false,
        error: 'Experiment not found',
      });
    }

    if (test.status !== 'running') {
      return res.status(400).json({
        success: false,
        error: `Cannot stop test in ${test.status} status`,
      });
    }

    const action = req.body.action as 'pause' | 'cancel' | 'complete';

    switch (action) {
      case 'pause':
        await experimentStore.updateABTestStatus(req.params.id, 'paused');
        break;
      case 'cancel':
        await experimentStore.updateABTestStatus(req.params.id, 'cancelled');
        break;
      case 'complete':
      default:
        // Calculate final results
        await updateTestResultsAndCheck(req.params.id);
        await experimentStore.updateABTestStatus(req.params.id, 'completed');
        break;
    }

    res.json({
      success: true,
      message: `Experiment ${action || 'completed'}`,
    });
  } catch (error) {
    console.error('[Experiments] Error stopping experiment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to stop experiment',
    });
  }
});

// ========== ADOPT WINNER ==========

/**
 * POST /experiments/:id/adopt
 * Adopt the winning variant as the new default (T084)
 */
router.post('/:id/adopt', async (req: Request, res: Response) => {
  try {
    const test = await experimentStore.getABTestById(req.params.id);

    if (!test) {
      return res.status(404).json({
        success: false,
        error: 'Experiment not found',
      });
    }

    if (!test.results || !test.results.winner || test.results.winner === 'none') {
      return res.status(400).json({
        success: false,
        error: 'No winner to adopt',
      });
    }

    const winningVariant = test.results.winner === 'A' ? test.variant_a : test.variant_b;

    // Get the winning version
    const winningVersion = await promptVersionStore.getPromptVersionById(
      winningVariant.prompt_version_id
    );

    if (!winningVersion) {
      return res.status(500).json({
        success: false,
        error: 'Winning version not found',
      });
    }

    // Set as active
    await promptVersionStore.setActiveVersion(
      test.prompt_name,
      winningVersion.version
    );

    // Mark test as completed if not already
    if (test.status === 'running') {
      await experimentStore.updateABTestStatus(req.params.id, 'completed');
    }

    res.json({
      success: true,
      message: `Adopted ${test.results.winner === 'A' ? 'Variant A' : 'Variant B'} as new default`,
      data: {
        adopted_version: winningVersion.version,
        prompt_name: test.prompt_name,
      },
    });
  } catch (error) {
    console.error('[Experiments] Error adopting winner:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to adopt winner',
    });
  }
});

// ========== REFRESH RESULTS ==========

/**
 * POST /experiments/:id/refresh
 * Recalculate results for a test
 */
router.post('/:id/refresh', async (req: Request, res: Response) => {
  try {
    const result = await updateTestResultsAndCheck(req.params.id);

    res.json({
      success: true,
      data: {
        results: result.results,
        auto_adopted: result.autoAdopted,
        message: result.message,
      },
    });
  } catch (error) {
    console.error('[Experiments] Error refreshing results:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to refresh results',
    });
  }
});

export default router;
