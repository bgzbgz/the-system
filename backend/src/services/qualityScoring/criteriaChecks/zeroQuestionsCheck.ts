/**
 * Zero Questions Criterion Check
 * Feature: 020-self-improving-factory
 *
 * Checks for placeholder text in all input fields (Zero Questions criterion).
 * Per FR-006: System MUST check for placeholder text in all input fields.
 */

import { CriterionScore } from '../types';
import { countInputsWithPlaceholder } from '../htmlAnalyzer';

/**
 * Check for zero questions criterion (all inputs have placeholders/labels)
 *
 * Passes if:
 * - All input fields have placeholder text
 * - Users don't need to guess what to enter
 */
export async function checkZeroQuestions(html: string): Promise<CriterionScore> {
  const evidence: string[] = [];
  const { total, withPlaceholder } = countInputsWithPlaceholder(html);

  if (total === 0) {
    // No inputs - might be a display-only tool
    return {
      criterion_id: 'zero_questions',
      score: 1,
      passed: true,
      reason: 'Tool has no input fields (display-only)',
      evidence: ['No input elements found'],
    };
  }

  const coverage = withPlaceholder / total;
  evidence.push(`${withPlaceholder}/${total} inputs have placeholder text`);

  // Check for labels as alternative
  const labelPattern = /<label\b[^>]*>/gi;
  const labels = html.match(labelPattern) || [];
  if (labels.length > 0) {
    evidence.push(`Found ${labels.length} <label> elements`);
  }

  // Check for aria-label attributes
  const ariaLabels = html.match(/aria-label\s*=\s*["'][^"']+["']/gi) || [];
  if (ariaLabels.length > 0) {
    evidence.push(`Found ${ariaLabels.length} aria-label attributes`);
  }

  // Calculate score
  let score: 0 | 0.5 | 1 = 0;
  const effectiveCoverage = Math.min(1, (withPlaceholder + labels.length) / total);

  if (coverage >= 0.9 || effectiveCoverage >= 0.9) {
    score = 1; // 90%+ inputs have placeholders/labels
  } else if (coverage >= 0.5 || effectiveCoverage >= 0.5) {
    score = 0.5; // 50-89% have guidance
  }

  return {
    criterion_id: 'zero_questions',
    score,
    passed: score === 1,
    reason: score === 1
      ? 'All inputs have clear placeholder text or labels'
      : score === 0.5
        ? 'Some inputs lack placeholder text or labels'
        : 'Most inputs lack placeholder text - users won\'t know what to enter',
    evidence,
  };
}
