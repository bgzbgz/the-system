/**
 * Quality Store Service (Supabase)
 * Feature: 020-self-improving-factory
 *
 * Complete quality store implementation using Supabase.
 * Replaces the MongoDB-based qualityStore.
 */

import { getSupabase, getTenantId, isSupabaseConfigured } from '../client';
import {
  QualityScore,
  QualityPattern,
  Suggestion,
  DailyAggregate,
  DashboardSummary,
  CriterionId,
  SuggestionStatus,
  PatternStatus,
} from '../../../services/qualityScoring/types';

// ========== QUALITY SCORES ==========

/**
 * Save a quality score
 */
export async function saveQualityScore(score: Omit<QualityScore, '_id'>): Promise<QualityScore> {
  const supabase = getSupabase();
  const tenantId = getTenantId();

  const { data, error } = await supabase
    .from('quality_scores')
    .insert({
      tenant_id: tenantId,
      job_id: score.job_id,
      tool_slug: score.tool_slug,
      html_hash: score.html_hash,
      overall_score: score.overall_score,
      passed: score.passed,
      criteria: score.criteria,
      prompt_versions: score.prompt_versions,
      scoring_duration_ms: score.scoring_duration_ms,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to save quality score: ${error.message}`);
  }

  return {
    ...score,
    _id: data.id,
    created_at: new Date(data.created_at),
  };
}

/**
 * Get quality score by job ID
 */
export async function getScoreByJobId(jobId: string): Promise<QualityScore | null> {
  const supabase = getSupabase();
  const tenantId = getTenantId();

  const { data, error } = await supabase
    .from('quality_scores')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('job_id', jobId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw new Error(`Failed to get score by job: ${error.message}`);
  }

  return mapToQualityScore(data);
}

/**
 * Get scores within a time window
 */
export async function getScoresInWindow(
  windowStart: Date,
  windowEnd: Date
): Promise<QualityScore[]> {
  const supabase = getSupabase();
  const tenantId = getTenantId();

  const { data, error } = await supabase
    .from('quality_scores')
    .select('*')
    .eq('tenant_id', tenantId)
    .gte('created_at', windowStart.toISOString())
    .lte('created_at', windowEnd.toISOString())
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to get scores in window: ${error.message}`);
  }

  return (data || []).map(mapToQualityScore);
}

/**
 * Get dashboard summary
 */
