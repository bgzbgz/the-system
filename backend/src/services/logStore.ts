/**
 * Log Store Service
 * Spec: 024-agent-reasoning-logs
 *
 * Supabase-based storage for AI agent reasoning logs.
 * Fire-and-forget pattern ensures logging never blocks tool generation.
 *
 * NOTE: Previously used MongoDB but MongoDB is not configured in production.
 * Migrated to Supabase agent_logs table for reliable persistence.
 */

import { getSupabase, isSupabaseConfigured } from '../db/supabase/client';
import {
  AgentLogEntry,
  CreateLogInput,
  AgentStage,
  AIProvider,
} from '../models/agentLog';

// ========== CONSTANTS ==========

/** Maximum field size before truncation (50KB per spec FR-004) */
const MAX_FIELD_SIZE = 50 * 1024;

/** TTL in days (configurable via LOG_TTL_DAYS env var, default 30) */
const TTL_DAYS = parseInt(process.env.LOG_TTL_DAYS || '30', 10);

// ========== HELPER FUNCTIONS ==========

/**
 * Truncate text to max size with marker
 * Per spec FR-004: Log Truncation
 */
function truncateField(text: string): { value: string; truncated: boolean } {
  if (!text || text.length <= MAX_FIELD_SIZE) {
    return { value: text || '', truncated: false };
  }
  return {
    value: text.substring(0, MAX_FIELD_SIZE) + '\n[TRUNCATED]',
    truncated: true
  };
}

// ========== INDEX MANAGEMENT ==========

/**
 * Ensure indexes exist (no-op for Supabase — indexes created via migration)
 */
export async function ensureIndexes(): Promise<void> {
  console.log('[LogStore] Using Supabase agent_logs table (indexes managed by migration)');
}

// ========== SUMMARY GENERATION ==========

/**
 * Generate human-readable summary for log entry
 * Per spec US3: Template-based summaries
 */
export function generateSummary(
  stage: AgentStage,
  provider: AIProvider,
  responseLength: number,
  tokens: { input: number; output: number }
): string {
  const providerName = provider === 'claude' ? 'Claude' : 'Gemini';

  const templates: Record<string, string> = {
    'secretary': `Validated input and created brief using ${providerName}. Used ${tokens.output.toLocaleString()} tokens.`,
    'content-summarizer': `Summarized course content using ${providerName}. Used ${tokens.output.toLocaleString()} tokens.`,
    'course-analyst': `Analyzed course structure using ${providerName}. Used ${tokens.output.toLocaleString()} tokens.`,
    'knowledge-architect': `Designed tool spec using ${providerName}. Used ${tokens.output.toLocaleString()} tokens.`,
    'tool-build': `Built tool HTML using ${providerName}. Generated ${responseLength.toLocaleString()} characters.`,
    'template-select': `Selected HTML template using ${providerName}. Used ${tokens.output.toLocaleString()} tokens.`,
    'qa-eval': `Evaluated tool quality using ${providerName}. Used ${tokens.output.toLocaleString()} tokens.`,
    'feedback-apply': `Applied QA feedback using ${providerName}. Generated ${responseLength.toLocaleString()} characters.`,
    'revision': `Applied Boss revision using ${providerName}. Generated ${responseLength.toLocaleString()} characters.`,
  };

  return templates[stage] || `AI call (${stage}) completed using ${providerName}.`;
}

// ========== CORE OPERATIONS ==========

/**
 * Create a log entry in Supabase agent_logs table
 * Per spec FR-002, FR-003: Fire-and-forget with error handling
 *
 * IMPORTANT: Call without await for fire-and-forget pattern
 * Example: createLog(entry).catch(err => console.error(err));
 */
export async function createLog(entry: CreateLogInput): Promise<void> {
  if (!isSupabaseConfigured()) {
    console.warn('[LogStore] Supabase not configured - log entry skipped');
    return;
  }

  try {
    // Truncate prompt and response (spec FR-004)
    const prompt = truncateField(entry.prompt);
    const response = truncateField(entry.response);

    const row = {
      job_id: entry.job_id,
      stage: entry.stage,
      provider: entry.provider,
      model: entry.model,
      prompt: prompt.value,
      response: response.value,
      prompt_truncated: prompt.truncated,
      response_truncated: response.truncated,
      input_tokens: entry.input_tokens,
      output_tokens: entry.output_tokens,
      duration_ms: entry.duration_ms,
      summary: entry.summary || '',
      metadata: entry.metadata || null,
    };

    const { error } = await getSupabase()
      .from('agent_logs')
      .insert(row);

    if (error) {
      console.error('[LogStore] Failed to create log:', error.message);
    }
  } catch (error) {
    // Per spec NFR-003: Log failures must not break tool generation
    console.error('[LogStore] Failed to create log:', error);
  }
}

/**
 * Get all logs for a job, sorted by timestamp
 * Per spec FR-002, US2: getLogsByJobId sorted by created_at
 */
export async function getLogsByJobId(jobId: string): Promise<AgentLogEntry[]> {
  if (!isSupabaseConfigured()) {
    return [];
  }

  try {
    const { data, error } = await getSupabase()
      .from('agent_logs')
      .select('*')
      .eq('job_id', jobId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[LogStore] Failed to get logs by job ID:', error.message);
      return [];
    }

    return (data || []).map(mapRowToEntry);
  } catch (error) {
    console.error('[LogStore] Failed to get logs by job ID:', error);
    return [];
  }
}

/**
 * Get logs for a specific stage within a job
 * Per spec FR-002: getLogsByStage for optional filtering
 */
export async function getLogsByStage(jobId: string, stage: AgentStage): Promise<AgentLogEntry[]> {
  if (!isSupabaseConfigured()) {
    return [];
  }

  try {
    const { data, error } = await getSupabase()
      .from('agent_logs')
      .select('*')
      .eq('job_id', jobId)
      .eq('stage', stage)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[LogStore] Failed to get logs by stage:', error.message);
      return [];
    }

    return (data || []).map(mapRowToEntry);
  } catch (error) {
    console.error('[LogStore] Failed to get logs by stage:', error);
    return [];
  }
}

/**
 * Map Supabase row to AgentLogEntry format (for API compatibility)
 */
function mapRowToEntry(row: any): AgentLogEntry {
  return {
    _id: row.id,
    job_id: row.job_id,
    stage: row.stage,
    provider: row.provider,
    model: row.model,
    prompt: row.prompt,
    response: row.response,
    prompt_truncated: row.prompt_truncated,
    response_truncated: row.response_truncated,
    input_tokens: row.input_tokens,
    output_tokens: row.output_tokens,
    duration_ms: row.duration_ms,
    summary: row.summary,
    createdAt: new Date(row.created_at),
    metadata: row.metadata,
  };
}

// ========== EXPORTS ==========

export {
  MAX_FIELD_SIZE,
  TTL_DAYS,
  truncateField,
  AgentLogEntry,
  CreateLogInput,
  AgentStage,
  AIProvider
};
