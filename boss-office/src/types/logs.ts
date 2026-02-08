// Logs Types - Frontend types for AI agent reasoning logs
// Feature: 025-frontend-logs-view

/**
 * AI Provider enum - matches backend
 */
export type AIProvider = 'claude' | 'gemini';

/**
 * Pipeline stage enum - matches backend AgentStage
 */
export type AgentStage =
  | 'secretary'
  | 'content-summarizer'
  | 'course-analyst'
  | 'knowledge-architect'
  | 'tool-build'
  | 'template-select'
  | 'qa-eval'
  | 'feedback-apply'
  | 'revision'
  | 'audience-profile'
  | 'brand-audit'
  | 'copy-write'
  | 'example-gen'
  | 'unknown';

/**
 * Stage display configuration
 */
export interface StageConfig {
  displayName: string;
  icon: string;
  order: number;
}

/**
 * Stage configuration map
 */
export const STAGE_CONFIG: Record<AgentStage, StageConfig> = {
  'secretary':           { displayName: 'SECRETARY',           icon: '01', order: 1 },
  'content-summarizer':  { displayName: 'CONTENT SUMMARIZER',  icon: '02', order: 2 },
  'course-analyst':      { displayName: 'COURSE ANALYST',      icon: '03', order: 3 },
  'knowledge-architect': { displayName: 'KNOWLEDGE ARCHITECT', icon: '04', order: 4 },
  'audience-profile':    { displayName: 'AUDIENCE PROFILER',   icon: '05', order: 5 },
  'example-gen':         { displayName: 'EXAMPLE GENERATOR',   icon: '06', order: 6 },
  'copy-write':          { displayName: 'COPY WRITER',         icon: '07', order: 7 },
  'template-select':     { displayName: 'TEMPLATE DECIDER',    icon: '08', order: 8 },
  'tool-build':          { displayName: 'TOOL BUILDER',        icon: '09', order: 9 },
  'brand-audit':         { displayName: 'BRAND GUARDIAN',      icon: '10', order: 10 },
  'qa-eval':             { displayName: 'QA DEPARTMENT',       icon: '11', order: 11 },
  'feedback-apply':      { displayName: 'FEEDBACK APPLIER',    icon: '12', order: 12 },
  'revision':            { displayName: 'REVISION',            icon: '13', order: 13 },
  'unknown':             { displayName: 'UNKNOWN',             icon: '??', order: 99 }
};

/**
 * Single log entry from API response
 * Maps to backend AgentLogEntry
 */
export interface FactoryLog {
  _id: string;
  job_id: string;
  stage: AgentStage;
  provider: AIProvider;
  model: string;
  prompt: string;
  response: string;
  prompt_truncated: boolean;
  response_truncated: boolean;
  input_tokens: number;
  output_tokens: number;
  duration_ms: number;
  summary: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

/**
 * API response for GET /api/jobs/:jobId/logs
 */
export interface LogsApiResponse {
  success: boolean;
  data?: {
    logs: FactoryLog[];
    count: number;
  };
  error?: string;
}

/**
 * Job summary for header display
 * Calculated from logs array
 */
export interface LogsSummary {
  totalDurationMs: number;
  totalTokens: number;
  stageCount: number;
  hasFailure: boolean;
  durationDisplay: string;
  tokensDisplay: string;
}

/**
 * Frontend state for logs page
 */
export interface LogsState {
  jobId: string | null;
  logs: FactoryLog[];
  summary: LogsSummary | null;
  loading: boolean;
  error: string | null;
  expandedIds: Set<string>;
  showingFullIds: Set<string>;
}

/**
 * Initial state
 */
export const INITIAL_LOGS_STATE: LogsState = {
  jobId: null,
  logs: [],
  summary: null,
  loading: false,
  error: null,
  expandedIds: new Set(),
  showingFullIds: new Set()
};

/**
 * Content truncation threshold (characters)
 */
export const CONTENT_TRUNCATION_LIMIT = 10_000;

/**
 * Format duration for display
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return `${minutes}m ${remainingSeconds}s`;
}

/**
 * Format token count for display
 */
export function formatTokens(count: number): string {
  return count.toLocaleString();
}

/**
 * Calculate summary from logs array
 */
export function calculateSummary(logs: FactoryLog[]): LogsSummary {
  const totalDurationMs = logs.reduce((sum, log) => sum + log.duration_ms, 0);
  const totalTokens = logs.reduce((sum, log) => sum + log.input_tokens + log.output_tokens, 0);

  return {
    totalDurationMs,
    totalTokens,
    stageCount: logs.length,
    hasFailure: false,
    durationDisplay: formatDuration(totalDurationMs),
    tokensDisplay: formatTokens(totalTokens)
  };
}
