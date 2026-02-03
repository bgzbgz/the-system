/**
 * Tool Response Model
 * Spec: 017-mongodb-schema
 *
 * Per data-model.md Tool Response Collections schema
 * Dynamic per-tool user response collections
 */

import { ObjectId } from 'mongodb';
import { AnalysisStatus } from '../../services/toolIntelligence/types';

/**
 * Tool response document
 * Per data-model.md ToolResponse interface
 */
/**
 * Analysis reference for tool response (018-tool-intelligence)
 */
export interface AnalysisReference {
  _id: ObjectId;
  status: AnalysisStatus;
  generatedAt: Date;
}

export interface ToolResponse {
  _id?: ObjectId;
  response_id: string;                // UUID, unique
  tool_id: string;                    // Reference to deployed tool
  user_id: string;                    // LearnWorlds user ID
  user_email: string;
  responses: Record<string, unknown>; // Form field values
  score: number;
  verdict: string;                    // e.g., 'GO', 'NO-GO'
  commitment?: string;                // User's commitment text
  completed_at: Date;
  session_id: string;
  /** Reference to AI analysis (018-tool-intelligence) */
  analysis?: AnalysisReference | null;
}

/**
 * Input for recording a tool response
 */
export interface RecordResponseInput {
  tool_id: string;
  user_id: string;
  user_email: string;
  responses: Record<string, unknown>;
  score: number;
  verdict: string;
  commitment?: string;
  session_id: string;
}

/**
 * Create a tool response document
 *
 * @param responseId - UUID for the response
 * @param input - Response input
 * @returns Tool response document ready for insertion
 */
export function createToolResponseDocument(
  responseId: string,
  input: RecordResponseInput
): Omit<ToolResponse, '_id'> {
  return {
    response_id: responseId,
    tool_id: input.tool_id,
    user_id: input.user_id,
    user_email: input.user_email,
    responses: input.responses,
    score: input.score,
    verdict: input.verdict,
    commitment: input.commitment,
    completed_at: new Date(),
    session_id: input.session_id
  };
}

/**
 * Tool response API response
 */
export interface ToolResponseResponse {
  response_id: string;
  tool_id: string;
  user_id: string;
  user_email: string;
  responses: Record<string, unknown>;
  score: number;
  verdict: string;
  commitment?: string;
  completed_at: string;
  session_id: string;
}

/**
 * Convert tool response to response format
 */
export function toolResponseToResponse(response: ToolResponse): ToolResponseResponse {
  return {
    response_id: response.response_id,
    tool_id: response.tool_id,
    user_id: response.user_id,
    user_email: response.user_email,
    responses: response.responses,
    score: response.score,
    verdict: response.verdict,
    commitment: response.commitment,
    completed_at: response.completed_at.toISOString(),
    session_id: response.session_id
  };
}

/**
 * Tool response list response
 */
export interface ToolResponseListResponse {
  responses: ToolResponseResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}
