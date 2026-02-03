/**
 * HTML Analyzer Utility
 * Feature: 020-self-improving-factory
 *
 * Regex-based HTML analysis utilities for quality scoring.
 * Per research.md: Uses pattern matching for speed and simplicity.
 */

// ========== PATTERN DEFINITIONS ==========

/**
 * Verdict patterns for decision criterion
 */
export const VERDICT_PATTERNS = [
  /\bGO\b/i,
  /\bNO-GO\b/i,
  /\bNO GO\b/i,
  /\bPROCEED\b/i,
  /\bSTOP\b/i,
  /\bYES\b.*\bNO\b/i,
  /\bAPPROVED\b/i,
  /\bREJECTED\b/i,
  /\bRECOMMENDED\b/i,
  /\bNOT RECOMMENDED\b/i,
];

/**
 * Brand colors per Constitution
 */
export const BRAND_COLORS = {
  black: '#000',
  white: '#FFF',
  yellow: '#FFF469',
  gray: '#B2B2B2',
};

/**
 * Forbidden styles
 */
export const FORBIDDEN_PATTERNS = {
  roundedCorners: /border-radius\s*:\s*[1-9]/i,
};

// ========== ANALYSIS FUNCTIONS ==========

/**
 * Find all matches of patterns in HTML
 */
export function findPatternMatches(html: string, patterns: RegExp[]): string[] {
  const matches: string[] = [];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) {
      matches.push(match[0]);
    }
  }
  return matches;
}

/**
 * Check if HTML contains a pattern
 */
export function containsPattern(html: string, pattern: RegExp): boolean {
  return pattern.test(html);
}

/**
 * Check for class or id presence
 */
export function hasClassOrId(html: string, name: string): boolean {
  const classPattern = new RegExp(`class\\s*=\\s*["'][^"']*\\b${name}\\b[^"']*["']`, 'i');
  const idPattern = new RegExp(`id\\s*=\\s*["']${name}["']`, 'i');
  return classPattern.test(html) || idPattern.test(html);
}

/**
 * Count input elements with placeholder text
 */
export function countInputsWithPlaceholder(html: string): { total: number; withPlaceholder: number } {
  // Match input, textarea, and select elements
  const inputPattern = /<input\s[^>]*>/gi;
  const textareaPattern = /<textarea\s[^>]*>/gi;
  const selectPattern = /<select\s[^>]*>/gi;

  const inputs = html.match(inputPattern) || [];
  const textareas = html.match(textareaPattern) || [];

  // Inputs and textareas can have placeholders
  const allInputs = [...inputs, ...textareas];
  const total = allInputs.length;

  const withPlaceholder = allInputs.filter(el =>
    /placeholder\s*=\s*["'][^"']+["']/i.test(el)
  ).length;

  return { total, withPlaceholder };
}

/**
 * Check for progress bar or progress indicator
 */
export function hasProgressIndicator(html: string): { found: boolean; evidence: string[] } {
  const evidence: string[] = [];

  // Check for progress bar classes
  if (hasClassOrId(html, 'progress')) {
    evidence.push('Found class/id "progress"');
  }
  if (hasClassOrId(html, 'progress-bar')) {
    evidence.push('Found class/id "progress-bar"');
  }

  // Check for HTML5 progress element
  if (/<progress\b/i.test(html)) {
    evidence.push('Found <progress> element');
  }

  // Check for percentage display
  if (/\d+\s*%/.test(html)) {
    evidence.push('Found percentage display');
  }

  // Check for step indicators
  if (/step\s*\d+\s*(of|\/)\s*\d+/i.test(html)) {
    evidence.push('Found step indicator');
  }

  return { found: evidence.length > 0, evidence };
}

/**
 * Check for WWW commitment section (Who/What/When)
 */
export function hasCommitmentSection(html: string): { found: boolean; evidence: string[] } {
  const evidence: string[] = [];

  // Check for WWW patterns
  if (/\bWHO\b.*:/i.test(html)) evidence.push('Found "WHO:"');
  if (/\bWHAT\b.*:/i.test(html)) evidence.push('Found "WHAT:"');
  if (/\bWHEN\b.*:/i.test(html)) evidence.push('Found "WHEN:"');

  // Check for commitment-related classes
  if (hasClassOrId(html, 'commitment')) {
    evidence.push('Found commitment section');
  }
  if (hasClassOrId(html, 'action-plan')) {
    evidence.push('Found action-plan section');
  }

  // Check for share/print buttons
  if (/share|print|export/i.test(html)) {
    evidence.push('Found share/print option');
  }

  return { found: evidence.length >= 2, evidence };
}

