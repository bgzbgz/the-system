/**
 * Decision Criterion Check
 * Feature: 020-self-improving-factory
 *
 * Checks for GO/NO-GO verdict presence (Final Decision criterion).
 * Per FR-005: System MUST check for GO/NO-GO verdict presence in generated tool.
 */

import { CriterionScore } from '../types';
import { VERDICT_PATTERNS, hasClassOrId, findPatternMatches } from '../htmlAnalyzer';

/**
 * Check for decision/verdict criterion
 *
 * Passes if:
 * - Tool contains a clear verdict (GO/NO-GO, PROCEED/STOP, etc.)
 * - Has a verdict section or class
 */
export async function checkDecision(html: string): Promise<CriterionScore> {
  const evidence: string[] = [];

  // Check for verdict patterns in HTML
  const verdictMatches = findPatternMatches(html, VERDICT_PATTERNS);
  for (const match of verdictMatches) {
    evidence.push(`Found verdict: "${match}"`);
  }

  // Check for verdict section/class
  if (hasClassOrId(html, 'verdict')) {
    evidence.push('Found verdict section');
  }
  if (hasClassOrId(html, 'decision')) {
    evidence.push('Found decision section');
  }
  if (hasClassOrId(html, 'result')) {
    evidence.push('Found result section');
  }
  if (hasClassOrId(html, 'recommendation')) {
    evidence.push('Found recommendation section');
  }

  const hasVerdict = evidence.length > 0;

  // Partial score if has section but no clear verdict text
  let score: 0 | 0.5 | 1 = 0;
  if (verdictMatches.length > 0) {
    score = 1; // Full pass - has clear verdict text
  } else if (evidence.length > 0) {
    score = 0.5; // Partial - has section but no clear GO/NO-GO
  }

  return {
    criterion_id: 'decision',
    score,
    passed: score === 1,
    reason: score === 1
      ? 'Tool includes clear verdict (GO/NO-GO or similar)'
      : score === 0.5
        ? 'Tool has verdict section but no clear GO/NO-GO decision text'
        : 'Missing verdict section - tool must end with clear decision',
    evidence,
  };
}
