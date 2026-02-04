/**
 * Field Response Service (Supabase)
 *
 * Manages client_field_responses table for field-by-field response storage.
 * Supports auto-save, status transitions, and response retrieval.
 */

import { getSupabase, getTenantId } from '../client';
import { ClientFieldResponse, ClientFieldResponseInsert, FieldStatus } from '../types';
import { validateFieldId } from './schemaFieldService';

/**
 * Save or update a field response (upsert operation)
 *
 * Implements:
 * - FR-001: Store each input field response separately with unique field_id
 * - FR-002: Associate with tenant_id, user_id, tool_slug, field_id, value, status
 * - FR-013: Validate field_id exists before saving
 * - FR-014: Enforce unique constraint (tenant_id, user_id, field_id)
 *
 * @param response - Field response data to save
 * @returns Saved ClientFieldResponse
 * @throws Error if field_id validation fails or save fails
 */
export async function saveFieldResponse(
  response: Omit<ClientFieldResponseInsert, 'tenant_id'>
): Promise<ClientFieldResponse> {
  const supabase = getSupabase();
  const tenantId = getTenantId();

  // FR-013: Validate field_id exists in schema_fields
  const isValid = await validateFieldId(response.field_id);
  if (!isValid) {
    throw new Error(`Invalid field_id: ${response.field_id} does not exist in schema_fields`);
  }

  // Prepare data with tenant_id
  const data: ClientFieldResponseInsert = {
    ...response,
    tenant_id: tenantId,
  };

  // FR-014: Upsert operation with unique constraint on (tenant_id, user_id, field_id)
  const { data: savedData, error } = await supabase
    .from('client_field_responses')
    .upsert(data, {
      onConflict: 'tenant_id,user_id,field_id',
      ignoreDuplicates: false, // Update existing records
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to save field response: ${error.message}`);
  }

  return savedData;
}

/**
 * Save field response with retry logic (auto-save)
 *
 * Implements FR-003: Auto-save with 3 retry attempts and exponential backoff
 *
 * @param response - Field response data to save
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @returns Saved ClientFieldResponse or throws after all retries exhausted
 */
export async function saveFieldResponseWithRetry(
  response: Omit<ClientFieldResponseInsert, 'tenant_id'>,
  maxRetries: number = 3
): Promise<ClientFieldResponse> {
  const delays = [1000, 2000, 4000]; // Exponential backoff: 1s, 2s, 4s

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await saveFieldResponse(response);
    } catch (error) {
      const isLastAttempt = attempt === maxRetries;

      if (isLastAttempt) {
        throw new Error(`Failed to save field response after ${maxRetries + 1} attempts: ${error}`);
      }

      // Wait before retry (exponential backoff)
      const delay = delays[attempt] || 4000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // This should never be reached due to throw in last attempt
  throw new Error('Unexpected error in saveFieldResponseWithRetry');
}

/**
 * Get a single field response
 *
 * @param userId - User identifier
 * @param fieldId - Field identifier
 * @returns ClientFieldResponse or null if not found
 */
export async function getFieldResponse(
  userId: string,
  fieldId: string
): Promise<ClientFieldResponse | null> {
  const supabase = getSupabase();
  const tenantId = getTenantId();

  const { data, error } = await supabase
    .from('client_field_responses')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .eq('field_id', fieldId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw new Error(`Failed to get field response: ${error.message}`);
  }

  return data;
}

/**
 * Get all field responses for a user
 *
 * Implements FR-021: Query responses by user_id with optional filters
 *
 * @param userId - User identifier
 * @param filters - Optional filters (tool_slug, status, field_id)
 * @returns Array of ClientFieldResponse objects
 */
export async function getFieldResponsesByUser(
  userId: string,
  filters?: {
    tool_slug?: string;
    status?: FieldStatus;
    field_id?: string;
  }
): Promise<ClientFieldResponse[]> {
  const supabase = getSupabase();
  const tenantId = getTenantId();

  let query = supabase
    .from('client_field_responses')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId);

  // Apply optional filters
  if (filters?.tool_slug) {
    query = query.eq('tool_slug', filters.tool_slug);
  }
  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  if (filters?.field_id) {
    query = query.eq('field_id', filters.field_id);
  }

  query = query.order('created_at', { ascending: false });

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to get field responses for user: ${error.message}`);
  }

  return data || [];
}

/**
 * Get field responses by multiple field_ids (batch fetch)
 *
 * Used for dependency fetching - retrieve multiple fields at once
 *
 * @param userId - User identifier
 * @param fieldIds - Array of field identifiers
 * @param statusFilter - Optional status filter (defaults to 'submitted')
 * @returns Array of ClientFieldResponse objects
 */
export async function getFieldResponsesByIds(
  userId: string,
  fieldIds: string[],
  statusFilter?: FieldStatus
): Promise<ClientFieldResponse[]> {
  if (fieldIds.length === 0) return [];

  const supabase = getSupabase();
  const tenantId = getTenantId();

  let query = supabase
    .from('client_field_responses')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .in('field_id', fieldIds);

  if (statusFilter) {
    query = query.eq('status', statusFilter);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to get field responses by IDs: ${error.message}`);
  }

  return data || [];
}

/**
 * Change status of all draft responses for a user/tool to 'submitted'
 *
 * Implements FR-004: Convert all draft responses to submitted when sprint submitted
 * Implements FR-018: Submit endpoint converts drafts
 *
 * @param userId - User identifier
 * @param toolSlug - Tool identifier
 * @returns Array of updated ClientFieldResponse objects
 */
export async function changeStatusToSubmitted(
  userId: string,
  toolSlug: string
): Promise<ClientFieldResponse[]> {
  const supabase = getSupabase();
  const tenantId = getTenantId();

  const { data, error } = await supabase
    .from('client_field_responses')
    .update({ status: 'submitted' })
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .eq('tool_slug', toolSlug)
    .eq('status', 'draft')
    .select();

  if (error) {
    throw new Error(`Failed to change status to submitted: ${error.message}`);
  }

  return data || [];
}

/**
 * Get count of responses for a user/tool
 *
 * @param userId - User identifier
 * @param toolSlug - Tool identifier
 * @param status - Optional status filter
 * @returns Count of responses
 */
export async function getResponseCount(
  userId: string,
  toolSlug: string,
  status?: FieldStatus
): Promise<number> {
  const supabase = getSupabase();
  const tenantId = getTenantId();

  let query = supabase
    .from('client_field_responses')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .eq('tool_slug', toolSlug);

  if (status) {
    query = query.eq('status', status);
  }

  const { count, error } = await query;

  if (error) {
    throw new Error(`Failed to get response count: ${error.message}`);
  }

  return count || 0;
}

/**
 * Delete a field response (admin/debug only)
 *
 * @param userId - User identifier
 * @param fieldId - Field identifier
 * @returns true if deleted, false if not found
 */
export async function deleteFieldResponse(
  userId: string,
  fieldId: string
): Promise<boolean> {
  const supabase = getSupabase();
  const tenantId = getTenantId();

  const { error } = await supabase
    .from('client_field_responses')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .eq('field_id', fieldId);

  if (error) {
    if (error.code === 'PGRST116') return false; // Not found
    throw new Error(`Failed to delete field response: ${error.message}`);
  }

  return true;
}