/**
 * Check for welcome/intro section (easy first steps)
 */
export function hasWelcomeSection(html: string): { found: boolean; evidence: string[] } {
  const evidence: string[] = [];

  // Check for welcome-related classes
  if (hasClassOrId(html, 'welcome')) {
    evidence.push('Found welcome section');
  }
  if (hasClassOrId(html, 'intro')) {
    evidence.push('Found intro section');
  }
  if (hasClassOrId(html, 'getting-started')) {
    evidence.push('Found getting-started section');
  }

  // Check for common welcome text
  if (/welcome|get\s*started|let['']s\s*begin/i.test(html)) {
    evidence.push('Found welcome text');
  }

  return { found: evidence.length > 0, evidence };
}

/**
 * Check for input validation elements (feedback criterion)
 */
export function hasValidationElements(html: string): { found: boolean; evidence: string[] } {
  const evidence: string[] = [];

  // Check for validation attributes
  if (/required\s*[=/>]/i.test(html)) {
    evidence.push('Found required attribute');
  }
  if (/pattern\s*=/i.test(html)) {
    evidence.push('Found pattern attribute');
  }
  if (/min\s*=|max\s*=/i.test(html)) {
    evidence.push('Found min/max attributes');
  }

  // Check for validation classes
  if (hasClassOrId(html, 'error') || hasClassOrId(html, 'invalid')) {
    evidence.push('Found error/invalid styling');
  }
  if (hasClassOrId(html, 'valid') || hasClassOrId(html, 'success')) {
    evidence.push('Found valid/success styling');
  }

  // Check for validation scripts
  if (/validate|validation/i.test(html)) {
    evidence.push('Found validation logic');
  }

  return { found: evidence.length >= 2, evidence };
}

/**
 * Check for results/verdict section
 */
export function hasResultsSection(html: string): { found: boolean; evidence: string[] } {
  const evidence: string[] = [];

  // Check for results classes
  if (hasClassOrId(html, 'results')) {
    evidence.push('Found results section');
  }
  if (hasClassOrId(html, 'verdict')) {
    evidence.push('Found verdict section');
  }
  if (hasClassOrId(html, 'outcome')) {
    evidence.push('Found outcome section');
  }

  // Check for verdict patterns
  const verdictMatches = findPatternMatches(html, VERDICT_PATTERNS);
  if (verdictMatches.length > 0) {
    evidence.push(`Found verdict text: ${verdictMatches.join(', ')}`);
  }

  return { found: evidence.length > 0, evidence };
}

/**
 * Check brand compliance (colors, fonts, no rounded corners)
 */
export function checkBrandCompliance(html: string): {
  passed: boolean;
  issues: string[];
  evidence: string[];
} {
  const issues: string[] = [];
  const evidence: string[] = [];

  // Check for rounded corners (forbidden)
  if (FORBIDDEN_PATTERNS.roundedCorners.test(html)) {
    issues.push('Found rounded corners (border-radius > 0)');
  } else {
    evidence.push('No rounded corners found');
  }

  // Check for brand colors (should be present)
  const hasBlack = /#000(?:[^0-9a-f]|$)/i.test(html) || /rgb\s*\(\s*0\s*,\s*0\s*,\s*0\s*\)/i.test(html);
  const hasWhite = /#fff(?:[^0-9a-f]|$)/i.test(html) || /rgb\s*\(\s*255\s*,\s*255\s*,\s*255\s*\)/i.test(html);
  const hasYellow = /#fff469/i.test(html);

  if (hasBlack) evidence.push('Found brand color #000 (black)');
  if (hasWhite) evidence.push('Found brand color #FFF (white)');
  if (hasYellow) evidence.push('Found brand color #FFF469 (yellow)');

  // Brand compliance requires at least 2 brand colors and no forbidden patterns
  const passed = evidence.length >= 2 && issues.length === 0;

  return { passed, issues, evidence };
}

/**
 * Extract text content from HTML (strips tags)
 */
export function extractTextContent(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