export async function getDashboardSummary(days: number = 30): Promise<DashboardSummary> {
  const supabase = getSupabase();
  const tenantId = getTenantId();
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

  const { data, error } = await supabase
    .from('quality_scores')
    .select('*')
    .eq('tenant_id', tenantId)
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString());

  if (error) {
    throw new Error(`Failed to get dashboard summary: ${error.message}`);
  }

  const scores = (data || []).map(mapToQualityScore);
  const totalTools = scores.length;
  const passCount = scores.filter(s => s.passed).length;
  const avgScore = totalTools > 0
    ? scores.reduce((sum, s) => sum + s.overall_score, 0) / totalTools
    : 0;

  // Calculate per-criterion pass rates
  const criteriaIds: CriterionId[] = [
    'decision', 'zero_questions', 'easy_steps', 'feedback',
    'gamification', 'results', 'commitment', 'brand'
  ];

  const criterionPassRates = {} as Record<CriterionId, number>;
  for (const criterionId of criteriaIds) {
    const criterionPassCount = scores.filter(s =>
      s.criteria.find(c => c.criterion_id === criterionId)?.passed
    ).length;
    criterionPassRates[criterionId] = totalTools > 0
      ? Math.round((criterionPassCount / totalTools) * 100)
      : 0;
  }

  // Calculate daily scores for trend chart
  const dailyMap = new Map<string, { total: number; sum: number; count: number }>();
  for (const score of scores) {
    const dateKey = score.created_at.toISOString().split('T')[0];
    const existing = dailyMap.get(dateKey) || { total: 0, sum: 0, count: 0 };
    dailyMap.set(dateKey, {
      total: existing.total + 1,
      sum: existing.sum + score.overall_score,
      count: existing.count + 1,
    });
  }

  const dailyScores = Array.from(dailyMap.entries())
    .map(([date, data]) => ({
      date,
      average_score: Math.round((data.sum / data.count) * 10) / 10,
      total_tools: data.total,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Calculate trend (compare last 7 days vs previous 7 days)
  const midpoint = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
  const recentScores = scores.filter(s => s.created_at >= midpoint);
  const olderScores = scores.filter(s => s.created_at < midpoint);

  const recentAvg = recentScores.length > 0
    ? recentScores.reduce((sum, s) => sum + s.overall_score, 0) / recentScores.length
    : 0;
  const olderAvg = olderScores.length > 0
    ? olderScores.reduce((sum, s) => sum + s.overall_score, 0) / olderScores.length
    : 0;

  let scoreTrend: 'up' | 'down' | 'stable' = 'stable';
  if (recentAvg > olderAvg + 5) scoreTrend = 'up';
  else if (recentAvg < olderAvg - 5) scoreTrend = 'down';

  return {
    period: {
      start: startDate,
      end: endDate,
      days,
    },
    total_tools: totalTools,
    average_score: Math.round(avgScore * 10) / 10,
    pass_rate: totalTools > 0 ? Math.round((passCount / totalTools) * 100) : 0,
    score_trend: scoreTrend,
    criterion_pass_rates: criterionPassRates,
    daily_scores: dailyScores,
    prompt_performance: [], // TODO: Implement prompt version tracking
  };
}

/**
 * Get quality trends
 */
export async function getQualityTrends(days: number = 30): Promise<{
  daily: Array<{ date: string; average_score: number; total_tools: number }>;
  criterion_trends: Record<CriterionId, Array<{ date: string; pass_rate: number }>>;
}> {
  const summary = await getDashboardSummary(days);

  return {
    daily: summary.daily_scores,
    criterion_trends: {} as Record<CriterionId, Array<{ date: string; pass_rate: number }>>,
  };
}

/**
 * Get quality scores by prompt version
 */
export async function getQualityByPromptVersion(
  promptName: string,
  version: number
): Promise<{ average_score: number; total_tools: number; pass_rate: number }> {
  const supabase = getSupabase();
  const tenantId = getTenantId();

  // Query scores where prompt_versions contains the specified version
  const { data, error } = await supabase
    .from('quality_scores')
    .select('overall_score, passed, prompt_versions')
    .eq('tenant_id', tenantId);

  if (error) {
    throw new Error(`Failed to get scores by prompt version: ${error.message}`);
  }

  // Filter in memory for JSON field matching
  const scores = (data || []).filter(s => {
    const versions = s.prompt_versions as Record<string, string> || {};
    return versions[promptName] === version.toString();
  });

  const totalTools = scores.length;
  const passCount = scores.filter(s => s.passed).length;
  const avgScore = totalTools > 0
    ? scores.reduce((sum, s) => sum + Number(s.overall_score), 0) / totalTools
    : 0;

  return {
    average_score: Math.round(avgScore * 10) / 10,
    total_tools: totalTools,
    pass_rate: totalTools > 0 ? Math.round((passCount / totalTools) * 100) : 0,
  };
}

// ========== PATTERNS ==========

/**
 * Save a quality pattern
 */
export async function savePattern(pattern: Omit<QualityPattern, '_id'>): Promise<QualityPattern> {
  const supabase = getSupabase();
  const tenantId = getTenantId();

  const { data, error } = await supabase
    .from('quality_patterns')
    .insert({
      tenant_id: tenantId,
      criterion_id: pattern.criterion_id,
      failure_rate: pattern.failure_rate,
      sample_size: pattern.sample_size,
      window_start: pattern.window_start.toISOString(),
      window_end: pattern.window_end.toISOString(),
      trend: pattern.trend,
      correlations: pattern.correlations || [],
      status: pattern.status,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to save pattern: ${error.message}`);
  }

  return {
    ...pattern,
    _id: data.id,
  };
}

/**
 * Get active patterns
 */
export async function getActivePatterns(): Promise<QualityPattern[]> {
  const supabase = getSupabase();
  const tenantId = getTenantId();

  const { data, error } = await supabase
    .from('quality_patterns')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('status', 'active')
    .order('failure_rate', { ascending: false });

  if (error) {
    throw new Error(`Failed to get active patterns: ${error.message}`);
  }

  return (data || []).map(mapToQualityPattern);
}

/**
 * Update pattern status
 */
export async function updatePatternStatus(
  patternId: string,
  status: PatternStatus
): Promise<boolean> {
  const supabase = getSupabase();
  const tenantId = getTenantId();

  const { error, count } = await supabase
    .from('quality_patterns')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', patternId)
    .eq('tenant_id', tenantId);

  if (error) {
    throw new Error(`Failed to update pattern status: ${error.message}`);
  }

  return (count || 0) > 0;
}

// ========== SUGGESTIONS ==========

/**
 * Save a suggestion
 */
export async function saveSuggestion(suggestion: Omit<Suggestion, '_id'>): Promise<Suggestion> {
  const supabase = getSupabase();
  const tenantId = getTenantId();

  const { data, error } = await supabase
    .from('suggestions')
    .insert({
      tenant_id: tenantId,
      pattern_id: suggestion.pattern_id,
      criterion_id: suggestion.criterion_id,
      suggested_change: suggestion.suggested_change,
      prompt_name: suggestion.prompt_name,
      prompt_section: suggestion.prompt_section,
      supporting_data: suggestion.supporting_data,
      status: suggestion.status,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to save suggestion: ${error.message}`);
  }

  return {
    ...suggestion,
    _id: data.id,
  };
}

/**
 * Get suggestions by status
 */
export async function getSuggestionsByStatus(status: SuggestionStatus): Promise<Suggestion[]> {
  const supabase = getSupabase();
  const tenantId = getTenantId();

  const { data, error } = await supabase
    .from('suggestions')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('status', status)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to get suggestions by status: ${error.message}`);
  }

  return (data || []).map(mapToSuggestion);
}

/**
 * Get suggestion by ID
 */
export async function getSuggestionById(suggestionId: string): Promise<Suggestion | null> {
  const supabase = getSupabase();
  const tenantId = getTenantId();

  const { data, error } = await supabase
    .from('suggestions')
    .select('*')
    .eq('id', suggestionId)
    .eq('tenant_id', tenantId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to get suggestion: ${error.message}`);
  }

  return mapToSuggestion(data);
}

