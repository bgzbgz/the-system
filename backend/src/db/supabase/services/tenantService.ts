/**
 * Tenant Service (Supabase)
 *
 * Handles tenant management operations.
 * Tenants represent organizations/companies in the system.
 */

import { getSupabase } from '../client';
import { Tenant, Database } from '../types';

type TenantInsert = Database['public']['Tables']['tenants']['Insert'];
type TenantUpdate = Database['public']['Tables']['tenants']['Update'];

/**
 * Get tenant by ID
 */
export async function getTenant(id: string): Promise<Tenant | null> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('tenants')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw new Error(`Failed to get tenant: ${error.message}`);
  }

  return data;
}

/**
 * Get tenant by slug
 */
export async function getTenantBySlug(slug: string): Promise<Tenant | null> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('tenants')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw new Error(`Failed to get tenant by slug: ${error.message}`);
  }

  return data;
}

/**
 * Create a new tenant
 */
export async function createTenant(tenant: TenantInsert): Promise<Tenant> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('tenants')
    .insert(tenant)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create tenant: ${error.message}`);
  }

  return data;
}

/**
 * Update tenant settings
 */
export async function updateTenant(id: string, updates: TenantUpdate): Promise<Tenant> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('tenants')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update tenant: ${error.message}`);
  }

  return data;
}

/**
 * List all tenants
 */
export async function listTenants(options?: {
  limit?: number;
  offset?: number;
}): Promise<{ tenants: Tenant[]; total: number }> {
  const supabase = getSupabase();
  const { limit = 50, offset = 0 } = options || {};

  const { data, error, count } = await supabase
    .from('tenants')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new Error(`Failed to list tenants: ${error.message}`);
  }

  return {
    tenants: data || [],
    total: count || 0
  };
}
