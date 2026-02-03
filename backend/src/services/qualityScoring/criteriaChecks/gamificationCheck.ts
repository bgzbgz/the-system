/**
 * Gamification Criterion Check
 * Feature: 020-self-improving-factory
 *
 * Checks for progress bar or progress indicator (Gamification criterion).
 * Per FR-009: System MUST check for progress bar or progress indicator.
 */

import { CriterionScore } from '../types';
import { hasProgressIndicator, hasClassOrId } from '../htmlAnalyzer';

/**
 * Check for gamification criterion (progress feels rewarding)
 *
 * Passes if:
 * - Tool has progress bar or step indicator
 * - User can see their progress through the tool
 * - Visual feedback on completion
 */
export async function checkGamification(html: string): Promise<CriterionScore> {
  const evidence: string[] = [];

  // Check for progress indicators
  const progressCheck = hasProgressIndicator(html);
  evidence.push(...progressCheck.evidence);

  // Check for achievement/completion indicators
  if (hasClassOrId(html, 'complete') || hasClassOrId(html, 'completed')) {
    evidence.push('Found completion indicator');
  }
  if (hasClassOrId(html, 'achievement') || hasClassOrId(html, 'badge')) {
    evidence.push('Found achievement/badge element');
  }

  // Check for score display
  if (hasClassOrId(html, 'score') || hasClassOrId(html, 'points')) {
    evidence.push('Found score/points display');
  }

  // Check for animated/visual feedback
  const animationPatterns = [
    /@keyframes/i,
    /transition\s*:/i,
    /animation\s*:/i,
  ];

  for (const pattern of animationPatterns) {
    if (pattern.test(html)) {
      evidence.push('Found CSS animations/transitions');
      break;
    }
  }

  // Check for phase/step counter in multi-step tools
  if (/phase\s*\d/i.test(html) || /step\s*\d/i.test(html)) {
    evidence.push('Found phase/step numbering');
  }

  // Check for completion percentage calculations
  if (/\d+\s*%\s*(complete|done|finished)/i.test(html)) {
    evidence.push('Found completion percentage');
  }

  const hasGamification = evidence.length >= 2;
  const score: 0 | 0.5 | 1 = hasGamification ? 1 : evidence.length > 0 ? 0.5 : 0;

  return {
    criterion_id: 'gamification',
    score,
    passed: score === 1,
    reason: score === 1
      ? 'Tool has progress indicators and makes progress feel rewarding'
      : score === 0.5
        ? 'Tool has some progress elements but could be more engaging'
        : 'Missing progress indicators - users won\'t see their progress',
    evidence,
  };
}
