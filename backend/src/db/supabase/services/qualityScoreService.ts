/**
 * Quality Score Service (Supabase)
 *
 * Handles quality score tracking for generated tools.
 * Stores QA results, scoring criteria, and prompt versions used.
 */

import { getSupabase, getTenantId } from '../client';
import { QualityScore, Database } from '../types';

type QualityScoreInsert = Database['public']['Tables']['quality_scores']['Insert'];

/**
 * Get quality score by ID
 */
export async function getScore(id: string): Promise<QualityScore | null> {
  const supabase = getSupabase();
  const tenantId = getTenantId();

  const { data, error } = await supabase
    .from('quality_scores')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw new Error(`Failed to get quality score: ${error.message}`);
  }

  return data;
}

/**
 * Get quality scores for a job
 */
export async function getScoresByJob(jobId: string): Promise<QualityScore[]> {
  const supabase = getSupabase();
  const tenantId = getTenantId();

  const { data, error } = await supabase
    .from('quality_scores')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('job_id', jobId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to get scores by job: ${error.message}`);
  }

  return data || [];
}

/**
 * Get quality scores for a tool
 */
export async function getScoresByTool(
  toolSlug: string,
  options?: {
    limit?: number;
    offset?: number;
    passedOnly?: boolean;
  }
): Promise<{ scores: QualityScore[]; total: number }> {
  const supabase = getSupabase();
  const tenantId = getTenantId();
  const { limit = 50, offset = 0, passedOnly } = options || {};

  let query = supabase
    .from('quality_scores')
    .select('*', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .eq('tool_slug', toolSlug)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (passedOnly) {
    query = query.eq('passed', true);
  }

  const { data, error, count } = await query;

  if (error) {
    throw new Error(`Failed to get scores by tool: ${error.message}`);
  }

  return {
    scores: data || [],
    total: count || 0
  };
}

/**
 * Create a new quality score
 */
export async function createScore(score: QualityScoreInsert): Promise<QualityScore> {
  const supabase = getSupabase();
  const tenantId = getTenantId();

  const { data, error } = await supabase
    .from('quality_scores')
    .insert({ ...score, tenant_id: tenantId })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create quality score: ${error.message}`);
  }

  return data;
}

/**
 * Get average quality score for a tool
 */
export async function getAverageScore(toolSlug: string): Promise<{
  averageScore: number;
  totalScores: number;
  passRate: number;
}> {
  const supabase = getSupabase();
  const tenantId = getTenantId();

  const { data, error } = await supabase
    .from('quality_scores')
    .select('overall_score, passed')
    .eq('tenant_id', tenantId)
    .eq('tool_slug', toolSlug);

  if (error) {
    throw new Error(`Failed to get average score: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return {
      averageScore: 0,
      totalScores: 0,
      passRate: 0
    };
  }

  const totalScores = data.length;
  const sumScores = data.reduce((sum, score) => sum + score.overall_score, 0);
  const passedCount = data.filter(score => score.passed).length;

  return {
    averageScore: sumScores / totalScores,
    totalScores,
    passRate: passedCount / totalScores
  };
}

/**
 * Get quality score statistics for date range
 */
export async function getScoreStats(options?: {
  startDate?: string;
  endDate?: string;
}): Promise<{
  totalScores: number;
  averageScore: number;
  passRate: number;
  scoresByRange: {
    '0-25': number;
    '26-50': number;
    '51-75': number;
    '76-100': number;
  };
}> {
  const supabase = getSupabase();
  const tenantId = getTenantId();
  const { startDate, endDate } = options || {};

  let query = supabase
    .from('quality_scores')
    .select('overall_score, passed')
    .eq('tenant_id', tenantId);

  if (startDate) {
    query = query.gte('created_at', startDate);
  }

  if (endDate) {
    query = query.lte('created_at', endDate);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to get score stats: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return {
      totalScores: 0,
      averageScore: 0,
      passRate: 0,
      scoresByRange: {
        '0-25': 0,
        '26-50': 0,
        '51-75': 0,
        '76-100': 0
      }
    };
  }

  const totalScores = data.length;
  const sumScores = data.reduce((sum, score) => sum + score.overall_score, 0);
  const passedCount = data.filter(score => score.passed).length;

  const scoresByRange = {
    '0-25': 0,
    '26-50': 0,
    '51-75': 0,
    '76-100': 0
  };

  data.forEach(score => {
    const s = score.overall_score;
    if (s <= 25) scoresByRange['0-25']++;
    else if (s <= 50) scoresByRange['26-50']++;
    else if (s <= 75) scoresByRange['51-75']++;
    else scoresByRange['76-100']++;
  });

  return {
    totalScores,
    averageScore: sumScores / totalScores,
    passRate: passedCount / totalScores,
    scoresByRange
  };
}
