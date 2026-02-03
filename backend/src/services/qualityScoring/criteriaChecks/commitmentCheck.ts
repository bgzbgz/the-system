/**
 * Commitment Criterion Check
 * Feature: 020-self-improving-factory
 *
 * Checks for WWW (Who/What/When) commitment section (Commitment criterion).
 * Per FR-011: System MUST check for WWW commitment section.
 */

import { CriterionScore } from '../types';
import { hasCommitmentSection, hasClassOrId } from '../htmlAnalyzer';

/**
 * Check for commitment criterion (public commitment)
 *
 * Passes if:
 * - Tool has WWW (Who/What/When) section
 * - Includes commitment or action plan section
 * - Has sharing/export capability
 */
export async function checkCommitment(html: string): Promise<CriterionScore> {
  const evidence: string[] = [];

  // Check for commitment section
  const commitmentCheck = hasCommitmentSection(html);
  evidence.push(...commitmentCheck.evidence);

  // Check for action plan elements
  if (hasClassOrId(html, 'action-plan') || hasClassOrId(html, 'actionplan')) {
    evidence.push('Found action-plan section');
  }
  if (hasClassOrId(html, 'next-steps') || hasClassOrId(html, 'nextsteps')) {
    evidence.push('Found next-steps section');
  }

  // Check for commitment text patterns
  const commitmentPatterns = [
    /i\s*will\b/i,
    /i\s*commit\b/i,
    /my\s*commitment/i,
    /my\s*plan/i,
    /action\s*items?/i,
    /to[-\s]?do/i,
  ];

  for (const pattern of commitmentPatterns) {
    if (pattern.test(html)) {
      evidence.push(`Found commitment text: "${html.match(pattern)?.[0]}"`);
      break;
    }
  }

  // Check for deadline/date elements
  const deadlinePatterns = [
    /deadline/i,
    /due\s*date/i,
    /by\s*when/i,
    /target\s*date/i,
    /type\s*=\s*["']date["']/i,
  ];

  for (const pattern of deadlinePatterns) {
    if (pattern.test(html)) {
      evidence.push('Found deadline/date element');
      break;
    }
  }

  // Check for share/export/print functionality
  const sharePatterns = [
    /share/i,
    /export/i,
    /print/i,
    /download/i,
    /email/i,
    /copy\s*to\s*clipboard/i,
  ];

  for (const pattern of sharePatterns) {
    if (pattern.test(html)) {
      evidence.push('Found sharing/export capability');
      break;
    }
  }

  // Check for accountability partner section
  if (/accountability|partner|buddy|mentor/i.test(html)) {
    evidence.push('Found accountability partner section');
  }

  const hasCommitment = commitmentCheck.found || evidence.length >= 3;
  const score: 0 | 0.5 | 1 = hasCommitment ? 1 : evidence.length >= 2 ? 0.5 : 0;

  return {
    criterion_id: 'commitment',
    score,
    passed: score === 1,
    reason: score === 1
      ? 'Tool has commitment section with WWW (Who/What/When) and sharing options'
      : score === 0.5
        ? 'Tool has some commitment elements but WWW section incomplete'
        : 'Missing commitment section - users won\'t make public commitments',
    evidence,
  };
}
