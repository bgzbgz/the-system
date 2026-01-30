/**
 * Log Store Service
 * Spec: 024-agent-reasoning-logs
 *
 * MongoDB-based storage for AI agent reasoning logs.
 * Fire-and-forget pattern ensures logging never blocks tool generation.
 */

import { Collection } from 'mongodb';
import { getDB, isConnected } from '../db/connection';
import {
  AgentLogEntry,
  CreateLogInput,
  AgentStage,
  AIProvider,
  AGENT_LOGS_COLLECTION
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

/**
 * Get the agent_logs collection
 */
function getCollection(): Collection<AgentLogEntry> {
  return getDB().collection<AgentLogEntry>(AGENT_LOGS_COLLECTION);
}

// ========== INDEX MANAGEMENT ==========

/**
 * Create indexes for agent_logs collection
 * Per spec FR-001: job_id index and TTL index on createdAt
 * Per spec US4: TTL configurable via LOG_TTL_DAYS
 */
export async function ensureIndexes(): Promise<void> {
  if (!isConnected()) {
    console.log('[LogStore] MongoDB not connected - skipping index creation');
    return;
  }

  try {
    const collection = getCollection();

    // Job ID index for queries (spec FR-001)
    await collection.createIndex({ job_id: 1 });

    // TTL index for automatic cleanup (spec US4)
    const ttlSeconds = TTL_DAYS * 24 * 60 * 60;
    await collection.createIndex(
      { createdAt: 1 },
      { expireAfterSeconds: ttlSeconds }
    );

    console.log(`[LogStore] Indexes ensured (TTL: ${TTL_DAYS} days)`);
  } catch (error) {
    // Don't throw - log store should not break server startup
    console.error('[LogStore] Failed to create indexes:', error);
  }
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
 * Create a log entry in MongoDB
 * Per spec FR-002, FR-003: Fire-and-forget with error handling
 *
 * IMPORTANT: Call without await for fire-and-forget pattern
 * Example: createLog(entry).catch(err => console.error(err));
 */
export async function createLog(entry: CreateLogInput): Promise<void> {
  // Check MongoDB connection first
  if (!isConnected()) {
    console.warn('[LogStore] MongoDB not connected - log entry skipped');
    return;
  }

  try {
    // Truncate prompt and response (spec FR-004)
    const prompt = truncateField(entry.prompt);
    const response = truncateField(entry.response);

    const doc: AgentLogEntry = {
      ...entry,
      prompt: prompt.value,
      response: response.value,
      prompt_truncated: prompt.truncated,
      response_truncated: response.truncated,
      createdAt: new Date()
    };

    await getCollection().insertOne(doc);
  } catch (error) {
    // Per spec NFR-003: Log failures must not break tool generation
    // All errors caught and logged to console
    console.error('[LogStore] Failed to create log:', error);
    // Don't throw - fire and forget
  }
}

/**
 * Get all logs for a job, sorted by timestamp
 * Per spec FR-002, US2: getLogsByJobId sorted by createdAt
 */
export async function getLogsByJobId(jobId: string): Promise<AgentLogEntry[]> {
  if (!isConnected()) {
    return [];
  }

  try {
    return await getCollection()
      .find({ job_id: jobId })
      .sort({ createdAt: 1 })
      .toArray();
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
  if (!isConnected()) {
    return [];
  }

  try {
    return await getCollection()
      .find({ job_id: jobId, stage })
      .sort({ createdAt: 1 })
      .toArray();
  } catch (error) {
    console.error('[LogStore] Failed to get logs by stage:', error);
    return [];
  }
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
