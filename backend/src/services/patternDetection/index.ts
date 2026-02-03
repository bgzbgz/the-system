/**
 * Pattern Detection Service
 * Feature: 020-self-improving-factory
 *
 * Detects quality failure patterns using a 7-day rolling window
 * and 30% failure threshold.
 */

import {
  QualityPattern,
  QualityScore,
  CriterionId,
  PatternTrend,
} from '../qualityScoring/types';
import * as qualityStore from '../../db/services/qualityStore';
import { generateSuggestions } from '../suggestionEngine';

const WINDOW_DAYS = 7;
const FAILURE_THRESHOLD = 0.30; // 30%

const ALL_CRITERIA: CriterionId[] = [
  'decision', 'zero_questions', 'easy_steps', 'feedback',
  'gamification', 'results', 'commitment', 'brand'
];

/**
 * Calculate the trend direction for a criterion (T042)
 * Compares current window failure rate to previous window
 */
export async function calculateTrend(
  criterionId: CriterionId,
  currentWindowStart: Date,
  currentFailureRate: number
): Promise<PatternTrend> {
  // Get previous window (7 days before current window)
  const previousWindowEnd = new Date(currentWindowStart.getTime() - 1);
  const previousWindowStart = new Date(previousWindowEnd.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const previousScores = await qualityStore.getScoresInWindow(previousWindowStart, previousWindowEnd);

  if (previousScores.length < 5) {
    // Not enough data to determine trend
    return 'stable';
  }

  // Calculate previous failure rate for this criterion
  const previousFailCount = previousScores.filter(s =>
    !s.criteria.find(c => c.criterion_id === criterionId)?.passed
  ).length;
  const previousFailureRate = previousFailCount / previousScores.length;

  // Determine trend (5% threshold for change)
  const difference = currentFailureRate - previousFailureRate;

  if (difference > 0.05) {
    return 'worsening';
  } else if (difference < -0.05) {
    return 'improving';
  }

  return 'stable';
}

/**
 * Detect patterns in quality scores using 7-day rolling window (T041)
 * Returns patterns for criteria exceeding 30% failure threshold
 */
export async function detectPatterns(): Promise<QualityPattern[]> {
  const windowEnd = new Date();
  const windowStart = new Date(windowEnd.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000);

  // Get scores in current window
  const scores = await qualityStore.getScoresInWindow(windowStart, windowEnd);

  if (scores.length < 5) {
    // Not enough data for pattern detection
    console.log(`[PatternDetection] Insufficient data: ${scores.length} scores in window (need 5+)`);
    return [];
  }

  const patterns: QualityPattern[] = [];

  // Check each criterion for failure patterns
  for (const criterionId of ALL_CRITERIA) {
    const failCount = scores.filter(s =>
      !s.criteria.find(c => c.criterion_id === criterionId)?.passed
    ).length;

    const failureRate = failCount / scores.length;

    if (failureRate >= FAILURE_THRESHOLD) {
      // Pattern detected - calculate trend
      const trend = await calculateTrend(criterionId, windowStart, failureRate);

      patterns.push({
        criterion_id: criterionId,
        failure_rate: Math.round(failureRate * 100),
        sample_size: scores.length,
        window_start: windowStart,
        window_end: windowEnd,
        trend,
        status: 'active',
        created_at: new Date(),
        updated_at: new Date(),
      });
    }
  }

  console.log(`[PatternDetection] Detected ${patterns.length} patterns from ${scores.length} scores`);
  return patterns;
}

/**
 * Run full pattern detection cycle with suggestion generation (T066)
 * Detects patterns, saves new ones, and generates suggestions
 */
export async function runFullPatternCycle(): Promise<{
  patterns: QualityPattern[];
  suggestions: number;
}> {
  // Run pattern detection
  const newPatterns = await runPatternDetection();

  if (newPatterns.length === 0) {
    return { patterns: [], suggestions: 0 };
  }

  // Generate suggestions for new patterns (T066)
  const suggestions = await generateSuggestions(newPatterns);

  console.log(`[PatternDetection] Generated ${suggestions.length} suggestions from ${newPatterns.length} patterns`);

  return {
    patterns: newPatterns,
    suggestions: suggestions.length,
  };
}

/**
 * Run pattern detection and save new patterns (T041)
 * Skips patterns that already exist as active
 */
export async function runPatternDetection(): Promise<QualityPattern[]> {
  const patterns = await detectPatterns();

  if (patterns.length === 0) {
    return [];
  }

  // Get existing active patterns to avoid duplicates
  const existingPatterns = await qualityStore.getActivePatterns();
  const existingCriteria = new Set(existingPatterns.map(p => p.criterion_id));

  // Save only new patterns
  const newPatterns: QualityPattern[] = [];
  for (const pattern of patterns) {
    if (!existingCriteria.has(pattern.criterion_id)) {
      const saved = await qualityStore.savePattern(pattern);
      newPatterns.push(saved);
      console.log(`[PatternDetection] Saved new pattern for ${pattern.criterion_id}: ${pattern.failure_rate}% failure rate`);
    }
  }

  return newPatterns;
}

export { WINDOW_DAYS, FAILURE_THRESHOLD, ALL_CRITERIA };
