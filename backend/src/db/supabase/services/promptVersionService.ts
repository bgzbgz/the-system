/**
 * Prompt Version Service (Supabase)
 * Feature: 020-self-improving-factory
 *
 * Database operations for prompt version control using Supabase.
 * Replaces the MongoDB-based promptVersionStore.
 */

import { getSupabase, getTenantId, isSupabaseConfigured } from '../client';
import { PromptVersion, PromptName } from '../../../services/qualityScoring/types';

// ========== PROMPT VERSIONS ==========

/**
 * Save a prompt version
 */
export async function savePromptVersion(version: Omit<PromptVersion, '_id'>): Promise<PromptVersion> {
  const supabase = getSupabase();
  const tenantId = getTenantId();

  const { data, error } = await supabase
    .from('prompt_versions')
    .insert({
      tenant_id: tenantId,
      prompt_name: version.prompt_name,
      version: version.version,
      content: version.content,
      content_hash: version.content_hash,
      author: version.author,
      change_summary: version.change_summary,
      is_active: version.is_active,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to save prompt version: ${error.message}`);
  }

  return mapToPromptVersion(data);
}

/**
 * Get prompt version by ID
 */
export async function getPromptVersionById(versionId: string): Promise<PromptVersion | null> {
  const supabase = getSupabase();
  const tenantId = getTenantId();

  const { data, error } = await supabase
    .from('prompt_versions')
    .select('*')
    .eq('id', versionId)
    .eq('tenant_id', tenantId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to get prompt version: ${error.message}`);
  }

  return mapToPromptVersion(data);
}

/**
 * Get all versions for a prompt
 */
export async function getVersionsByPromptName(promptName: PromptName): Promise<PromptVersion[]> {
  const supabase = getSupabase();
  const tenantId = getTenantId();

  const { data, error } = await supabase
    .from('prompt_versions')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('prompt_name', promptName)
    .order('version', { ascending: false });

  if (error) {
    throw new Error(`Failed to get prompt versions: ${error.message}`);
  }

  return (data || []).map(mapToPromptVersion);
}

/**
 * Get the currently active version for a prompt
 */
export async function getActiveVersionByPromptName(
  promptName: PromptName
): Promise<PromptVersion | null> {
  const supabase = getSupabase();
  const tenantId = getTenantId();

  const { data, error } = await supabase
    .from('prompt_versions')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('prompt_name', promptName)
    .eq('is_active', true)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to get active prompt version: ${error.message}`);
  }

  return mapToPromptVersion(data);
}

/**
 * Get a specific version by prompt name and version number
 */
export async function getVersionByNumber(
  promptName: PromptName,
  versionNumber: number
): Promise<PromptVersion | null> {
  const supabase = getSupabase();
  const tenantId = getTenantId();

  const { data, error } = await supabase
    .from('prompt_versions')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('prompt_name', promptName)
    .eq('version', versionNumber)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to get prompt version: ${error.message}`);
  }

  return mapToPromptVersion(data);
}

/**
 * Check if a content hash already exists for a prompt
 */
export async function existsByContentHash(
  promptName: PromptName,
  contentHash: string
): Promise<PromptVersion | null> {
  const supabase = getSupabase();
  const tenantId = getTenantId();

  const { data, error } = await supabase
    .from('prompt_versions')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('prompt_name', promptName)
    .eq('content_hash', contentHash)
    .limit(1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to check content hash: ${error.message}`);
  }

  return mapToPromptVersion(data);
}

/**
 * Get the next version number for a prompt
 */
export async function getNextVersionNumber(promptName: PromptName): Promise<number> {
  const supabase = getSupabase();
  const tenantId = getTenantId();

  const { data, error } = await supabase
    .from('prompt_versions')
    .select('version')
    .eq('tenant_id', tenantId)
    .eq('prompt_name', promptName)
    .order('version', { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(`Failed to get next version number: ${error.message}`);
  }

  if (data && data.length > 0) {
    return data[0].version + 1;
  }
  return 1;
}

/**
 * Set a version as active (deactivates all others)
 */
export async function setActiveVersion(
  promptName: PromptName,
  versionNumber: number
): Promise<boolean> {
  const supabase = getSupabase();
  const tenantId = getTenantId();

  // Deactivate all versions for this prompt
  const { error: deactivateError } = await supabase
    .from('prompt_versions')
    .update({ is_active: false })
    .eq('tenant_id', tenantId)
    .eq('prompt_name', promptName);

  if (deactivateError) {
    throw new Error(`Failed to deactivate versions: ${deactivateError.message}`);
  }

  // Activate the specified version
  const { error: activateError, count } = await supabase
    .from('prompt_versions')
    .update({ is_active: true })
    .eq('tenant_id', tenantId)
    .eq('prompt_name', promptName)
    .eq('version', versionNumber);

  if (activateError) {
    throw new Error(`Failed to activate version: ${activateError.message}`);
  }

  return (count || 0) > 0;
}

// ========== HELPER FUNCTIONS ==========

function mapToPromptVersion(data: Record<string, unknown>): PromptVersion {
  return {
    _id: data.id as string,
    prompt_name: data.prompt_name as PromptName,
    version: data.version as number,
    content: data.content as string,
    content_hash: data.content_hash as string,
    author: data.author as string | undefined,
    change_summary: data.change_summary as string | undefined,
    created_at: new Date(data.created_at as string),
    is_active: data.is_active as boolean,
  };
}

// ========== CONFIGURATION CHECK ==========

/**
 * Check if prompt version store is available (Supabase configured)
 */
export function isAvailable(): boolean {
  return isSupabaseConfigured();
}
