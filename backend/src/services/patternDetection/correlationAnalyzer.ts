/**
 * Correlation Analyzer
 * Feature: 020-self-improving-factory
 *
 * Analyzes correlations between quality failures and tool characteristics
 * (course type, framework type, input count).
 */

import {
  QualityScore,
  CriterionId,
  Correlation,
} from '../qualityScoring/types';

/**
 * Analyze correlations between failures and characteristics (T043)
 *
 * @param scores - Quality scores to analyze
 * @param criterionId - Which criterion to analyze
 * @returns Correlations found
 */
export function analyzeCorrelations(
  scores: QualityScore[],
  criterionId: CriterionId
): Correlation[] {
  if (scores.length < 10) {
    // Not enough data for meaningful correlation
    return [];
  }

  const correlations: Correlation[] = [];

  // Split scores into passed and failed for this criterion
  const failedScores = scores.filter(s =>
    !s.criteria.find(c => c.criterion_id === criterionId)?.passed
  );

  if (failedScores.length === 0) {
    return [];
  }

  // Analyze input count correlation
  const inputCountCorrelation = analyzeInputCountCorrelation(scores, failedScores);
  if (inputCountCorrelation) {
    correlations.push(inputCountCorrelation);
  }

  // Analyze tool complexity (based on HTML size)
  const complexityCorrelation = analyzeComplexityCorrelation(scores, failedScores, criterionId);
  if (complexityCorrelation) {
    correlations.push(complexityCorrelation);
  }

  return correlations;
}

/**
 * Analyze correlation between input count and failures
 */
function analyzeInputCountCorrelation(
  allScores: QualityScore[],
  failedScores: QualityScore[]
): Correlation | null {
  // This is a simplified analysis - in production, would need more metadata
  // For now, we'll look at score distribution patterns

  // Check if failed tools have any common patterns in their scores
  const failedAvgScore = failedScores.reduce((sum, s) => sum + s.overall_score, 0) / failedScores.length;
  const allAvgScore = allScores.reduce((sum, s) => sum + s.overall_score, 0) / allScores.length;

  // If failed tools have significantly lower average scores, there's a correlation
  if (failedAvgScore < allAvgScore - 20) {
    return {
      factor: 'overall_quality',
      value: 'low_scoring_tools',
      strength: Math.min(1, (allAvgScore - failedAvgScore) / 50),
      sample_count: failedScores.length,
    };
  }

  return null;
}

/**
 * Analyze correlation between tool complexity and failures
 */
function analyzeComplexityCorrelation(
  allScores: QualityScore[],
  failedScores: QualityScore[],
  criterionId: CriterionId
): Correlation | null {
  // Check if certain criteria tend to fail together
  const coFailures: Record<CriterionId, number> = {
    decision: 0,
    zero_questions: 0,
    easy_steps: 0,
    feedback: 0,
    gamification: 0,
    results: 0,
    commitment: 0,
    brand: 0,
  };

  for (const score of failedScores) {
    for (const criterion of score.criteria) {
      if (!criterion.passed && criterion.criterion_id !== criterionId) {
        coFailures[criterion.criterion_id]++;
      }
    }
  }

  // Find the most common co-failure
  let maxCoFailure: CriterionId | null = null;
  let maxCount = 0;

  for (const [criteria, count] of Object.entries(coFailures)) {
    if (count > maxCount && count >= failedScores.length * 0.5) {
      maxCount = count;
      maxCoFailure = criteria as CriterionId;
    }
  }

  if (maxCoFailure) {
    return {
      factor: 'co_failure',
      value: maxCoFailure,
      strength: maxCount / failedScores.length,
      sample_count: maxCount,
    };
  }

  return null;
}

/**
 * Get a human-readable description of a correlation
 */
export function describeCorrelation(correlation: Correlation): string {
  switch (correlation.factor) {
    case 'overall_quality':
      return `Tools with low overall quality scores (${Math.round(correlation.strength * 100)}% correlation)`;

    case 'co_failure':
      return `Often fails together with "${correlation.value}" criterion (${Math.round(correlation.strength * 100)}% of cases)`;

    case 'course_type':
      return `More common in "${correlation.value}" courses (${correlation.sample_count} samples)`;

    case 'framework_type':
      return `Associated with "${correlation.value}" frameworks (${correlation.sample_count} samples)`;

    case 'input_count':
      return `Tools with ${correlation.value} inputs (${correlation.sample_count} samples)`;

    default:
      return `${correlation.factor}: ${correlation.value} (${Math.round(correlation.strength * 100)}% strength)`;
  }
}
