/**
 * Schema Field Service (Supabase)
 *
 * Manages the schema_fields table that defines the 130 canonical fields
 * across the 31-sprint Fast Track program.
 */

import { getSupabase } from '../client';
import { SchemaField } from '../types';

/**
 * Get a single schema field by field_id
 *
 * @param fieldId - Unique field identifier (e.g., "identity.dream.one_sentence")
 * @returns SchemaField or null if not found
 */
export async function getFieldById(fieldId: string): Promise<SchemaField | null> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('schema_fields')
    .select('*')
    .eq('field_id', fieldId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw new Error(`Failed to get field ${fieldId}: ${error.message}`);
  }

  return data;
}

/**
 * Get all fields produced by or used by a specific tool
 *
 * @param toolSlug - Tool identifier (e.g., "sprint_002_dream")
 * @param relationship - Whether to get fields "produced_by" or "used_by" this tool
 * @returns Array of SchemaField objects
 */
export async function getFieldsByTool(
  toolSlug: string,
  relationship: 'produced_by' | 'used_by' = 'produced_by'
): Promise<SchemaField[]> {
  const supabase = getSupabase();

  let query = supabase.from('schema_fields').select('*');

  if (relationship === 'produced_by') {
    query = query.eq('produced_by_tool', toolSlug);
  } else {
    // For 'used_by', we need to check if toolSlug is in the used_by_tools array
    query = query.contains('used_by_tools', [toolSlug]);
  }

  const { data, error } = await query.order('sprint_number', { ascending: true });

  if (error) {
    throw new Error(`Failed to get fields for tool ${toolSlug}: ${error.message}`);
  }

  return data || [];
}

/**
 * Get all fields for a specific sprint
 *
 * @param sprintNumber - Sprint number (1-31)
 * @returns Array of SchemaField objects
 */
export async function getFieldsBySprint(sprintNumber: number): Promise<SchemaField[]> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('schema_fields')
    .select('*')
    .eq('sprint_number', sprintNumber)
    .order('field_id', { ascending: true });

  if (error) {
    throw new Error(`Failed to get fields for sprint ${sprintNumber}: ${error.message}`);
  }

  return data || [];
}

/**
 * Get all fields for a specific module
 *
 * @param moduleNumber - Module number (0-8)
 * @returns Array of SchemaField objects
 */
export async function getFieldsByModule(moduleNumber: number): Promise<SchemaField[]> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('schema_fields')
    .select('*')
    .eq('module_number', moduleNumber)
    .order('sprint_number', { ascending: true });

  if (error) {
    throw new Error(`Failed to get fields for module ${moduleNumber}: ${error.message}`);
  }

  return data || [];
}

/**
 * Validate that a field_id exists in schema_fields table
 *
 * Used by fieldResponseService before saving responses (FR-013)
 *
 * @param fieldId - Field identifier to validate
 * @returns true if field exists, false otherwise
 */
export async function validateFieldId(fieldId: string): Promise<boolean> {
  const field = await getFieldById(fieldId);
  return field !== null;
}

/**
 * Get multiple fields by their field_ids
 *
 * Optimized for batch fetching (e.g., fetching all dependency fields at once)
 *
 * @param fieldIds - Array of field identifiers
 * @returns Array of SchemaField objects
 */
export async function getFieldsByIds(fieldIds: string[]): Promise<SchemaField[]> {
  if (fieldIds.length === 0) return [];

  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('schema_fields')
    .select('*')
    .in('field_id', fieldIds);

  if (error) {
    throw new Error(`Failed to get fields by IDs: ${error.message}`);
  }

  return data || [];
}

/**
 * Get all schema fields (used for reporting/admin purposes)
 *
 * @returns Array of all SchemaField objects
 */
export async function getAllFields(): Promise<SchemaField[]> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('schema_fields')
    .select('*')
    .order('module_number', { ascending: true })
    .order('sprint_number', { ascending: true })
    .order('field_id', { ascending: true });

  if (error) {
    throw new Error(`Failed to get all fields: ${error.message}`);
  }

  return data || [];
}
