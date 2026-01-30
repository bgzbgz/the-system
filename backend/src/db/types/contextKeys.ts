/**
 * System Context Keys
 * Spec: 017-mongodb-schema
 *
 * Per data-model.md Required Documents table
 * Constants for all system context document keys
 */

/**
 * System context document keys
 * Per spec: 4 required context documents for AI factory
 */
export const ContextKeys = {
  COMPANY_APPROACH: 'company-approach',
  MISTAKES_FEEDBACK: 'mistakes-feedback',
  EIGHT_POINT_CRITERIA: '8-point-criteria',
  QA_VALIDATION_CRITERIA: 'qa-validation-criteria'
} as const;

/**
 * Context key union type
 */
export type ContextKey = typeof ContextKeys[keyof typeof ContextKeys];

/**
 * All required context keys as array
 * Used for initialization seeding
 */
export const REQUIRED_CONTEXTS: ContextKey[] = Object.values(ContextKeys);

/**
 * Context key to title mapping
 * Per data-model.md Required Documents table
 */
export const CONTEXT_TITLES: Record<ContextKey, string> = {
  [ContextKeys.COMPANY_APPROACH]: 'Company Approach',
  [ContextKeys.MISTAKES_FEEDBACK]: 'Mistakes & Feedback',
  [ContextKeys.EIGHT_POINT_CRITERIA]: '8-Point Quality Criteria',
  [ContextKeys.QA_VALIDATION_CRITERIA]: 'QA Validation Criteria'
};

/**
 * Get the display title for a context key
 * @param key - Context key
 * @returns Display title
 */
export function getContextTitle(key: ContextKey): string {
  return CONTEXT_TITLES[key] || key;
}

/**
 * Validate that a string is a valid context key
 * @param key - String to validate
 * @returns true if valid context key
 */
export function isValidContextKey(key: string): key is ContextKey {
  return REQUIRED_CONTEXTS.includes(key as ContextKey);
}
