/**
 * Tool Intelligence Service - Quality Scorer
 * Feature: 018-tool-intelligence
 *
 * Calculates quality scores for tool submissions to enable quality gating.
 * Formula: completeness(40%) + realism(40%) + variance(20%)
 */

import { QualityScore, InputRange } from './types';

// ========== WEIGHT CONSTANTS ==========

/** Weight for completeness score (% of fields filled) */
const COMPLETENESS_WEIGHT = 0.4;

/** Weight for realism score (% of values in expected ranges) */
const REALISM_WEIGHT = 0.4;

/** Weight for variance score (gaming detection) */
const VARIANCE_WEIGHT = 0.2;

// ========== MAIN SCORING FUNCTION ==========

/**
 * Calculate quality score for a tool submission
 *
 * @param inputs - User's input values
 * @param ranges - Input ranges from course context
 * @param thresholdValue - Configured minimum score (0 = disabled)
 * @returns Quality score with breakdown
 */
export function calculateQualityScore(
  inputs: Record<string, any>,
  ranges: InputRange[],
  thresholdValue: number = 0
): QualityScore {
  const inputEntries = Object.entries(inputs);

  // Edge case: no inputs
  if (inputEntries.length === 0) {
    return {
      completeness: 0,
      realism: 0,
      variance: 0,
      overall: 0,
      passedThreshold: thresholdValue === 0,
      thresholdValue
    };
  }

  // Calculate completeness: % of non-empty values
  const completeness = calculateCompleteness(inputEntries);

  // Calculate realism: % of numeric values within expected ranges
  const realism = calculateRealism(inputEntries, ranges);

  // Calculate variance: Check if all values are identical (gaming detection)
  const variance = calculateVariance(inputEntries);

  // Weighted overall score
  const overall = Math.round(
    completeness * COMPLETENESS_WEIGHT +
    realism * REALISM_WEIGHT +
    variance * VARIANCE_WEIGHT
  );

  return {
    completeness,
    realism,
    variance,
    overall,
    passedThreshold: thresholdValue === 0 || overall >= thresholdValue,
    thresholdValue
  };
}

// ========== COMPONENT CALCULATIONS ==========

/**
 * Calculate completeness score: % of fields filled with non-empty values
 */
function calculateCompleteness(inputEntries: [string, any][]): number {
  const filledCount = inputEntries.filter(([, value]) => {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string' && value.trim() === '') return false;
    return true;
  }).length;

  return Math.round((filledCount / inputEntries.length) * 100);
}

/**
 * Calculate realism score: % of numeric inputs within expected ranges
 */
function calculateRealism(
  inputEntries: [string, any][],
  ranges: InputRange[]
): number {
  const numericInputs = inputEntries.filter(([, value]) =>
    typeof value === 'number' && !isNaN(value)
  );

  // If no numeric inputs, assume realistic
  if (numericInputs.length === 0) {
    return 100;
  }

  let realismSum = 0;

  for (const [fieldId, value] of numericInputs) {
    const range = ranges.find(r => r.fieldId === fieldId);

    if (range) {
      // Check if value is within range
      const hasMin = range.inferredMin !== undefined;
      const hasMax = range.inferredMax !== undefined;

      if (hasMin && hasMax) {
        // Full range defined
        if (value >= range.inferredMin! && value <= range.inferredMax!) {
          realismSum += 1;
        }
      } else if (hasMin) {
        // Only min defined
        if (value >= range.inferredMin!) {
          realismSum += 1;
        }
      } else if (hasMax) {
        // Only max defined
        if (value <= range.inferredMax!) {
          realismSum += 1;
        }
      } else if (range.recommendedValue !== undefined) {
        // Point estimate - check if within 50% tolerance
        const tolerance = Math.abs(range.recommendedValue * 0.5);
        if (Math.abs(value - range.recommendedValue) <= tolerance) {
          realismSum += 1;
        }
      } else {
        // No range info - assume realistic
        realismSum += 1;
      }
    } else {
      // No range defined for this field - assume realistic
      realismSum += 1;
    }
  }

  return Math.round((realismSum / numericInputs.length) * 100);
}

/**
 * Calculate variance score: normalized input variance (gaming detection)
 * Score of 0 = all identical values (likely gaming)
 * Score of 100 = good variance (realistic input diversity)
 */
function calculateVariance(inputEntries: [string, any][]): number {
  const numericValues = inputEntries
    .filter(([, value]) => typeof value === 'number' && !isNaN(value))
    .map(([, value]) => value as number);

  return calculateNormalizedVariance(numericValues);
}

/**
 * Calculate normalized variance score for a set of numeric values
 * Exported for direct use and testing
 *
 * @param values - Array of numeric values
 * @returns Score 0-100 where 0 = all identical, 100 = good variance
 */
export function calculateNormalizedVariance(values: number[]): number {
  // Edge cases
  if (values.length < 2) {
    return 100; // Single value or empty - can't detect gaming
  }

  // Check for all identical values
  const allIdentical = values.every(v => v === values[0]);
  if (allIdentical) {
    return 0; // Clear gaming attempt
  }

  // Calculate coefficient of variation (CV)
  const mean = values.reduce((a, b) => a + b, 0) / values.length;

  // Handle mean of zero or near-zero
  if (Math.abs(mean) < 0.0001) {
    // Use range-based score for values centered around zero
    const min = Math.min(...values);
    const max = Math.max(...values);
    return max === min ? 0 : Math.min(100, 50); // Some variance exists
  }

  const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  const stdDev = Math.sqrt(variance);
  const cv = stdDev / Math.abs(mean);

  // Map CV to 0-100 score
  // CV of 0 = 0 points (all identical)
  // CV of 0.5+ = 100 points (good variance)
  return Math.min(100, Math.round(cv * 200));
}

// ========== THRESHOLD HELPERS ==========

/**
 * Check if a quality score passes the threshold
 */
export function passesThreshold(score: QualityScore): boolean {
  return score.passedThreshold;
}

/**
 * Get a human-readable quality assessment
 */
export function getQualityAssessment(score: QualityScore): string {
  if (score.overall >= 80) {
    return 'Excellent submission - thoughtful, realistic inputs with good variety.';
  } else if (score.overall >= 60) {
    return 'Good submission - most inputs are realistic and complete.';
  } else if (score.overall >= 40) {
    return 'Needs improvement - some inputs may be unrealistic or missing.';
  } else {
    return 'Poor submission - inputs appear incomplete or unrealistic.';
  }
}

export default {
  calculateQualityScore,
  calculateNormalizedVariance,
  passesThreshold,
  getQualityAssessment
};