/**
 * Update suggestion status
 */
export async function updateSuggestionStatus(
  suggestionId: string,
  status: SuggestionStatus,
  operatorNotes?: string,
  reviewedBy?: string
): Promise<boolean> {
  const supabase = getSupabase();
  const tenantId = getTenantId();

  const update: Record<string, unknown> = {
    status,
    reviewed_at: new Date().toISOString(),
  };
  if (operatorNotes !== undefined) update.operator_notes = operatorNotes;
  if (reviewedBy !== undefined) update.reviewed_by = reviewedBy;

  const { error, count } = await supabase
    .from('suggestions')
    .update(update)
    .eq('id', suggestionId)
    .eq('tenant_id', tenantId);

  if (error) {
    throw new Error(`Failed to update suggestion status: ${error.message}`);
  }

  return (count || 0) > 0;
}

// ========== DAILY AGGREGATES ==========

/**
 * Save daily aggregate
 */
export async function saveDailyAggregate(aggregate: Omit<DailyAggregate, '_id'>): Promise<DailyAggregate> {
  const supabase = getSupabase();
  const tenantId = getTenantId();

  const { data, error } = await supabase
    .from('daily_aggregates')
    .upsert({
      tenant_id: tenantId,
      date: aggregate.date instanceof Date
        ? aggregate.date.toISOString().split('T')[0]
        : aggregate.date,
      total_tools: aggregate.total_tools,
      average_score: aggregate.average_score,
      pass_count: aggregate.pass_count,
      fail_count: aggregate.fail_count,
      criterion_pass_rates: aggregate.criterion_pass_rates,
      prompt_versions_used: aggregate.prompt_versions_used,
      score_distribution: aggregate.score_distribution,
    }, { onConflict: 'tenant_id,date' })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to save daily aggregate: ${error.message}`);
  }

  return {
    ...aggregate,
    _id: data.id,
  };
}

/**
 * Get daily aggregates for a date range
 */
export async function getDailyAggregates(
  startDate: Date,
  endDate: Date
): Promise<DailyAggregate[]> {
  const supabase = getSupabase();
  const tenantId = getTenantId();

  const { data, error } = await supabase
    .from('daily_aggregates')
    .select('*')
    .eq('tenant_id', tenantId)
    .gte('date', startDate.toISOString().split('T')[0])
    .lte('date', endDate.toISOString().split('T')[0])
    .order('date', { ascending: true });

  if (error) {
    throw new Error(`Failed to get daily aggregates: ${error.message}`);
  }

  return (data || []).map(mapToDailyAggregate);
}

// ========== HELPER FUNCTIONS ==========

function mapToQualityScore(data: Record<string, unknown>): QualityScore {
  return {
    _id: data.id as string,
    job_id: data.job_id as string,
    tool_slug: data.tool_slug as string,
    html_hash: data.html_hash as string,
    overall_score: Number(data.overall_score),
    passed: data.passed as boolean,
    criteria: data.criteria as QualityScore['criteria'],
    prompt_versions: (data.prompt_versions as Record<string, string>) || {},
    scoring_duration_ms: data.scoring_duration_ms as number,
    created_at: new Date(data.created_at as string),
  };
}

function mapToQualityPattern(data: Record<string, unknown>): QualityPattern {
  return {
    _id: data.id as string,
    criterion_id: data.criterion_id as CriterionId,
    failure_rate: Number(data.failure_rate),
    sample_size: data.sample_size as number,
    window_start: new Date(data.window_start as string),
    window_end: new Date(data.window_end as string),
    trend: data.trend as QualityPattern['trend'],
    correlations: data.correlations as QualityPattern['correlations'],
    status: data.status as PatternStatus,
    created_at: new Date(data.created_at as string),
    updated_at: new Date(data.updated_at as string),
  };
}

function mapToSuggestion(data: Record<string, unknown>): Suggestion {
  return {
    _id: data.id as string,
    pattern_id: data.pattern_id as string,
    criterion_id: data.criterion_id as CriterionId,
    suggested_change: data.suggested_change as string,
    prompt_name: data.prompt_name as Suggestion['prompt_name'],
    prompt_section: data.prompt_section as string | undefined,
    supporting_data: data.supporting_data as Suggestion['supporting_data'],
    status: data.status as SuggestionStatus,
    operator_notes: data.operator_notes as string | undefined,
    reviewed_by: data.reviewed_by as string | undefined,
    reviewed_at: data.reviewed_at ? new Date(data.reviewed_at as string) : undefined,
    created_at: new Date(data.created_at as string),
  };
}

function mapToDailyAggregate(data: Record<string, unknown>): DailyAggregate {
  return {
    _id: data.id as string,
    date: new Date(data.date as string),
    total_tools: data.total_tools as number,
    average_score: Number(data.average_score),
    pass_count: data.pass_count as number,
    fail_count: data.fail_count as number,
    criterion_pass_rates: data.criterion_pass_rates as DailyAggregate['criterion_pass_rates'],
    prompt_versions_used: data.prompt_versions_used as DailyAggregate['prompt_versions_used'],
    score_distribution: data.score_distribution as DailyAggregate['score_distribution'],
  };
}

// ========== CONFIGURATION CHECK ==========

/**
 * Check if quality store is available (Supabase configured)
 */
export function isAvailable(): boolean {
  return isSupabaseConfigured();
}
