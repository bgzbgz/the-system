/**
 * A/B Testing Service
 * Feature: 020-self-improving-factory
 *
 * Manages A/B testing of prompt variants with statistical significance.
 */

import {
  ABTest,
  ABTestResults,
  QualityScore,
} from '../qualityScoring/types';
import * as experimentStore from '../../db/services/experimentStore';
import * as qualityStore from '../../db/services/qualityStore';
import { calculateSignificance, calculatePerCriterionBreakdown } from './statisticsCalculator';

/**
 * Calculate A/B test results with per-criterion breakdown (T072)
 *
 * @param testId - A/B test ID
 * @returns Full test results with statistics
 */
export async function calculateABResults(testId: string): Promise<ABTestResults> {
  // Get results by variant
  const { A: variantAResults, B: variantBResults } = await experimentStore.getABResultsByVariant(testId);

  // Get quality scores for each result
  const variantAScores: QualityScore[] = [];
  const variantBScores: QualityScore[] = [];

  for (const result of variantAResults) {
    const score = await qualityStore.getScoreByJobId(result.job_id);
    if (score) variantAScores.push(score);
  }

  for (const result of variantBResults) {
    const score = await qualityStore.getScoreByJobId(result.job_id);
    if (score) variantBScores.push(score);
  }

  // Calculate averages
  const variantAAvg = variantAScores.length > 0
    ? variantAScores.reduce((sum, s) => sum + s.overall_score, 0) / variantAScores.length
    : 0;
  const variantBAvg = variantBScores.length > 0
    ? variantBScores.reduce((sum, s) => sum + s.overall_score, 0) / variantBScores.length
    : 0;

  // Calculate significance
  const significance = calculateSignificance(
    variantAScores.map(s => s.overall_score),
    variantBScores.map(s => s.overall_score)
  );

  // Calculate per-criterion breakdown
  const perCriterion = calculatePerCriterionBreakdown(
    variantAScores.map(s => ({ criteria: s.criteria })),
    variantBScores.map(s => ({ criteria: s.criteria }))
  );

  return {
    variant_a_samples: variantAScores.length,
    variant_b_samples: variantBScores.length,
    variant_a_avg_score: Math.round(variantAAvg * 10) / 10,
    variant_b_avg_score: Math.round(variantBAvg * 10) / 10,
    p_value: significance.pValue,
    significant: significance.significant,
    winner: significance.winner,
    per_criterion: perCriterion,
  };
}

/**
 * Check if auto-adopt should be triggered (T073)
 *
 * @param test - A/B test to check
 * @returns Whether to auto-adopt and which variant
 */
export async function checkAutoAdopt(test: ABTest): Promise<{
  shouldAdopt: boolean;
  winner?: 'A' | 'B';
  reason: string;
}> {
  if (!test.config.auto_adopt) {
    return { shouldAdopt: false, reason: 'Auto-adopt is disabled' };
  }

  if (!test.results) {
    return { shouldAdopt: false, reason: 'No results available' };
  }

  if (!test.results.significant) {
    return { shouldAdopt: false, reason: 'Results not statistically significant' };
  }

  if (test.results.winner === 'none') {
    return { shouldAdopt: false, reason: 'No clear winner' };
  }

  // Check minimum improvement threshold
  const improvement = Math.abs(
    test.results.variant_a_avg_score - test.results.variant_b_avg_score
  );
  const improvementPercent = (improvement / Math.min(
    test.results.variant_a_avg_score || 1,
    test.results.variant_b_avg_score || 1
  )) * 100;

  if (improvementPercent < test.config.min_improvement) {
    return {
      shouldAdopt: false,
      reason: `Improvement (${improvementPercent.toFixed(1)}%) below threshold (${test.config.min_improvement}%)`,
    };
  }

  return {
    shouldAdopt: true,
    winner: test.results.winner,
    reason: `Significant improvement: ${test.results.winner === 'A' ? 'Variant A' : 'Variant B'} wins with ${improvementPercent.toFixed(1)}% improvement`,
  };
}

/**
 * Update test results and check for auto-adopt
 */
export async function updateTestResultsAndCheck(testId: string): Promise<{
  results: ABTestResults;
  autoAdopted: boolean;
  message: string;
}> {
  // Calculate fresh results
  const results = await calculateABResults(testId);

  // Save updated results
  await experimentStore.updateABTestResults(testId, results);

  // Get test for config
  const test = await experimentStore.getABTestById(testId);
  if (!test) {
    return { results, autoAdopted: false, message: 'Test not found' };
  }

  // Check min samples
  if (results.variant_a_samples < test.config.min_samples_per_variant ||
      results.variant_b_samples < test.config.min_samples_per_variant) {
    return {
      results,
      autoAdopted: false,
      message: `Need more samples: A has ${results.variant_a_samples}/${test.config.min_samples_per_variant}, B has ${results.variant_b_samples}/${test.config.min_samples_per_variant}`,
    };
  }

  // Check for auto-adopt
  const testWithResults = { ...test, results };
  const autoAdoptResult = await checkAutoAdopt(testWithResults);

  if (autoAdoptResult.shouldAdopt && autoAdoptResult.winner) {
    console.log(`[ABTesting] Auto-adopting ${autoAdoptResult.winner} for test ${test.name}`);
    await experimentStore.updateABTestStatus(testId, 'completed');

    // TODO: Actually activate the winning prompt version
    // This would call promptVersionStore.setActiveVersion()

    return {
      results,
      autoAdopted: true,
      message: autoAdoptResult.reason,
    };
  }

  return {
    results,
    autoAdopted: false,
    message: autoAdoptResult.reason,
  };
}

// Re-export utilities
export { assignVariant, hasActiveTest } from './variantAssigner';
export { calculateSignificance } from './statisticsCalculator';
