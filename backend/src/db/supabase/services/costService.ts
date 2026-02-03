/**
 * AI Cost Tracking Service (Supabase)
 *
 * Persists AI API costs to database for billing and monitoring.
 */

import { getSupabase, getTenantId } from '../client';
import { AICost } from '../types';

/**
 * Track an AI cost entry
 */
export async function trackCost(entry: {
  job_id?: string;
  stage: string;
  provider: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  used_fallback?: boolean;
}): Promise<AICost> {
  const supabase = getSupabase();
  const tenantId = getTenantId();

  const { data, error } = await supabase
    .from('ai_costs')
    .insert({
      tenant_id: tenantId,
      job_id: entry.job_id || null,
      stage: entry.stage,
      provider: entry.provider,
      model: entry.model,
      input_tokens: entry.input_tokens,
      output_tokens: entry.output_tokens,
      cost_usd: entry.cost_usd,
      used_fallback: entry.used_fallback || false
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to track cost: ${error.message}`);
  }

  return data;
}

/**
 * Get total costs for a job
 */
export async function getJobCosts(jobId: string): Promise<{
  total_cost_usd: number;
  total_input_tokens: number;
  total_output_tokens: number;
  entries: AICost[];
}> {
  const supabase = getSupabase();
  const tenantId = getTenantId();

  const { data, error } = await supabase
    .from('ai_costs')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('job_id', jobId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to get job costs: ${error.message}`);
  }

  const entries = data || [];
  const total_cost_usd = entries.reduce((sum, e) => sum + e.cost_usd, 0);
  const total_input_tokens = entries.reduce((sum, e) => sum + e.input_tokens, 0);
  const total_output_tokens = entries.reduce((sum, e) => sum + e.output_tokens, 0);

  return {
    total_cost_usd,
    total_input_tokens,
    total_output_tokens,
    entries
  };
}

/**
 * Get cost summary for a time period
 */
export async function getCostSummary(
  startDate: Date,
  endDate: Date
): Promise<{
  total_cost_usd: number;
  total_input_tokens: number;
  total_output_tokens: number;
  by_provider: Record<string, number>;
  by_stage: Record<string, number>;
  job_count: number;
}> {
  const supabase = getSupabase();
  const tenantId = getTenantId();

  const { data, error } = await supabase
    .from('ai_costs')
    .select('*')
    .eq('tenant_id', tenantId)
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString());

  if (error) {
    throw new Error(`Failed to get cost summary: ${error.message}`);
  }

  const entries = data || [];
  const jobIds = new Set(entries.map(e => e.job_id).filter(Boolean));

  const by_provider: Record<string, number> = {};
  const by_stage: Record<string, number> = {};

  for (const entry of entries) {
    by_provider[entry.provider] = (by_provider[entry.provider] || 0) + entry.cost_usd;
    by_stage[entry.stage] = (by_stage[entry.stage] || 0) + entry.cost_usd;
  }

  return {
    total_cost_usd: entries.reduce((sum, e) => sum + e.cost_usd, 0),
    total_input_tokens: entries.reduce((sum, e) => sum + e.input_tokens, 0),
    total_output_tokens: entries.reduce((sum, e) => sum + e.output_tokens, 0),
    by_provider,
    by_stage,
    job_count: jobIds.size
  };
}
