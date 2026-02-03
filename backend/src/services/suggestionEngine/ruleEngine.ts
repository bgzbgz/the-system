/**
 * Suggestion Rule Engine
 * Feature: 020-self-improving-factory
 *
 * Rule-based suggestion templates mapping criteria to improvement suggestions.
 */

import { CriterionId, PromptName } from '../qualityScoring/types';

/**
 * Suggestion template for a criterion
 */
export interface SuggestionTemplate {
  criterion_id: CriterionId;
  suggested_change: string;
  prompt_name: PromptName;
  prompt_section?: string;
}

/**
 * Rule templates mapping criteria to suggestions (T056)
 *
 * Per research.md: Rule-based templates with pattern-specific mappings.
 * Each criterion has 2-3 template suggestions targeting specific prompts.
 */
export const SUGGESTION_TEMPLATES: Record<CriterionId, SuggestionTemplate[]> = {
  decision: [
    {
      criterion_id: 'decision',
      suggested_change: 'Add explicit GO/NO-GO verdict requirement to Tool Builder prompt. Ensure results section always includes a clear binary decision with visual emphasis.',
      prompt_name: 'toolBuilder',
      prompt_section: 'RESULTS SECTION',
    },
    {
      criterion_id: 'decision',
      suggested_change: 'Add validation check for verdict presence in QA Department prompt. Flag tools missing clear GO/NO-GO language as must-fix.',
      prompt_name: 'qaDepartment',
      prompt_section: 'QUALITY CHECKS',
    },
  ],

  zero_questions: [
    {
      criterion_id: 'zero_questions',
      suggested_change: 'Strengthen placeholder text requirement in Tool Builder prompt. Every input MUST have descriptive placeholder text that shows users exactly what to enter.',
      prompt_name: 'toolBuilder',
      prompt_section: 'INPUT FIELDS',
    },
    {
      criterion_id: 'zero_questions',
      suggested_change: 'Add example text to Secretary prompt output. Each input should include a sample value in the specification.',
      prompt_name: 'secretary',
      prompt_section: 'INPUT SPECIFICATION',
    },
  ],

  easy_steps: [
    {
      criterion_id: 'easy_steps',
      suggested_change: 'Add welcome section requirement to Tool Builder prompt. Every tool MUST start with a welcome screen that guides users to the first action.',
      prompt_name: 'toolBuilder',
      prompt_section: 'STRUCTURE',
    },
    {
      criterion_id: 'easy_steps',
      suggested_change: 'Add "first step clarity" check to QA Department. Ensure the first required action is obvious within 3 seconds of viewing the tool.',
      prompt_name: 'qaDepartment',
      prompt_section: 'UX CHECKS',
    },
  ],

  feedback: [
    {
      criterion_id: 'feedback',
      suggested_change: 'Add input validation requirement to Tool Builder prompt. All inputs MUST have real-time validation with visual feedback (green/red indicators).',
      prompt_name: 'toolBuilder',
      prompt_section: 'VALIDATION',
    },
    {
      criterion_id: 'feedback',
      suggested_change: 'Enhance feedback patterns in Tool Builder CSS section. Include standard :valid/:invalid pseudo-class styling.',
      prompt_name: 'toolBuilder',
      prompt_section: 'CSS STYLES',
    },
  ],

  gamification: [
    {
      criterion_id: 'gamification',
      suggested_change: 'Add progress indicator requirement to Tool Builder prompt. Multi-step tools MUST show progress (step X of Y, percentage, or progress bar).',
      prompt_name: 'toolBuilder',
      prompt_section: 'PROGRESS TRACKING',
    },
    {
      criterion_id: 'gamification',
      suggested_change: 'Add completion celebration to Tool Builder results section. Include visual feedback when user completes the tool.',
      prompt_name: 'toolBuilder',
      prompt_section: 'RESULTS SECTION',
    },
  ],

  results: [
    {
      criterion_id: 'results',
      suggested_change: 'Strengthen results section visibility in Tool Builder prompt. Verdict MUST be the most prominent element with large text and contrasting colors.',
      prompt_name: 'toolBuilder',
      prompt_section: 'RESULTS SECTION',
    },
    {
      criterion_id: 'results',
      suggested_change: 'Add actionable next steps requirement. Results MUST include specific "do this next" recommendation.',
      prompt_name: 'toolBuilder',
      prompt_section: 'ACTION ITEMS',
    },
  ],

  commitment: [
    {
      criterion_id: 'commitment',
      suggested_change: 'Add WWW (Who/What/When) commitment section requirement to Tool Builder prompt. Every tool MUST capture user commitment with accountable actions.',
      prompt_name: 'toolBuilder',
      prompt_section: 'COMMITMENT SECTION',
    },
    {
      criterion_id: 'commitment',
      suggested_change: 'Add share/export functionality requirement. Users MUST be able to share or print their commitment for accountability.',
      prompt_name: 'toolBuilder',
      prompt_section: 'SHARING',
    },
  ],

  brand: [
    {
      criterion_id: 'brand',
      suggested_change: 'Reinforce brand color requirements in Tool Builder CSS section. Only use #000, #FFF, #FFF469, #B2B2B2. NO rounded corners.',
      prompt_name: 'toolBuilder',
      prompt_section: 'CSS STYLES',
    },
    {
      criterion_id: 'brand',
      suggested_change: 'Add forbidden language check to QA Department. Flag any use of: "decision-making", "empower", "unlock", "unleash", "synergy", etc.',
      prompt_name: 'qaDepartment',
      prompt_section: 'LANGUAGE CHECKS',
    },
    {
      criterion_id: 'brand',
      suggested_change: 'Add CSS validation to Brand Guardian prompt. Automatically detect and flag non-brand colors and rounded corners.',
      prompt_name: 'toolBuilder', // Note: Would be 'brandGuardian' if it existed in PromptName
      prompt_section: 'BRAND VALIDATION',
    },
  ],
};

/**
 * Get suggestion templates for a criterion
 */
export function getSuggestionTemplates(criterionId: CriterionId): SuggestionTemplate[] {
  return SUGGESTION_TEMPLATES[criterionId] || [];
}

/**
 * Get the primary suggestion for a criterion (first template)
 */
export function getPrimarySuggestion(criterionId: CriterionId): SuggestionTemplate | null {
  const templates = SUGGESTION_TEMPLATES[criterionId];
  return templates && templates.length > 0 ? templates[0] : null;
}
