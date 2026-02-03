/**
 * Prompt Versioning Service
 * Feature: 020-self-improving-factory
 *
 * Manages prompt versions with content hash deduplication.
 */

import { createHash } from 'crypto';
import {
  PromptVersion,
  PromptName,
  CreatePromptVersionRequest,
} from '../qualityScoring/types';
import * as promptVersionStore from '../../db/services/promptVersionStore';

/**
 * Create a new prompt version with content hash deduplication (T093)
 *
 * @param request - Version creation request
 * @returns Created version (or existing if duplicate content)
 */
export async function createPromptVersion(
  request: CreatePromptVersionRequest
): Promise<PromptVersion> {
  const contentHash = createHash('sha256').update(request.content).digest('hex');

  // Check for duplicate content hash
  const existingWithHash = await promptVersionStore.existsByContentHash(
    request.prompt_name,
    contentHash
  );

  if (existingWithHash) {
    console.log(`[PromptVersioning] Duplicate content detected for ${request.prompt_name}, returning existing version ${existingWithHash.version}`);
    return existingWithHash;
  }

  // Get next version number
  const nextVersion = await promptVersionStore.getNextVersionNumber(request.prompt_name);

  // Create version document
  const version: PromptVersion = {
    prompt_name: request.prompt_name,
    version: nextVersion,
    content: request.content,
    content_hash: contentHash,
    author: request.author || 'system',
    change_summary: request.change_summary,
    created_at: new Date(),
    is_active: false, // New versions start inactive
  };

  // Save via store
  const saved = await promptVersionStore.savePromptVersion(version);

  console.log(`[PromptVersioning] Created version ${nextVersion} for ${request.prompt_name}`);
  return saved;
}

/**
 * Get the currently active version for a prompt (T094)
 *
 * @param promptName - Which prompt to get
 * @returns Active version or null
 */
export async function getActiveVersion(promptName: PromptName): Promise<PromptVersion | null> {
  return promptVersionStore.getActiveVersionByPromptName(promptName);
}

/**
 * Get version history for a prompt (T095)
 *
 * @param promptName - Which prompt to get history for
 * @returns All versions, newest first
 */
export async function getVersionHistory(promptName: PromptName): Promise<PromptVersion[]> {
  return promptVersionStore.getVersionsByPromptName(promptName);
}

/**
 * Set a specific version as active (T096)
 *
 * @param promptName - Which prompt
 * @param version - Version number to activate
 * @returns Success status
 */
export async function setActiveVersion(
  promptName: PromptName,
  version: number
): Promise<boolean> {
  const success = await promptVersionStore.setActiveVersion(promptName, version);

  if (success) {
    console.log(`[PromptVersioning] Activated version ${version} for ${promptName}`);
  }

  return success;
}

/**
 * Get a specific version by number
 */
export async function getVersionByNumber(
  promptName: PromptName,
  version: number
): Promise<PromptVersion | null> {
  return promptVersionStore.getVersionByNumber(promptName, version);
}
