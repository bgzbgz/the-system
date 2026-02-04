/**
 * Prompts Loader Integration
 *
 * Provides backward-compatible interface for loading prompts.
 * Tries PromptLoader first (GitHub), falls back to hardcoded prompts.
 */

import { getPromptLoader, isPromptLoaderConfigured } from '../services/promptLoader';
import { prompts as hardcodedPrompts } from './index';
import { AgentName } from './types';

/**
 * Load a prompt for an agent
 *
 * Priority:
 * 1. PromptLoader (GitHub repository) - if configured
 * 2. Hardcoded prompts (local fallback)
 */
export async function loadPrompt(agentName: AgentName): Promise<string> {
  // Try PromptLoader first (GitHub)
  if (isPromptLoaderConfigured()) {
    try {
      const loader = getPromptLoader();
      const prompt = await loader.fetchPrompt(agentName);
      console.log(`[Prompts] Loaded ${agentName} from GitHub`);
      return prompt;
    } catch (error) {
      console.warn(`[Prompts] Failed to load ${agentName} from GitHub, using fallback:`, error);
    }
  }

  // Fallback to hardcoded prompts
  const hardcodedPrompt = hardcodedPrompts[agentName];
  if (!hardcodedPrompt) {
    throw new Error(`Prompt not found for agent: ${agentName}`);
  }

  console.log(`[Prompts] Using hardcoded prompt for ${agentName}`);
  return hardcodedPrompt.systemPrompt;
}

/**
 * Get active version for an agent (from GitHub)
 */
export async function getPromptVersion(agentName: AgentName): Promise<string | null> {
  if (!isPromptLoaderConfigured()) {
    return null; // Using hardcoded prompts
  }

  try {
    const loader = getPromptLoader();
    return await loader.getActiveVersion(agentName);
  } catch (error) {
    console.error(`[Prompts] Failed to get version for ${agentName}:`, error);
    return null;
  }
}

/**
 * Check if using remote prompts (GitHub) or local fallback
 */
export function isUsingRemotePrompts(): boolean {
  return isPromptLoaderConfigured();
}
