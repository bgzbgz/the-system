/**
 * Statistics Calculator
 * Feature: 020-self-improving-factory
 *
 * Implements chi-squared test for A/B test statistical significance.
 */

import { ABTestResults, CriterionId } from '../qualityScoring/types';

/**
 * Chi-squared critical values for p=0.05 with 1 degree of freedom
 * If chi-squared > 3.841, result is significant at p < 0.05
 */
const CHI_SQUARED_CRITICAL_005 = 3.841;

/**
 * Calculate chi-squared statistic for pass/fail comparison (T071)
 *
 * @param passA - Passes in variant A
 * @param failA - Fails in variant A
 * @param passB - Passes in variant B
 * @param failB - Fails in variant B
 * @returns Chi-squared statistic
 */
export function calculateChiSquared(
  passA: number,
  failA: number,
  passB: number,
  failB: number
): number {
  const totalA = passA + failA;
  const totalB = passB + failB;
  const totalPass = passA + passB;
  const totalFail = failA + failB;
  const grandTotal = totalA + totalB;

  if (grandTotal === 0) return 0;

  // Expected values
  const expectedPassA = (totalA * totalPass) / grandTotal;
  const expectedFailA = (totalA * totalFail) / grandTotal;
  const expectedPassB = (totalB * totalPass) / grandTotal;
  const expectedFailB = (totalB * totalFail) / grandTotal;

  // Chi-squared calculation
  let chiSquared = 0;

  if (expectedPassA > 0) {
    chiSquared += Math.pow(passA - expectedPassA, 2) / expectedPassA;
  }
  if (expectedFailA > 0) {
    chiSquared += Math.pow(failA - expectedFailA, 2) / expectedFailA;
  }
  if (expectedPassB > 0) {
    chiSquared += Math.pow(passB - expectedPassB, 2) / expectedPassB;
  }
  if (expectedFailB > 0) {
    chiSquared += Math.pow(failB - expectedFailB, 2) / expectedFailB;
  }

  return chiSquared;
}

/**
 * Convert chi-squared to approximate p-value
 * This is a simplified approximation for 1 degree of freedom
 */
export function chiSquaredToPValue(chiSquared: number): number {
  // Approximation using exponential distribution
  // For 1 df, p ≈ exp(-chiSquared/2)
  if (chiSquared <= 0) return 1;
  return Math.exp(-chiSquared / 2);
}

/**
 * Calculate statistical significance for A/B test results (T071)
 *
 * @param results - Partial results with sample counts and scores
 * @param significanceThreshold - p-value threshold (default 0.05)
 * @returns Updated results with significance info
 */
export function calculateSignificance(
  variantAScores: number[],
  variantBScores: number[],
  significanceThreshold: number = 0.05
): {
  pValue: number;
  significant: boolean;
  winner: 'A' | 'B' | 'none';
} {
  const passThreshold = 100; // Score >= 100 means all criteria passed

  const passA = variantAScores.filter(s => s >= passThreshold).length;
  const failA = variantAScores.length - passA;
  const passB = variantBScores.filter(s => s >= passThreshold).length;
  const failB = variantBScores.length - passB;

  // Calculate chi-squared
  const chiSquared = calculateChiSquared(passA, failA, passB, failB);
  const pValue = chiSquaredToPValue(chiSquared);
  const significant = pValue < significanceThreshold;

  // Determine winner
  let winner: 'A' | 'B' | 'none' = 'none';
  if (significant) {
    const avgA = variantAScores.length > 0
      ? variantAScores.reduce((a, b) => a + b, 0) / variantAScores.length
      : 0;
    const avgB = variantBScores.length > 0
      ? variantBScores.reduce((a, b) => a + b, 0) / variantBScores.length
      : 0;

    if (avgA > avgB) {
      winner = 'A';
    } else if (avgB > avgA) {
      winner = 'B';
    }
  }

  return {
    pValue: Math.round(pValue * 1000) / 1000, // Round to 3 decimal places
    significant,
    winner,
  };
}

/**
 * Calculate per-criterion breakdown
 */
export function calculatePerCriterionBreakdown(
  variantAResults: Array<{ criteria: Array<{ criterion_id: CriterionId; passed: boolean }> }>,
  variantBResults: Array<{ criteria: Array<{ criterion_id: CriterionId; passed: boolean }> }>
): Record<CriterionId, { variant_a_pass_rate: number; variant_b_pass_rate: number }> {
  const allCriteria: CriterionId[] = [
    'decision', 'zero_questions', 'easy_steps', 'feedback',
    'gamification', 'results', 'commitment', 'brand'
  ];

  const breakdown = {} as Record<CriterionId, { variant_a_pass_rate: number; variant_b_pass_rate: number }>;

  for (const criterionId of allCriteria) {
    const aPassCount = variantAResults.filter(r =>
      r.criteria.find(c => c.criterion_id === criterionId)?.passed
    ).length;

    const bPassCount = variantBResults.filter(r =>
      r.criteria.find(c => c.criterion_id === criterionId)?.passed
    ).length;

    breakdown[criterionId] = {
      variant_a_pass_rate: variantAResults.length > 0
        ? Math.round((aPassCount / variantAResults.length) * 100)
        : 0,
      variant_b_pass_rate: variantBResults.length > 0
        ? Math.round((bPassCount / variantBResults.length) * 100)
        : 0,
    };
  }

  return breakdown;
}
