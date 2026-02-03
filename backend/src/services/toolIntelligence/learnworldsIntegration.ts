/**
 * Tool Intelligence Service - LearnWorlds Integration
 * Feature: 018-tool-intelligence
 *
 * Handles LearnWorlds course completion based on quality gate.
 */

import { QualityScore } from './types';

/**
 * Check if a tool submission passes the quality gate for completion
 *
 * @param qualityScore - Quality score from analysis
 * @returns True if quality gate passes or is disabled
 */
export function passesQualityGate(qualityScore: QualityScore): boolean {
  return qualityScore.passedThreshold;
}

/**
 * Get completion status message based on quality gate result
 *
 * @param qualityScore - Quality score from analysis
 * @returns Status message for user
 */
export function getCompletionMessage(qualityScore: QualityScore): string {
  if (qualityScore.thresholdValue === 0) {
    return 'Tool completed successfully.';
  }

  if (qualityScore.passedThreshold) {
    return `Quality check passed (${qualityScore.overall}% score). Tool marked as complete.`;
  }

  return `Quality check not passed (${qualityScore.overall}% score, minimum ${qualityScore.thresholdValue}% required). Please review and improve your inputs.`;
}

/**
 * Build LearnWorlds completion callback data
 * This can be sent to LearnWorlds to mark a lesson/activity as complete
 *
 * @param toolSlug - Tool identifier
 * @param userId - LearnWorlds user ID
 * @param qualityScore - Quality score from analysis
 * @param responseId - Tool response ID
 * @returns Completion data for LearnWorlds callback
 */
export function buildCompletionData(
  toolSlug: string,
  userId: string,
  qualityScore: QualityScore,
  responseId: string
): {
  shouldMarkComplete: boolean;
  completionData: {
    tool_slug: string;
    user_id: string;
    response_id: string;
    quality_score: number;
    passed_threshold: boolean;
    threshold_value: number;
    timestamp: string;
  };
} {
  return {
    shouldMarkComplete: qualityScore.passedThreshold,
    completionData: {
      tool_slug: toolSlug,
      user_id: userId,
      response_id: responseId,
      quality_score: qualityScore.overall,
      passed_threshold: qualityScore.passedThreshold,
      threshold_value: qualityScore.thresholdValue,
      timestamp: new Date().toISOString()
    }
  };
}

/**
 * Quality gate summary for admin/boss view
 */
export function getQualityGateSummary(qualityScore: QualityScore): {
  status: 'passed' | 'failed' | 'disabled';
  scoreBreakdown: {
    completeness: string;
    realism: string;
    variance: string;
    overall: string;
  };
  recommendation: string;
} {
  const status = qualityScore.thresholdValue === 0
    ? 'disabled'
    : qualityScore.passedThreshold
      ? 'passed'
      : 'failed';

  const scoreBreakdown = {
    completeness: `${qualityScore.completeness}%`,
    realism: `${qualityScore.realism}%`,
    variance: `${qualityScore.variance}%`,
    overall: `${qualityScore.overall}%`
  };

  let recommendation: string;
  if (status === 'disabled') {
    recommendation = 'Quality gate is disabled for this tool.';
  } else if (status === 'passed') {
    recommendation = 'Submission meets quality standards.';
  } else {
    // Identify the weakest area
    const scores = [
      { name: 'completeness', value: qualityScore.completeness },
      { name: 'realism', value: qualityScore.realism },
      { name: 'variance', value: qualityScore.variance }
    ];
    const weakest = scores.reduce((a, b) => a.value < b.value ? a : b);

    if (weakest.name === 'completeness') {
      recommendation = 'Fill in all required fields to improve your score.';
    } else if (weakest.name === 'realism') {
      recommendation = 'Use more realistic values that align with course recommendations.';
    } else {
      recommendation = 'Use varied inputs - identical values suggest incomplete analysis.';
    }
  }

  return { status, scoreBreakdown, recommendation };
}

export default {
  passesQualityGate,
  getCompletionMessage,
  buildCompletionData,
  getQualityGateSummary
};
