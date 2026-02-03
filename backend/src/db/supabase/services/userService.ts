/**
 * User Service (Supabase)
 *
 * Handles user management operations.
 * Users are linked to Supabase Auth and belong to a tenant.
 */

import { getSupabase, getTenantId } from '../client';
import { User, Database } from '../types';

type UserInsert = Database['public']['Tables']['users']['Insert'];
type UserUpdate = Database['public']['Tables']['users']['Update'];

/**
 * Get user by ID
 */
export async function getUser(id: string): Promise<User | null> {
  const supabase = getSupabase();
  const tenantId = getTenantId();

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw new Error(`Failed to get user: ${error.message}`);
  }

  return data;
}

/**
 * Get user by email
 */
export async function getUserByEmail(email: string): Promise<User | null> {
  const supabase = getSupabase();
  const tenantId = getTenantId();

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .eq('tenant_id', tenantId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw new Error(`Failed to get user by email: ${error.message}`);
  }

  return data;
}

/**
 * Get users by tenant
 */
export async function getUsersByTenant(tenantId: string, options?: {
  role?: string;
  limit?: number;
  offset?: number;
}): Promise<{ users: User[]; total: number }> {
  const supabase = getSupabase();
  const { role, limit = 50, offset = 0 } = options || {};

  let query = supabase
    .from('users')
    .select('*', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (role) {
    query = query.eq('role', role);
  }

  const { data, error, count } = await query;

  if (error) {
    throw new Error(`Failed to get users by tenant: ${error.message}`);
  }

  return {
    users: data || [],
    total: count || 0
  };
}

/**
 * Create a new user
 */
export async function createUser(user: UserInsert): Promise<User> {
  const supabase = getSupabase();
  const tenantId = getTenantId();

  const { data, error } = await supabase
    .from('users')
    .insert({ ...user, tenant_id: tenantId })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create user: ${error.message}`);
  }

  return data;
}

/**
 * Update user details
 */
export async function updateUser(id: string, updates: UserUpdate): Promise<User> {
  const supabase = getSupabase();
  const tenantId = getTenantId();

  const { data, error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update user: ${error.message}`);
  }

  return data;
}

/**
 * Delete user (soft delete by setting role to 'deleted')
 */
export async function deleteUser(id: string): Promise<void> {
  await updateUser(id, { role: 'deleted' });
}
