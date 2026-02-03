/**
 * Supabase Client
 *
 * Provides typed access to Supabase database.
 * Uses service_role key for backend (bypasses RLS).
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Note: For full type safety, generate types with: npx supabase gen types typescript
// For now, we use basic typing with explicit casts in services

// ========== SINGLETON ==========

let supabaseClient: SupabaseClient | null = null;

// ========== CONFIGURATION ==========

function getConfig() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!url) {
    throw new Error('SUPABASE_URL environment variable is not set');
  }

  if (!serviceKey) {
    throw new Error('SUPABASE_SERVICE_KEY environment variable is not set');
  }

  return { url, serviceKey };
}

// ========== CLIENT ACCESS ==========

/**
 * Get Supabase client (singleton)
 * Uses service_role key - bypasses RLS for backend operations
 */
export function getSupabase(): SupabaseClient {
  if (!supabaseClient) {
    const { url, serviceKey } = getConfig();

    supabaseClient = createClient(url, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    console.log('[Supabase] Client initialized');
  }

  return supabaseClient;
}

/**
 * Check if Supabase is configured
 */
export function isSupabaseConfigured(): boolean {
  return !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY);
}

/**
 * Test connection to Supabase
 */
export async function testConnection(): Promise<{
  connected: boolean;
  latency_ms?: number;
  error?: string;
}> {
  try {
    const start = Date.now();
    const { data, error } = await getSupabase()
      .from('tenants')
      .select('id')
      .limit(1);

    if (error) {
      return { connected: false, error: error.message };
    }

    return {
      connected: true,
      latency_ms: Date.now() - start
    };
  } catch (error) {
    return {
      connected: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// ========== TENANT CONTEXT ==========

/**
 * Default tenant ID for single-tenant mode
 * In production, this would come from the authenticated user
 */
export const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';

/**
 * Get tenant ID from context (placeholder for auth integration)
 */
export function getTenantId(): string {
  // TODO: Extract from JWT when auth is implemented
  return DEFAULT_TENANT_ID;
}
