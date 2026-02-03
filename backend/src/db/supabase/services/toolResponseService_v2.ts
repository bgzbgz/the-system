/**
 * Tool Response Service V2 (Supabase)
 *
 * Manages client submissions for Feature 021 unified collections.
 * Each tool collects responses in tool_responses table with:
 * - User identity (user_id, email, visitor_id)
 * - Response data (answers, result, score, verdict)
 * - Context tracking (source, course_id, lesson_id)
 * - Status tracking (completed, abandoned)
 */

import { getSupabase, getTenantId } from '../client';
import { ToolResponseRow, ToolResponseInsert } from '../types';

/**
 * Get response by ID
 */
export async function getResponse(id: string): Promise<ToolResponseRow | null> {
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
 * Get response by response_id
 */
export async function getResponseByResponseId(
  toolSlug: string,
  responseId: string
): Promise<ToolResponseRow | null> {
  const supabase = getSupabase();
  const tenantId = getTenantId();

  const { data, error } = await supabase
    .from('tool_responses')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('tool_slug', toolSlug)
    .eq('response_id', responseId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw new Error(`Failed to get response by response_id: ${error.message}`);
  }

  return data;
}

/**
 * Get all responses for a tool with pagination
 */
export async function getResponsesByTool(
  toolSlug: string,
  options?: {
    limit?: number;
    offset?: number;
    status?: string;
    source?: string;
  }
): Promise<{ responses: ToolResponseRow[]; total: number }> {
  const supabase = getSupabase();
  const tenantId = getTenantId();
  const { limit = 50, offset = 0, status, source } = options || {};

  let query = supabase
    .from('tool_responses')
    .select('*', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .eq('tool_slug', toolSlug)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) {
    query = query.eq('status', status);
  }

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
 * Get all responses by user
 */
export async function getResponsesByUser(userId: string): Promise<ToolResponseRow[]> {
  const supabase = getSupabase();
  const tenantId = getTenantId();

  const { data, error } = await supabase
    .from('tool_responses')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to get responses by user: ${error.message}`);
  }

  return data || [];
}

/**
 * Get all responses by visitor (anonymous tracking)
 */
export async function getResponsesByVisitor(visitorId: string): Promise<ToolResponseRow[]> {
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
export async function createResponse(response: ToolResponseInsert): Promise<ToolResponseRow> {
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
  completedResponses: number;
  abandonedResponses: number;
  uniqueUsers: number;
  uniqueVisitors: number;
  averageScore: number | null;
  responsesBySource: Record<string, number>;
  responsesByCourse: Record<string, number>;
}> {
  const supabase = getSupabase();
  const tenantId = getTenantId();

  // Get all responses for the tool
  const { data: responses } = await supabase
    .from('tool_responses')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('tool_slug', toolSlug);

  if (!responses || responses.length === 0) {
    return {
      totalResponses: 0,
      completedResponses: 0,
      abandonedResponses: 0,
      uniqueUsers: 0,
      uniqueVisitors: 0,
      averageScore: null,
      responsesBySource: {},
      responsesByCourse: {}
    };
  }

  // Calculate stats
  const totalResponses = responses.length;
  const completedResponses = responses.filter(r => r.status === 'completed').length;
  const abandonedResponses = responses.filter(r => r.status === 'abandoned').length;

  const uniqueUsers = new Set(responses.filter(r => r.user_id).map(r => r.user_id)).size;
  const uniqueVisitors = new Set(responses.map(r => r.visitor_id)).size;

  const scoresWithValues = responses.filter(r => r.score !== null).map(r => r.score!);
  const averageScore = scoresWithValues.length > 0
    ? scoresWithValues.reduce((sum, score) => sum + score, 0) / scoresWithValues.length
    : null;

  // Group by source
  const responsesBySource: Record<string, number> = {};
  responses.forEach(r => {
    responsesBySource[r.source] = (responsesBySource[r.source] || 0) + 1;
  });

  // Group by course
  const responsesByCourse: Record<string, number> = {};
  responses.forEach(r => {
    if (r.course_id) {
      responsesByCourse[r.course_id] = (responsesByCourse[r.course_id] || 0) + 1;
    }
  });

  return {
    totalResponses,
    completedResponses,
    abandonedResponses,
    uniqueUsers,
    uniqueVisitors,
    averageScore,
    responsesBySource,
    responsesByCourse
  };
}

/**
 * Get recent responses across all tools
 */
export async function getRecentResponses(limit: number = 10): Promise<ToolResponseRow[]> {
  const supabase = getSupabase();
  const tenantId = getTenantId();

  const { data, error } = await supabase
    .from('tool_responses')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to get recent responses: ${error.message}`);
  }

  return data || [];
}
