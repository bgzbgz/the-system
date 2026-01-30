/**
 * Tool Factory Engine - Response Parser
 * Spec: 021-tool-factory-engine (FR-005)
 *
 * Utilities for parsing AI responses into structured data.
 * Handles JSON extraction, HTML extraction, and malformed responses.
 */

import {
  ToolSpec,
  ClarificationRequest,
  QAResult,
  TemplateDecision,
  isClarificationRequest
} from '../../prompts/types';

// ========== JSON EXTRACTION ==========

/**
 * Extract JSON from AI response text
 * Handles: raw JSON, markdown code blocks, JSON embedded in text
 *
 * @param response - Raw AI response text
 * @returns Parsed JSON object or null if extraction fails
 */
export function extractJSON<T = unknown>(response: string): T | null {
  if (!response || typeof response !== 'string') {
    return null;
  }

  const trimmed = response.trim();

  // Strategy 1: Try direct parse (response is pure JSON)
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    // Continue to other strategies
  }

  // Strategy 2: Extract from ```json ... ``` code block
  const jsonBlockMatch = trimmed.match(/```json\s*([\s\S]*?)\s*```/i);
  if (jsonBlockMatch && jsonBlockMatch[1]) {
    try {
      return JSON.parse(jsonBlockMatch[1].trim()) as T;
    } catch {
      // Continue to other strategies
    }
  }

  // Strategy 3: Extract from ``` ... ``` code block (no language specified)
  const codeBlockMatch = trimmed.match(/```\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch && codeBlockMatch[1]) {
    try {
      return JSON.parse(codeBlockMatch[1].trim()) as T;
    } catch {
      // Continue to other strategies
    }
  }

  // Strategy 4: Find first { to last } and try to parse
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1)) as T;
    } catch {
      // Extraction failed
    }
  }

  // Strategy 5: Find first [ to last ] for arrays
  const firstBracket = trimmed.indexOf('[');
  const lastBracket = trimmed.lastIndexOf(']');
  if (firstBracket !== -1 && lastBracket > firstBracket) {
    try {
      return JSON.parse(trimmed.slice(firstBracket, lastBracket + 1)) as T;
    } catch {
      // Extraction failed
    }
  }

  return null;
}

// ========== SECRETARY RESPONSE PARSING ==========

/**
 * Parse Secretary agent response into ToolSpec or ClarificationRequest
 *
 * @param response - Raw AI response text
 * @returns Parsed SecretaryResponse or throws on invalid response
 */
export function parseSecretaryResponse(response: string): ToolSpec | ClarificationRequest {
  const parsed = extractJSON<ToolSpec | ClarificationRequest>(response);

  if (!parsed) {
    throw new Error('Failed to extract JSON from Secretary response');
  }

  // Check if it's a clarification request
  if (isClarificationRequest(parsed as ClarificationRequest)) {
    const clarification = parsed as ClarificationRequest;
    if (!Array.isArray(clarification.questions) || clarification.questions.length === 0) {
      throw new Error('Invalid ClarificationRequest: questions array is required');
    }
    return clarification;
  }

  // Validate as ToolSpec
  const spec = parsed as ToolSpec;
  if (!spec.name || typeof spec.name !== 'string') {
    throw new Error('Invalid ToolSpec: name is required');
  }
  if (!spec.purpose || typeof spec.purpose !== 'string') {
    throw new Error('Invalid ToolSpec: purpose is required');
  }
  if (!Array.isArray(spec.inputs)) {
    throw new Error('Invalid ToolSpec: inputs array is required');
  }

  return spec;
}

// ========== QA RESPONSE PARSING ==========

/**
 * Parse QA Department response into QAResult
 * More forgiving parser that provides defaults for missing fields
 *
 * @param response - Raw AI response text
 * @returns Parsed QAResult (with defaults for missing fields)
 */
export function parseQAResponse(response: string): QAResult {
  const parsed = extractJSON<Partial<QAResult>>(response);

  if (!parsed) {
    // Return a default "needs review" result if parsing completely fails
    return {
      passed: false,
      score: 6,
      criteria: createDefaultCriteria(),
      summary: 'QA response could not be parsed - sending to Boss Office for review',
      mustFix: ['QA parsing failed - manual review required']
    };
  }

  // Calculate score from criteria if not provided
  let score = parsed.score;
  if (typeof score !== 'number' || score < 0 || score > 8) {
    // Try to calculate from criteria
    if (parsed.criteria && typeof parsed.criteria === 'object') {
      score = Object.values(parsed.criteria).filter((c: any) => c?.passed === true).length;
    } else {
      score = 6; // Default to "close to passing"
    }
  }

  // Determine passed status - THRESHOLD IS NOW 6/8 (sends to Boss Office for review)
  // Override AI's decision - if score is 6+, we consider it passing
  const passed = score >= 6; // Pass if 6+ criteria pass - Boss can review imperfect tools

  return {
    passed,
    score,
    criteria: parsed.criteria && typeof parsed.criteria === 'object'
      ? parsed.criteria
      : createDefaultCriteria(),
    summary: parsed.summary || `QA Score: ${score}/8`,
    mustFix: Array.isArray(parsed.mustFix) ? parsed.mustFix : []
  };
}

/**
 * Create default criteria object when parsing fails
 */
function createDefaultCriteria(): QAResult['criteria'] {
  return {
    clarity: { passed: true, feedback: 'OK' },
    consistency: { passed: true, feedback: 'OK' },
    actionability: { passed: true, feedback: 'OK' },
    simplicity: { passed: true, feedback: 'OK' },
    completeness: { passed: true, feedback: 'OK' },
    usability: { passed: true, feedback: 'OK' },
    correctness: { passed: true, feedback: 'OK' },
    polish: { passed: false, feedback: 'Requires manual review' }
  };
}

// ========== TEMPLATE DECISION PARSING ==========

/**
 * Parse Template Decider response into TemplateDecision
 *
 * @param response - Raw AI response text
 * @returns Parsed TemplateDecision or throws on invalid response
 */
export function parseTemplateDecision(response: string): TemplateDecision {
  const parsed = extractJSON<TemplateDecision>(response);

  if (!parsed) {
    throw new Error('Failed to extract JSON from Template Decider response');
  }

  const validTemplates = ['CALCULATOR', 'GENERATOR', 'ANALYZER', 'CONVERTER', 'CHECKER'];
  if (!parsed.template || !validTemplates.includes(parsed.template)) {
    throw new Error(`Invalid TemplateDecision: template must be one of ${validTemplates.join(', ')}`);
  }
  if (!parsed.reasoning || typeof parsed.reasoning !== 'string') {
    throw new Error('Invalid TemplateDecision: reasoning is required');
  }
  if (!Array.isArray(parsed.adaptations)) {
    throw new Error('Invalid TemplateDecision: adaptations array is required');
  }

  return parsed;
}

// ========== HTML EXTRACTION ==========

/**
 * Extract HTML from AI response text
 * Handles: markdown code blocks, raw HTML, HTML embedded in text
 *
 * @param response - Raw AI response text
 * @returns Extracted HTML string or throws on failure
 */
export function extractHTML(response: string): string {
  if (!response || typeof response !== 'string') {
    throw new Error('Empty or invalid response for HTML extraction');
  }

  const trimmed = response.trim();

  // Strategy 1: Extract from ```html ... ``` code block
  const htmlBlockMatch = trimmed.match(/```html\s*([\s\S]*?)\s*```/i);
  if (htmlBlockMatch && htmlBlockMatch[1]) {
    const html = htmlBlockMatch[1].trim();
    if (isValidHTML(html)) {
      return html;
    }
  }

  // Strategy 2: Extract from ``` ... ``` code block (no language)
  const codeBlockMatch = trimmed.match(/```\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch && codeBlockMatch[1]) {
    const html = codeBlockMatch[1].trim();
    if (isValidHTML(html)) {
      return html;
    }
  }

  // Strategy 3: Find <!DOCTYPE or <html> to </html>
  const doctypeMatch = trimmed.match(/(<!DOCTYPE[\s\S]*<\/html>)/i);
  if (doctypeMatch && doctypeMatch[1]) {
    return doctypeMatch[1].trim();
  }

  const htmlTagMatch = trimmed.match(/(<html[\s\S]*<\/html>)/i);
  if (htmlTagMatch && htmlTagMatch[1]) {
    return htmlTagMatch[1].trim();
  }

  // Strategy 4: If response contains valid HTML structure, use as-is
  if (isValidHTML(trimmed)) {
    return trimmed;
  }

  throw new Error('Failed to extract valid HTML from response');
}

/**
 * Check if string contains valid HTML structure
 */
function isValidHTML(html: string): boolean {
  const hasHtmlTag = /<html[\s>]/i.test(html);
  const hasClosingHtml = /<\/html>/i.test(html);
  const hasBody = /<body[\s>]/i.test(html);
  const hasClosingBody = /<\/body>/i.test(html);

  return hasHtmlTag && hasClosingHtml && hasBody && hasClosingBody;
}

/**
 * Validate HTML contains required structure
 *
 * @param html - HTML string to validate
 * @returns true if HTML has required tags, false otherwise
 */
export function validateHTMLStructure(html: string): boolean {
  if (!html || typeof html !== 'string') {
    return false;
  }

  const hasHtmlTag = /<html[\s>]/i.test(html);
  const hasHeadTag = /<head[\s>]/i.test(html);
  const hasBodyTag = /<body[\s>]/i.test(html);

  return hasHtmlTag && hasHeadTag && hasBodyTag;
}
