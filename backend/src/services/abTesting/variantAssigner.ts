/**
 * Variant Assigner
 * Feature: 020-self-improving-factory
 *
 * Handles random variant assignment for A/B tests.
 */

import { ABTest, PromptName } from '../qualityScoring/types';
import * as experimentStore from '../../db/services/experimentStore';

/**
 * Assignment result
 */
export interface VariantAssignment {
  variant: 'A' | 'B';
  test: ABTest;
  promptVersionId: string;
}

/**
 * Assign a variant for a prompt (T069)
 *
 * @param promptName - Which prompt is being used
 * @returns Variant assignment or null if no active test
 */
export async function assignVariant(
  promptName: PromptName
): Promise<VariantAssignment | null> {
  // Get active test for this prompt
  const activeTest = await experimentStore.getActiveTestForPrompt(promptName);

  if (!activeTest || activeTest.status !== 'running') {
    return null;
  }

  // Simple random assignment (50/50)
  const variant: 'A' | 'B' = Math.random() < 0.5 ? 'A' : 'B';
  const promptVersionId = getPromptVersionForVariant(activeTest, variant);

  console.log(`[ABTesting] Assigned variant ${variant} for ${promptName} (test: ${activeTest.name})`);

  return {
    variant,
    test: activeTest,
    promptVersionId,
  };
}

/**
 * Get the prompt version ID for a variant (T070)
 *
 * @param test - A/B test
 * @param variant - 'A' or 'B'
 * @returns Prompt version ID for the variant
 */
export function getPromptVersionForVariant(
  test: ABTest,
  variant: 'A' | 'B'
): string {
  return variant === 'A'
    ? test.variant_a.prompt_version_id
    : test.variant_b.prompt_version_id;
}

/**
 * Check if there's an active A/B test for a prompt
 */
export async function hasActiveTest(promptName: PromptName): Promise<boolean> {
  const test = await experimentStore.getActiveTestForPrompt(promptName);
  return test !== null && test.status === 'running';
}
