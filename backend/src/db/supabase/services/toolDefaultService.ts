/**
 * Tool Default Service (Supabase)
 *
 * Manages tool configurations (defaults) for Feature 021.
 * Each deployed tool gets one defaults document with:
 * - Tool metadata (name, slug, github_url)
 * - Tool configuration (questions, prompts, validation rules)
 * - Course context (terminology, frameworks, input ranges)
 * - Quality gate settings
 */

import { getSupabase, getTenantId } from '../client';
import { ToolDefault, ToolDefaultInsert, ToolDefaultUpdate } from '../types';

/**
 * Get tool configuration by slug
 */
export async function getToolDefault(toolSlug: string): Promise<ToolDefault | null> {
  const supabase = getSupabase();
  const tenantId = getTenantId();

  const { data, error } = await supabase
    .from('tool_defaults')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('tool_slug', toolSlug)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw new Error(`Failed to get tool default: ${error.message}`);
  }

  return data;
}

/**
 * Create or update tool configuration (on deployment)
 * Uses upsert on tool_slug + tenant_id to handle re-deploys
 */
export async function createToolDefault(toolDefault: ToolDefaultInsert): Promise<ToolDefault> {
  const supabase = getSupabase();
  const tenantId = getTenantId();

  const { data, error } = await supabase
    .from('tool_defaults')
    .upsert(
      { ...toolDefault, tenant_id: tenantId },
      { onConflict: 'tenant_id,tool_slug' }
    )
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to upsert tool default: ${error.message}`);
  }

  return data;
}

/**
 * Update tool configuration
 */
export async function updateToolDefault(
  toolSlug: string,
  updates: ToolDefaultUpdate
): Promise<ToolDefault> {
  const supabase = getSupabase();
  const tenantId = getTenantId();

  const { data, error } = await supabase
    .from('tool_defaults')
    .update(updates)
    .eq('tenant_id', tenantId)
    .eq('tool_slug', toolSlug)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update tool default: ${error.message}`);
  }

  return data;
}

/**
 * List all tool configurations
 */
export async function listToolDefaults(options?: {
  limit?: number;
  offset?: number;
}): Promise<{ tools: ToolDefault[]; total: number }> {
  const supabase = getSupabase();
  const tenantId = getTenantId();
  const { limit = 50, offset = 0 } = options || {};

  const { data, error, count } = await supabase
    .from('tool_defaults')
    .select('*', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new Error(`Failed to list tool defaults: ${error.message}`);
  }

  return {
    tools: data || [],
    total: count || 0
  };
}

/**
 * Delete tool configuration
 */
export async function deleteToolDefault(toolSlug: string): Promise<void> {
  const supabase = getSupabase();
  const tenantId = getTenantId();

  const { error } = await supabase
    .from('tool_defaults')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('tool_slug', toolSlug);

  if (error) {
    throw new Error(`Failed to delete tool default: ${error.message}`);
  }
}

/**
 * Check if tool exists
 */
export async function toolExists(toolSlug: string): Promise<boolean> {
  const tool = await getToolDefault(toolSlug);
  return tool !== null;
}

/**
 * Update course context
 */
export async function updateCourseContext(
  toolSlug: string,
  courseContext: Record<string, unknown>
): Promise<ToolDefault> {
  return updateToolDefault(toolSlug, { course_context: courseContext });
}

/**
 * Update quality gate settings
 */
export async function updateQualityGate(
  toolSlug: string,
  qualityGate: { enabled: boolean; minimumScore: number }
): Promise<ToolDefault> {
  return updateToolDefault(toolSlug, { quality_gate: qualityGate });
}
