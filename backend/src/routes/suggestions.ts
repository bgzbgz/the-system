/**
 * Suggestions API Routes
 * Feature: 020-self-improving-factory
 *
 * Endpoints for managing improvement suggestions.
 */

import { Router, Request, Response } from 'express';
import * as qualityStore from '../db/services/qualityStore';
import { reviewSuggestion } from '../services/suggestionEngine';
import { SuggestionStatus } from '../services/qualityScoring/types';

const router = Router();

// ========== LIST SUGGESTIONS ==========

/**
 * GET /suggestions
 * Get suggestions filtered by status (T062)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const status = req.query.status as SuggestionStatus | undefined;

    let suggestions;
    if (status && ['pending', 'approved', 'dismissed', 'deferred', 'implemented'].includes(status)) {
      suggestions = await qualityStore.getSuggestionsByStatus(status);
    } else {
      // Default to pending
      suggestions = await qualityStore.getSuggestionsByStatus('pending');
    }

    res.json({
      success: true,
      data: {
        suggestions,
        count: suggestions.length,
        status: status || 'pending',
      },
    });
  } catch (error) {
    console.error('[Suggestions] Error fetching suggestions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch suggestions',
    });
  }
});

// ========== GET SINGLE SUGGESTION ==========

/**
 * GET /suggestions/:id
 * Get a specific suggestion by ID (T063)
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const suggestion = await qualityStore.getSuggestionById(req.params.id);

    if (!suggestion) {
      return res.status(404).json({
        success: false,
        error: 'Suggestion not found',
      });
    }

    res.json({
      success: true,
      data: suggestion,
    });
  } catch (error) {
    console.error('[Suggestions] Error fetching suggestion:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch suggestion',
    });
  }
});

// ========== UPDATE SUGGESTION ==========

/**
 * PATCH /suggestions/:id
 * Update suggestion status (approve, dismiss, defer) (T064)
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, operator_notes, reviewed_by } = req.body as {
      status: SuggestionStatus;
      operator_notes?: string;
      reviewed_by?: string;
    };

    // Validate status
    if (!status || !['pending', 'approved', 'dismissed', 'deferred', 'implemented'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status. Must be one of: pending, approved, dismissed, deferred, implemented',
      });
    }

    const success = await reviewSuggestion(
      id,
      status,
      operator_notes,
      reviewed_by
    );

    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Suggestion not found',
      });
    }

    res.json({
      success: true,
      message: `Suggestion ${status}`,
    });
  } catch (error) {
    console.error('[Suggestions] Error updating suggestion:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update suggestion',
    });
  }
});

// ========== BATCH OPERATIONS ==========

/**
 * POST /suggestions/batch
 * Batch update multiple suggestions
 */
router.post('/batch', async (req: Request, res: Response) => {
  try {
    const { ids, status, operator_notes, reviewed_by } = req.body as {
      ids: string[];
      status: SuggestionStatus;
      operator_notes?: string;
      reviewed_by?: string;
    };

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'ids must be a non-empty array',
      });
    }

    if (!status || !['pending', 'approved', 'dismissed', 'deferred', 'implemented'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status',
      });
    }

    const results = await Promise.all(
      ids.map(id => reviewSuggestion(id, status, operator_notes, reviewed_by))
    );

    const updatedCount = results.filter(r => r).length;

    res.json({
      success: true,
      data: {
        updated: updatedCount,
        total: ids.length,
      },
    });
  } catch (error) {
    console.error('[Suggestions] Error batch updating suggestions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to batch update suggestions',
    });
  }
});

export default router;
