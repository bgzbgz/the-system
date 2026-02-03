/**
 * Deployed Tool Model
 * Spec: 017-mongodb-schema
 *
 * Per data-model.md Deployed Tools Collection schema
 * Registry of all successfully deployed tools
 */

import { ObjectId } from 'mongodb';
import { CategoryType } from './job';
import { InputRange, QualityGate } from '../../services/toolIntelligence/types';

/**
 * Deployed tool document
 * Per data-model.md DeployedTool interface
 */
/**
 * Course context for AI-powered tool intelligence
 * Feature: 018-tool-intelligence
 */
export interface ToolCourseContext {
  /** Course terminology */
  terminology?: Array<{
    term: string;
    definition: string;
  }>;
  /** Course frameworks */
  frameworks?: Array<{
    name: string;
    description: string;
  }>;
  /** Expert quotes from course */
  expertQuotes?: Array<{
    quote: string;
    source: string;
  }>;
  /** Input ranges for contextual feedback (018-tool-intelligence) */
  inputRanges?: InputRange[];
}

export interface DeployedTool {
  _id?: ObjectId;
  tool_id: string;                    // UUID, unique
  tool_slug: string;                  // URL-safe, unique
  tool_name: string;
  category: CategoryType;
  job_id: string;                     // Reference to original job
  deployed_url: string;
  deployed_at: Date;
  response_count: number;             // Default: 0
  version: number;                    // For future versioning
  /** Course context for AI analysis (018-tool-intelligence) */
  courseContext?: ToolCourseContext;
  /** Quality gate configuration (018-tool-intelligence) */
  qualityGate?: QualityGate;
}

/**
 * Input for registering a deployed tool
 */
export interface RegisterToolInput {
  tool_slug: string;
  tool_name: string;
  category: CategoryType;
  job_id: string;
  deployed_url: string;
}

/**
 * Create a deployed tool document
 *
 * @param toolId - UUID for the tool
 * @param input - Tool registration input
 * @returns Deployed tool document ready for insertion
 */
export function createDeployedToolDocument(
  toolId: string,
  input: RegisterToolInput
): Omit<DeployedTool, '_id'> {
  return {
    tool_id: toolId,
    tool_slug: input.tool_slug,
    tool_name: input.tool_name,
    category: input.category,
    job_id: input.job_id,
    deployed_url: input.deployed_url,
    deployed_at: new Date(),
    response_count: 0,
    version: 1
  };
}

/**
 * Deployed tool API response
 */
export interface DeployedToolResponse {
  tool_id: string;
  tool_slug: string;
  tool_name: string;
  category: string;
  job_id: string;
  deployed_url: string;
  deployed_at: string;
  response_count: number;
  version: number;
}

/**
 * Convert deployed tool to response format
 */
export function deployedToolToResponse(tool: DeployedTool): DeployedToolResponse {
  return {
    tool_id: tool.tool_id,
    tool_slug: tool.tool_slug,
    tool_name: tool.tool_name,
    category: tool.category,
    job_id: tool.job_id,
    deployed_url: tool.deployed_url,
    deployed_at: tool.deployed_at.toISOString(),
    response_count: tool.response_count,
    version: tool.version
  };
}

/**
 * Deployed tool list response
 */
export interface DeployedToolListResponse {
  tools: DeployedToolResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}
