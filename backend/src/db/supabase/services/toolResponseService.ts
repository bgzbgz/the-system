/**
 * Tool Response Service (Supabase)
 *
 * Handles tool response storage (user submissions from deployed tools).
 * Tracks visitor interactions, inputs, and results.
 */

import { getSupabase, getTenantId } from '../client';
import { ToolResponse, Database } from '../types';

type ToolResponseInsert = Database['public']['Tables']['tool_responses']['Insert'];

/**
 * Get response by ID
 */
export async function getResponse(id: string): Promise<ToolResponse | null> {
  const supabase = getSupabase();
  const tenantId = getTenantId();

  const { data, error } = await supabase
    .from('tool_responses')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw new Error(`Failed to get response: ${error.message}`);
  }

  return data;
}

/**
 * Get responses for a tool with pagination
 */
export async function getResponsesByTool(
  toolSlug: string,
  options?: {
    limit?: number;
    offset?: number;
    source?: string;
  }
): Promise<{ responses: ToolResponse[]; total: number }> {
  const supabase = getSupabase();
  const tenantId = getTenantId();
  const { limit = 50, offset = 0, source } = options || {};

  let query = supabase
    .from('tool_responses')
    .select('*', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .eq('tool_slug', toolSlug)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (source) {
    query = query.eq('source', source);
  }

  const { data, error, count } = await query;

  if (error) {
    throw new Error(`Failed to get responses by tool: ${error.message}`);
  }

  return {
    responses: data || [],
    total: count || 0
  };
}

/**
 * Get all responses by visitor
 */
export async function getResponsesByVisitor(visitorId: string): Promise<ToolResponse[]> {
  const supabase = getSupabase();
  const tenantId = getTenantId();

  const { data, error } = await supabase
    .from('tool_responses')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('visitor_id', visitorId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to get responses by visitor: ${error.message}`);
  }

  return data || [];
}

/**
 * Create a new tool response
 */
export async function createResponse(response: ToolResponseInsert): Promise<ToolResponse> {
  const supabase = getSupabase();
  const tenantId = getTenantId();

  const { data, error } = await supabase
    .from('tool_responses')
    .insert({ ...response, tenant_id: tenantId })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create response: ${error.message}`);
  }

  return data;
}

/**
 * Get aggregated stats for a tool
 */
export async function getToolStats(toolSlug: string): Promise<{
  totalResponses: number;
  uniqueVisitors: number;
  responsesBySource: Record<string, number>;
  responsesByCourse: Record<string, number>;
}> {
  const supabase = getSupabase();
  const tenantId = getTenantId();

  // Get total responses
  const { count: totalResponses } = await supabase
    .from('tool_responses')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('tool_slug', toolSlug);

  // Get unique visitors count
  const { data: uniqueData } = await supabase
    .from('tool_responses')
    .select('visitor_id')
    .eq('tenant_id', tenantId)
    .eq('tool_slug', toolSlug);

  const uniqueVisitors = new Set(uniqueData?.map(r => r.visitor_id) || []).size;

  // Get responses by source
  const { data: sourceData } = await supabase
    .from('tool_responses')
    .select('source')
    .eq('tenant_id', tenantId)
    .eq('tool_slug', toolSlug);

  const responsesBySource: Record<string, number> = {};
  sourceData?.forEach(r => {
    responsesBySource[r.source] = (responsesBySource[r.source] || 0) + 1;
  });

  // Get responses by course
  const { data: courseData } = await supabase
    .from('tool_responses')
    .select('course_id')
    .eq('tenant_id', tenantId)
    .eq('tool_slug', toolSlug)
    .not('course_id', 'is', null);

  const responsesByCourse: Record<string, number> = {};
  courseData?.forEach(r => {
    if (r.course_id) {
      responsesByCourse[r.course_id] = (responsesByCourse[r.course_id] || 0) + 1;
    }
  });

  return {
    totalResponses: totalResponses || 0,
    uniqueVisitors,
    responsesBySource,
    responsesByCourse
  };
}
