/**
 * Results Criterion Check
 * Feature: 020-self-improving-factory
 *
 * Checks for results section with visible verdict (Results Visibility criterion).
 * Per FR-010: System MUST check for results section with visible verdict.
 */

import { CriterionScore } from '../types';
import { hasResultsSection, hasClassOrId, extractTextContent } from '../htmlAnalyzer';

/**
 * Check for results criterion (crystal clear verdict)
 *
 * Passes if:
 * - Tool has a dedicated results section
 * - Results are visually prominent
 * - Verdict includes specific next action
 */
export async function checkResults(html: string): Promise<CriterionScore> {
  const evidence: string[] = [];

  // Check for results section
  const resultsCheck = hasResultsSection(html);
  evidence.push(...resultsCheck.evidence);

  // Check for summary/conclusion section
  if (hasClassOrId(html, 'summary')) {
    evidence.push('Found summary section');
  }
  if (hasClassOrId(html, 'conclusion')) {
    evidence.push('Found conclusion section');
  }
  if (hasClassOrId(html, 'output')) {
    evidence.push('Found output section');
  }

  // Check for results display patterns
  const resultsPatterns = [
    /your\s*result/i,
    /your\s*score/i,
    /final\s*result/i,
    /here['']?s\s*what/i,
    /based\s*on\s*your/i,
  ];

  for (const pattern of resultsPatterns) {
    if (pattern.test(html)) {
      evidence.push(`Found results text: "${html.match(pattern)?.[0]}"`);
      break;
    }
  }

  // Check for action/recommendation in results
  const actionPatterns = [
    /next\s*step/i,
    /recommended\s*action/i,
    /you\s*should/i,
    /we\s*recommend/i,
    /action\s*item/i,
  ];

  for (const pattern of actionPatterns) {
    if (pattern.test(html)) {
      evidence.push('Found actionable recommendation in results');
      break;
    }
  }

  // Check for visual prominence (large text, highlighting)
  const prominencePatterns = [
    /font-size\s*:\s*(\d+)(px|em|rem)/i,
    /font-weight\s*:\s*(bold|[6-9]00)/i,
    /text-transform\s*:\s*uppercase/i,
  ];

  for (const pattern of prominencePatterns) {
    if (pattern.test(html)) {
      evidence.push('Found visually prominent styling');
      break;
    }
  }

  const hasResults = resultsCheck.found || evidence.length >= 2;
  const score: 0 | 0.5 | 1 = hasResults ? 1 : evidence.length > 0 ? 0.5 : 0;

  return {
    criterion_id: 'results',
    score,
    passed: score === 1,
    reason: score === 1
      ? 'Tool has clear results section with visible verdict and next steps'
      : score === 0.5
        ? 'Tool has some results elements but verdict could be clearer'
        : 'Missing results section - users won\'t see clear outcomes',
    evidence,
  };
}
