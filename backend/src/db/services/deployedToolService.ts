/**
 * Deployed Tool Service
 * Spec: 017-mongodb-schema
 *
 * Per contracts/database.yaml operations.deployed_tools
 * Registry operations for deployed tools
 */

import { Collection, Document, MongoError } from 'mongodb';
import { getDB, COLLECTIONS } from '../connection';
import { generateUUID } from '../utils/uuid';
import {
  DeployedTool,
  RegisterToolInput,
  createDeployedToolDocument,
  deployedToolToResponse,
  DeployedToolResponse,
  DeployedToolListResponse
} from '../models/deployedTool';
import { DUPLICATE_KEY_ERROR_CODE } from './jobStore';

// ========== COLLECTION ACCESS ==========

/**
 * Get deployed_tools collection
 */
function getDeployedToolsCollection(): Collection<DeployedTool & Document> {
  return getDB().collection<DeployedTool & Document>(COLLECTIONS.DEPLOYED_TOOLS);
}

// ========== CREATE ==========

/**
 * Register result
 */
export interface RegisterResult {
  success: boolean;
  tool?: DeployedTool;
  error?: string;
}

/**
 * Register a newly deployed tool
 * Per contracts/database.yaml operations.deployed_tools.create
 *
 * @param input - Tool registration input
 * @returns Register result
 */
export async function registerTool(input: RegisterToolInput): Promise<RegisterResult> {
  const collection = getDeployedToolsCollection();
  const toolId = generateUUID();
  const toolDoc = createDeployedToolDocument(toolId, input);

  try {
    await collection.insertOne(toolDoc as DeployedTool & Document);
    return { success: true, tool: { ...toolDoc, tool_id: toolId } as DeployedTool };
  } catch (error) {
    if ((error as MongoError).code === DUPLICATE_KEY_ERROR_CODE) {
      return {
        success: false,
        error: `Tool slug already exists: ${input.tool_slug}`
      };
    }
    throw error;
  }
}

// ========== READ ==========

/**
 * Find a tool by tool_id
 *
 * @param toolId - Tool UUID
 * @returns Tool or null
 */
export async function findByToolId(toolId: string): Promise<DeployedTool | null> {
  const collection = getDeployedToolsCollection();
  const tool = await collection.findOne({ tool_id: toolId });
  return tool as DeployedTool | null;
}

/**
 * Find a tool by slug
 *
 * @param slug - Tool slug
 * @returns Tool or null
 */
export async function findBySlug(slug: string): Promise<DeployedTool | null> {
  const collection = getDeployedToolsCollection();
  const tool = await collection.findOne({ tool_slug: slug });
  return tool as DeployedTool | null;
}

/**
 * Find a tool by job_id
 *
 * @param jobId - Job UUID
 * @returns Tool or null
 */
export async function findByJobId(jobId: string): Promise<DeployedTool | null> {
  const collection = getDeployedToolsCollection();
  const tool = await collection.findOne({ job_id: jobId });
  return tool as DeployedTool | null;
}

/**
 * Get all deployed tools with pagination
 *
 * @param page - Page number (1-indexed)
 * @param limit - Items per page (max 100)
 * @returns Paginated tool list
 */
export async function getAllTools(
  page: number = 1,
  limit: number = 50
): Promise<DeployedToolListResponse> {
  const collection = getDeployedToolsCollection();

  const safePage = Math.max(1, page);
  const safeLimit = Math.min(Math.max(1, limit), 100);
  const skip = (safePage - 1) * safeLimit;

  const [tools, total] = await Promise.all([
    collection
      .find({})
      .sort({ deployed_at: -1 })
      .skip(skip)
      .limit(safeLimit)
      .toArray(),
    collection.countDocuments({})
  ]);

  return {
    tools: (tools as DeployedTool[]).map(deployedToolToResponse),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      pages: Math.ceil(total / safeLimit)
    }
  };
}

// ========== UPDATE ==========

/**
 * Update result
 */
export interface UpdateResult {
  success: boolean;
  tool?: DeployedTool;
  error?: string;
}

/**
 * Increment response count for a tool
 * Per contracts/database.yaml operations.deployed_tools.increment_response_count
 *
 * @param toolId - Tool UUID
 * @returns Update result
 */
export async function incrementResponseCount(toolId: string): Promise<UpdateResult> {
  const collection = getDeployedToolsCollection();

  const result = await collection.findOneAndUpdate(
    { tool_id: toolId },
    { $inc: { response_count: 1 } },
    { returnDocument: 'after' }
  );

  if (!result) {
    return { success: false, error: `Tool not found: ${toolId}` };
  }

  return { success: true, tool: result as DeployedTool };
}

/**
 * Increment response count by slug
 *
 * @param slug - Tool slug
 * @returns Update result
 */
export async function incrementResponseCountBySlug(slug: string): Promise<UpdateResult> {
  const collection = getDeployedToolsCollection();

  const result = await collection.findOneAndUpdate(
    { tool_slug: slug },
    { $inc: { response_count: 1 } },
    { returnDocument: 'after' }
  );

  if (!result) {
    return { success: false, error: `Tool not found: ${slug}` };
  }

  return { success: true, tool: result as DeployedTool };
}

// ========== STATS ==========

/**
 * Get total deployed tool count
 *
 * @returns Total count
 */
export async function getToolCount(): Promise<number> {
  const collection = getDeployedToolsCollection();
  return collection.countDocuments({});
}

/**
 * Get total response count across all tools
 *
 * @returns Total responses
 */
export async function getTotalResponseCount(): Promise<number> {
  const collection = getDeployedToolsCollection();

  const result = await collection.aggregate([
    { $group: { _id: null, total: { $sum: '$response_count' } } }
  ]).toArray();

  return result[0]?.total || 0;
}
