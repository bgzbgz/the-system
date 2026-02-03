/**
 * Brand Criterion Check
 * Feature: 020-self-improving-factory
 *
 * Checks for brand compliance: correct colors, fonts, no rounded corners.
 * Per FR-012: System MUST check for brand compliance.
 */

import { CriterionScore } from '../types';
import { checkBrandCompliance, BRAND_COLORS, FORBIDDEN_PATTERNS } from '../htmlAnalyzer';

/**
 * Forbidden words per Constitution (Principle VII)
 */
const FORBIDDEN_WORDS = [
  /\bdecision[-\s]?making\b/i,
  /\bempower/i,
  /\bunlock/i,
  /\bunleash/i,
  /\bevergreen/i,
  /\bsynerg/i,
  /\bparadigm/i,
  /\bholistic/i,
  /\binnovative\b/i,
  /\brobust\b/i,
  /\bscalable\b/i,
  /\bdisrupt/i,
  /\bleverage\b/i,
];

/**
 * Check for brand criterion (Fast Track DNA)
 *
 * Passes if:
 * - Uses correct brand colors (#000, #FFF, #FFF469, #B2B2B2)
 * - No rounded corners
 * - No forbidden marketing language
 * - Clean, professional typography
 */
export async function checkBrand(html: string): Promise<CriterionScore> {
  const evidence: string[] = [];
  const issues: string[] = [];

  // Check brand compliance (colors, corners)
  const brandCheck = checkBrandCompliance(html);
  evidence.push(...brandCheck.evidence);
  issues.push(...brandCheck.issues);

  // Check for forbidden words
  const foundForbiddenWords: string[] = [];
  for (const pattern of FORBIDDEN_WORDS) {
    const match = html.match(pattern);
    if (match) {
      foundForbiddenWords.push(match[0]);
    }
  }

  if (foundForbiddenWords.length > 0) {
    issues.push(`Found forbidden words: ${foundForbiddenWords.join(', ')}`);
  } else {
    evidence.push('No forbidden marketing language found');
  }

  // Check for professional typography
  const fontPatterns = [
    /font-family\s*:[^;]*sans-serif/i,
    /font-family\s*:[^;]*system-ui/i,
    /font-family\s*:[^;]*arial/i,
    /font-family\s*:[^;]*helvetica/i,
  ];

  for (const pattern of fontPatterns) {
    if (pattern.test(html)) {
      evidence.push('Found clean typography (sans-serif)');
      break;
    }
  }

  // Check for box shadows (acceptable but notable)
  if (/box-shadow\s*:/i.test(html)) {
    evidence.push('Found box-shadow styling');
  }

  // Check for excessive gradients (can be off-brand)
  const gradientCount = (html.match(/linear-gradient|radial-gradient/gi) || []).length;
  if (gradientCount > 3) {
    issues.push(`Found ${gradientCount} gradients (may be off-brand)`);
  }

  // Calculate score
  const hasCriticalIssues = issues.some(i =>
    i.includes('rounded corners') || i.includes('forbidden words')
  );
  const hasGoodBrand = evidence.length >= 3 && !hasCriticalIssues;

  let score: 0 | 0.5 | 1 = 0;
  if (hasGoodBrand && issues.length === 0) {
    score = 1;
  } else if (evidence.length >= 2 && !hasCriticalIssues) {
    score = 0.5;
  }

  return {
    criterion_id: 'brand',
    score,
    passed: score === 1,
    reason: score === 1
      ? 'Tool follows Fast Track brand guidelines (colors, typography, language)'
      : score === 0.5
        ? `Tool has some brand compliance issues: ${issues.join('; ')}`
        : `Tool violates brand guidelines: ${issues.join('; ')}`,
    evidence: [...evidence, ...issues.map(i => `ISSUE: ${i}`)],
  };
}
