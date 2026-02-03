/**
 * Tool Intelligence Service - Response Parser
 * Feature: 018-tool-intelligence
 *
 * Parses and validates AI JSON responses for analysis.
 */

import { Insight, Recommendation, SentimentType } from './types';

// ========== TYPES ==========

/**
 * Raw AI response structure before validation
 */
export interface RawAnalysisResponse {
  insights?: unknown[];
  recommendations?: unknown[];
  verdictExplanation?: string;
  courseReferences?: string[];
}

/**
 * Validated analysis response
 */
export interface ParsedAnalysisResponse {
  insights: Insight[];
  recommendations: Recommendation[];
  verdictExplanation: string;
  courseReferences: string[];
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// ========== CONSTANTS ==========

const VALID_SENTIMENTS: SentimentType[] = ['positive', 'warning', 'critical'];
const MAX_INSIGHT_TEXT_LENGTH = 200;
const MAX_VERDICT_LENGTH = 300;
const MIN_INSIGHTS = 3;
const MAX_INSIGHTS = 5;
const MAX_RECOMMENDATIONS = 3;

// ========== PARSER FUNCTIONS ==========

/**
 * Parse AI response content to extract JSON
 *
 * @param content - Raw AI response content
 * @returns Parsed JSON object or null if invalid
 */
export function parseAnalysisResponse(content: string): ParsedAnalysisResponse | null {
  try {
    // Try to extract JSON from the response
    let jsonStr = content.trim();

    // Remove markdown code blocks if present
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.slice(7);
    } else if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.slice(3);
    }
    if (jsonStr.endsWith('```')) {
      jsonStr = jsonStr.slice(0, -3);
    }
    jsonStr = jsonStr.trim();

    // Find JSON object in the response
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('[Parser] No JSON object found in response');
      return null;
    }

    const raw = JSON.parse(jsonMatch[0]) as RawAnalysisResponse;

    // Transform and validate the response
    const parsed = transformResponse(raw);
    return parsed;
  } catch (error) {
    console.error('[Parser] Failed to parse AI response:', error);
    return null;
  }
}

/**
 * Transform raw response to validated format
 */
function transformResponse(raw: RawAnalysisResponse): ParsedAnalysisResponse {
  // Transform insights
  const insights: Insight[] = (raw.insights || [])
    .slice(0, MAX_INSIGHTS)
    .map((item: any) => ({
      text: truncateText(String(item.text || ''), MAX_INSIGHT_TEXT_LENGTH),
      courseReference: item.courseReference || null,
      sentiment: validateSentiment(item.sentiment),
      inputsInvolved: Array.isArray(item.inputsInvolved) ? item.inputsInvolved : []
    }));

  // Transform recommendations
  const recommendations: Recommendation[] = (raw.recommendations || [])
    .slice(0, MAX_RECOMMENDATIONS)
    .map((item: any) => ({
      targetInput: String(item.targetInput || ''),
      inputLabel: String(item.inputLabel || ''),
      currentValue: String(item.currentValue || ''),
      recommendedRange: String(item.recommendedRange || ''),
      courseModule: item.courseModule || null,
      courseModuleUrl: item.courseModuleUrl || null,
      impactScore: Math.min(10, Math.max(1, Number(item.impactScore) || 5))
    }))
    .sort((a, b) => b.impactScore - a.impactScore);

  // Verdict explanation
  const verdictExplanation = truncateText(
    String(raw.verdictExplanation || 'Analysis complete.'),
    MAX_VERDICT_LENGTH
  );

  // Course references
  const courseReferences = Array.isArray(raw.courseReferences)
    ? raw.courseReferences.filter((r): r is string => typeof r === 'string')
    : [];

  return {
    insights,
    recommendations,
    verdictExplanation,
    courseReferences
  };
}

/**
 * Validate analysis response structure and content
 *
 * @param response - Parsed response to validate
 * @returns Validation result with errors and warnings
 */
export function validateAnalysisResponse(response: ParsedAnalysisResponse): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate insights count
  if (response.insights.length < MIN_INSIGHTS) {
    warnings.push(`Expected at least ${MIN_INSIGHTS} insights, got ${response.insights.length}`);
  }

  // Validate insights have content
  response.insights.forEach((insight, idx) => {
    if (!insight.text || insight.text.trim().length === 0) {
      errors.push(`Insight ${idx + 1} has empty text`);
    }
  });

  // Check for course references in insights
  const insightsWithRefs = response.insights.filter(i => i.courseReference !== null);
  if (insightsWithRefs.length < 2) {
    warnings.push(`Expected at least 2 insights with course references, got ${insightsWithRefs.length}`);
  }

  // Validate recommendations
  response.recommendations.forEach((rec, idx) => {
    if (!rec.targetInput) {
      errors.push(`Recommendation ${idx + 1} missing targetInput`);
    }
    if (rec.impactScore < 1 || rec.impactScore > 10) {
      warnings.push(`Recommendation ${idx + 1} has invalid impactScore: ${rec.impactScore}`);
    }
  });

  // Validate verdict explanation
  if (!response.verdictExplanation || response.verdictExplanation.trim().length === 0) {
    errors.push('Missing verdict explanation');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

// ========== HELPER FUNCTIONS ==========

/**
 * Validate and normalize sentiment value
 */
function validateSentiment(value: unknown): SentimentType {
  const str = String(value).toLowerCase();
  if (VALID_SENTIMENTS.includes(str as SentimentType)) {
    return str as SentimentType;
  }
  return 'warning'; // Default to warning for unknown sentiments
}

/**
 * Truncate text to max length with ellipsis
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.slice(0, maxLength - 3) + '...';
}

export default {
  parseAnalysisResponse,
  validateAnalysisResponse
};
