/**
 * Feedback Criterion Check
 * Feature: 020-self-improving-factory
 *
 * Checks for input validation elements (Step Feedback criterion).
 * Per FR-008: System MUST check for input validation elements.
 */

import { CriterionScore } from '../types';
import { hasValidationElements, hasClassOrId } from '../htmlAnalyzer';

/**
 * Check for feedback criterion (instant validation/feedback)
 *
 * Passes if:
 * - Tool has input validation
 * - Provides immediate feedback on user actions
 * - Visual indicators for valid/invalid states
 */
export async function checkFeedback(html: string): Promise<CriterionScore> {
  const evidence: string[] = [];

  // Check for validation elements
  const validationCheck = hasValidationElements(html);
  evidence.push(...validationCheck.evidence);

  // Check for feedback-related classes
  if (hasClassOrId(html, 'feedback')) {
    evidence.push('Found feedback section');
  }
  if (hasClassOrId(html, 'message') || hasClassOrId(html, 'alert')) {
    evidence.push('Found message/alert element');
  }

  // Check for real-time validation patterns in scripts
  const validationScriptPatterns = [
    /oninput\s*=/i,
    /onchange\s*=/i,
    /onblur\s*=/i,
    /addEventListener\s*\(\s*["'](?:input|change|blur)["']/i,
  ];

  for (const pattern of validationScriptPatterns) {
    if (pattern.test(html)) {
      evidence.push('Found real-time validation event handler');
      break;
    }
  }

  // Check for visual feedback indicators
  const feedbackIndicators = [
    /\.valid\s*\{/i,
    /\.invalid\s*\{/i,
    /\.error\s*\{/i,
    /\.success\s*\{/i,
    /:valid\s*\{/i,
    /:invalid\s*\{/i,
  ];

  for (const pattern of feedbackIndicators) {
    if (pattern.test(html)) {
      evidence.push('Found CSS validation styling');
      break;
    }
  }

  // Check for form element
  if (/<form\b/i.test(html)) {
    evidence.push('Found form element');
  }

  const hasFeedback = evidence.length >= 2;
  const score: 0 | 0.5 | 1 = hasFeedback ? 1 : evidence.length > 0 ? 0.5 : 0;

  return {
    criterion_id: 'feedback',
    score,
    passed: score === 1,
    reason: score === 1
      ? 'Tool provides instant feedback with validation and visual indicators'
      : score === 0.5
        ? 'Tool has some feedback elements but could provide more instant validation'
        : 'Missing input validation - users won\'t know if entries are correct',
    evidence,
  };
}
