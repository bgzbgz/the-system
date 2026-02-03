/**
 * Patterns API Routes
 * Feature: 020-self-improving-factory
 *
 * Endpoints for pattern detection and weekly reports.
 */

import { Router, Request, Response } from 'express';
import * as qualityStore from '../db/services/qualityStore';
import { runPatternDetection } from '../services/patternDetection';
import { generateWeeklyReport, formatWeeklyReport } from '../services/patternDetection/reportGenerator';
import { PatternStatus } from '../services/qualityScoring/types';

const router = Router();

// ========== PATTERNS ==========

/**
 * GET /patterns
 * Get all active patterns (T048)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const patterns = await qualityStore.getActivePatterns();

    res.json({
      success: true,
      data: {
        patterns,
        count: patterns.length,
      },
    });
  } catch (error) {
    console.error('[Patterns] Error fetching patterns:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch patterns',
    });
  }
});

/**
 * POST /patterns/detect
 * Trigger pattern detection manually
 */
router.post('/detect', async (req: Request, res: Response) => {
  try {
    const patterns = await runPatternDetection();

    res.json({
      success: true,
      data: {
        patterns,
        new_patterns_count: patterns.length,
      },
    });
  } catch (error) {
    console.error('[Patterns] Error detecting patterns:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to detect patterns',
    });
  }
});

// ========== WEEKLY REPORT ==========

/**
 * GET /patterns/weekly-report
 * Get weekly pattern report (T049)
 */
router.get('/weekly-report', async (req: Request, res: Response) => {
  try {
    const format = req.query.format as string;
    const report = await generateWeeklyReport();

    if (format === 'text') {
      res.type('text/plain').send(formatWeeklyReport(report));
    } else {
      res.json({
        success: true,
        data: report,
      });
    }
  } catch (error) {
    console.error('[Patterns] Error generating weekly report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate weekly report',
    });
  }
});

// ========== PATTERN MANAGEMENT ==========

/**
 * PATCH /patterns/:id/status
 * Update pattern status (T050)
 */
router.patch('/:id/status', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body as { status: PatternStatus };

    if (!status || !['active', 'addressed', 'dismissed'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status. Must be one of: active, addressed, dismissed',
      });
    }

    const success = await qualityStore.updatePatternStatus(id, status);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Pattern not found',
      });
    }

    res.json({
      success: true,
      message: `Pattern status updated to ${status}`,
    });
  } catch (error) {
    console.error('[Patterns] Error updating pattern status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update pattern status',
    });
  }
});

export default router;
