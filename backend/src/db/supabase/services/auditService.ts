/**
 * Audit Service (Supabase)
 *
 * Handles audit log entries for job state changes.
 */

import { getSupabase, getTenantId } from '../client';
import { AuditLogEntry, AuditAction, JobStatus } from '../types';

/**
 * Create an audit log entry
 */
export async function createAuditEntry(entry: {
  job_id?: string;
  action: AuditAction;
  actor_type: string;
  actor_id?: string;
  from_status?: JobStatus;
  to_status?: JobStatus;
  details?: Record<string, unknown>;
}): Promise<AuditLogEntry> {
  const supabase = getSupabase();
  const tenantId = getTenantId();

  const { data, error } = await supabase
    .from('audit_log')
    .insert({
      tenant_id: tenantId,
      job_id: entry.job_id || null,
      action: entry.action,
      actor_type: entry.actor_type,
      actor_id: entry.actor_id || null,
      from_status: entry.from_status || null,
      to_status: entry.to_status || null,
      details: entry.details || {}
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create audit entry: ${error.message}`);
  }

  return data;
}

/**
 * Get audit entries for a job
 */
export async function getJobAuditLog(jobId: string): Promise<AuditLogEntry[]> {
  const supabase = getSupabase();
  const tenantId = getTenantId();

  const { data, error } = await supabase
    .from('audit_log')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('job_id', jobId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to get audit log: ${error.message}`);
  }

  return data || [];
}

/**
 * Get recent audit entries
 */
export async function getRecentAuditEntries(limit = 100): Promise<AuditLogEntry[]> {
  const supabase = getSupabase();
  const tenantId = getTenantId();

  const { data, error } = await supabase
    .from('audit_log')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to get recent audit entries: ${error.message}`);
  }

  return data || [];
}
