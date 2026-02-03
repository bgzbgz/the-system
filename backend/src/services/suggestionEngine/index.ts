/**
 * Suggestion Engine Service
 * Feature: 020-self-improving-factory
 *
 * Generates improvement suggestions based on quality patterns.
 */

import {
  Suggestion,
  QualityPattern,
  SuggestionStatus,
} from '../qualityScoring/types';
import * as qualityStore from '../../db/services/qualityStore';
import { getPrimarySuggestion } from './ruleEngine';

/**
 * Generate suggestions from detected patterns (T057)
 *
 * @param patterns - Quality patterns to generate suggestions for
 * @returns Generated suggestions (only new ones, deduplicated)
 */
export async function generateSuggestions(
  patterns: QualityPattern[]
): Promise<Suggestion[]> {
  const suggestions: Suggestion[] = [];

  for (const pattern of patterns) {
    // Check if we already have a pending suggestion for this criterion
    const isDuplicate = await isDuplicateSuggestion(
      pattern._id || '',
      pattern.criterion_id
    );

    if (isDuplicate) {
      console.log(`[SuggestionEngine] Skipping duplicate suggestion for ${pattern.criterion_id}`);
      continue;
    }

    // Get suggestion template for this criterion
    const template = getPrimarySuggestion(pattern.criterion_id);

    if (!template) {
      console.log(`[SuggestionEngine] No template for criterion ${pattern.criterion_id}`);
      continue;
    }

    // Create suggestion
    const suggestion: Suggestion = {
      pattern_id: pattern._id || '',
      criterion_id: pattern.criterion_id,
      suggested_change: template.suggested_change,
      prompt_name: template.prompt_name,
      prompt_section: template.prompt_section,
      supporting_data: {
        failure_rate: pattern.failure_rate,
        sample_size: pattern.sample_size,
        trend: pattern.trend,
      },
      status: 'pending',
      created_at: new Date(),
    };

    // Save suggestion
    const saved = await qualityStore.saveSuggestion(suggestion);
    suggestions.push(saved);

    console.log(`[SuggestionEngine] Created suggestion for ${pattern.criterion_id}: ${template.suggested_change.substring(0, 50)}...`);
  }

  return suggestions;
}

/**
 * Check if a suggestion already exists for a criterion (T058)
 *
 * @param patternId - Pattern ID (not used currently but reserved for future)
 * @param criterionId - Criterion to check
 * @returns True if a pending suggestion exists for this criterion
 */
export async function isDuplicateSuggestion(
  patternId: string,
  criterionId: string
): Promise<boolean> {
  // Get pending suggestions
  const pendingSuggestions = await qualityStore.getSuggestionsByStatus('pending');

  // Check if any pending suggestion is for the same criterion
  return pendingSuggestions.some(s => s.criterion_id === criterionId);
}

/**
 * Get all pending suggestions
 */
export async function getPendingSuggestions(): Promise<Suggestion[]> {
  return qualityStore.getSuggestionsByStatus('pending');
}

/**
 * Review a suggestion (approve, dismiss, or defer)
 */
export async function reviewSuggestion(
  suggestionId: string,
  status: SuggestionStatus,
  operatorNotes?: string,
  reviewedBy?: string
): Promise<boolean> {
  return qualityStore.updateSuggestionStatus(
    suggestionId,
    status,
    operatorNotes,
    reviewedBy
  );
}
