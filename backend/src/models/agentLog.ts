/**
 * Agent Log Model
 * Spec: 024-agent-reasoning-logs
 *
 * Types for AI agent reasoning logs stored in MongoDB.
 * Enables Boss to review the thinking behind generated tools.
 */

import { ObjectId } from 'mongodb';

// ========== TYPE DEFINITIONS ==========

/**
 * AI provider identifier
 */
export type AIProvider = 'claude' | 'gemini';

/**
 * Pipeline stage names for logging
 */
export type AgentStage =
  | 'secretary'
  | 'tool-build'
  | 'template-select'
  | 'qa-eval'
  | 'feedback-apply'
  | 'revision'
  | 'unknown';

// ========== MAIN INTERFACE ==========

/**
 * Agent log entry stored in MongoDB
 * Per spec FR-001: Log Entry Model
 */
export interface AgentLogEntry {
  /** MongoDB document ID (auto-generated) */
  _id?: ObjectId;
  /** Job ID this log belongs to (indexed) */
  job_id: string;
  /** Pipeline stage name */
  stage: AgentStage;
  /** AI provider used */
  provider: AIProvider;
  /** Model identifier (e.g., 'claude-sonnet-4-20250514') */
  model: string;
  /** Full prompt sent to AI (truncated at 50KB) */
  prompt: string;
  /** Full response from AI (truncated at 50KB) */
  response: string;
  /** True if prompt was truncated */
  prompt_truncated: boolean;
  /** True if response was truncated */
  response_truncated: boolean;
  /** Tokens in prompt */
  input_tokens: number;
  /** Tokens in response */
  output_tokens: number;
  /** Time taken for AI call in milliseconds */
  duration_ms: number;
  /** Human-readable summary (max 200 chars) */
  summary: string;
  /** Timestamp (TTL index) */
  createdAt: Date;
  /** Optional additional data */
  metadata?: Record<string, unknown>;
}

// ========== INPUT TYPE ==========

/**
 * Input type for createLog (excludes auto-generated fields)
 * Per spec FR-002: createLog function signature
 */
export type CreateLogInput = Omit<
  AgentLogEntry,
  '_id' | 'createdAt' | 'prompt_truncated' | 'response_truncated'
>;

// ========== COLLECTION NAME ==========

/**
 * Collection name for agent logs
 * Per Constitution Section VIII: agent_logs collection
 */
export const AGENT_LOGS_COLLECTION = 'agent_logs';
