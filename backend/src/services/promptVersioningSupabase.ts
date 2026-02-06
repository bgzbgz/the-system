/**
 * Prompt Versioning Service (Supabase)
 * Feature: 020-self-improving-factory
 *
 * Creates and manages prompt versions using Supabase storage.
 */

import * as crypto from 'crypto';
import * as promptVersionStore from '../db/supabase/services/promptVersionService';
import { PromptVersion, CreatePromptVersionRequest } from './qualityScoring/types';

/**
 * Create a new prompt version
 * - Checks for duplicate content via hash
 * - Auto-increments version number
 * - Does NOT auto-activate (explicit activation required)
 */
export async function createPromptVersion(
  request: CreatePromptVersionRequest
): Promise<PromptVersion> {
  const { prompt_name, content, author, change_summary } = request;

  // Generate content hash for deduplication
  const contentHash = crypto
    .createHash('sha256')
    .update(content)
    .digest('hex');

  // Check if this exact content already exists
  const existing = await promptVersionStore.existsByContentHash(prompt_name, contentHash);
  if (existing) {
    console.log(`[PromptVersioning] Content already exists as version ${existing.version}`);
    return existing;
  }

  // Get next version number
  const nextVersion = await promptVersionStore.getNextVersionNumber(prompt_name);

  // Create the version
  const version = await promptVersionStore.savePromptVersion({
    prompt_name,
    version: nextVersion,
    content,
    content_hash: contentHash,
    author,
    change_summary,
    created_at: new Date(),
    is_active: false, // Explicit activation required
  });

  console.log(`[PromptVersioning] Created version ${nextVersion} for ${prompt_name}`);

  return version;
}

/**
 * Get the current active prompt content for an agent
 * Returns null if no active version exists
 */
export async function getActivePromptContent(
  promptName: CreatePromptVersionRequest['prompt_name']
): Promise<string | null> {
  const version = await promptVersionStore.getActiveVersionByPromptName(promptName);
  return version?.content || null;
}

/**
 * Activate a specific version (deactivates all others)
 */
export async function activateVersion(
  promptName: CreatePromptVersionRequest['prompt_name'],
  versionNumber: number
): Promise<boolean> {
  const success = await promptVersionStore.setActiveVersion(promptName, versionNumber);

  if (success) {
    console.log(`[PromptVersioning] Activated version ${versionNumber} for ${promptName}`);
  }

  return success;
}
