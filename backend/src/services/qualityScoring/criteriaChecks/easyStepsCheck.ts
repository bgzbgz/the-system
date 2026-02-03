/**
 * Easy Steps Criterion Check
 * Feature: 020-self-improving-factory
 *
 * Checks for welcome slide/screen presence (Easy First Steps criterion).
 * Per FR-007: System MUST check for welcome slide/screen presence.
 */

import { CriterionScore } from '../types';
import { hasWelcomeSection, hasClassOrId } from '../htmlAnalyzer';

/**
 * Check for easy first steps criterion
 *
 * Passes if:
 * - Tool has a welcome/intro section
 * - First action is clear and simple
 * - User knows where to start
 */
export async function checkEasySteps(html: string): Promise<CriterionScore> {
  const evidence: string[] = [];

  // Check for welcome section
  const welcomeCheck = hasWelcomeSection(html);
  evidence.push(...welcomeCheck.evidence);

  // Check for step indicators
  if (hasClassOrId(html, 'step-1') || hasClassOrId(html, 'step1')) {
    evidence.push('Found step-1 indicator');
  }

  // Check for first-action indicators
  if (hasClassOrId(html, 'start') || hasClassOrId(html, 'begin')) {
    evidence.push('Found start/begin section');
  }

  // Check for clear CTA (call to action)
  const ctaPatterns = [
    /get\s*started/i,
    /start\s*now/i,
    /begin\s*here/i,
    /first\s*step/i,
    /click\s*here\s*to\s*start/i,
  ];

  for (const pattern of ctaPatterns) {
    if (pattern.test(html)) {
      evidence.push(`Found CTA: "${html.match(pattern)?.[0]}"`);
    }
  }

  // Check for wizard/phase structure (multi-step)
  if (hasClassOrId(html, 'wizard') || hasClassOrId(html, 'phase')) {
    evidence.push('Found wizard/phase structure');
  }

  const hasEasyEntry = evidence.length >= 2;
  const score: 0 | 0.5 | 1 = hasEasyEntry ? 1 : evidence.length > 0 ? 0.5 : 0;

  return {
    criterion_id: 'easy_steps',
    score,
    passed: score === 1,
    reason: score === 1
      ? 'Tool has clear entry point with welcome section or guided start'
      : score === 0.5
        ? 'Tool has some guidance but entry point could be clearer'
        : 'Missing welcome section - user won\'t know where to start',
    evidence,
  };
}
