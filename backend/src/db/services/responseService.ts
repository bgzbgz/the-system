/**
 * Response Service
 * Spec: 017-mongodb-schema
 *
 * Per contracts/database.yaml operations.tool_responses
 * Operations for dynamic per-tool response collections
 *
 * @deprecated Feature 021: Use toolCollectionService instead.
 * This service used the old `tool_{slug}_responses` collection naming pattern.
 * Each tool now has a unified collection `tool_{slug}` with both defaults and responses.
 * See: backend/src/db/services/toolCollectionService.ts
 */

import { Collection, Document } from 'mongodb';
import { getDB, getToolResponseCollectionName } from '../connection';
import { createToolResponseIndexes } from '../init';
import { generateUUID } from '../utils/uuid';
import {
  ToolResponse,
  RecordResponseInput,
  createToolResponseDocument,
  toolResponseToResponse,
  ToolResponseResponse,
  ToolResponseListResponse
} from '../models/toolResponse';
import * as deployedToolService from './deployedToolService';

// ========== COLLECTION MANAGEMENT ==========

/**
 * Ensure tool response collection exists with indexes
 * Per contracts/database.yaml initialization.on_tool_deploy
 *
 * @param slug - Tool slug
 * @returns Collection
 */
export async function ensureCollection(slug: string): Promise<Collection<ToolResponse & Document>> {
  const db = getDB();
  const collectionName = getToolResponseCollectionName(slug);
  const collection = db.collection<ToolResponse & Document>(collectionName);

  // Check if indexes already exist
  const indexes = await collection.indexes().catch(() => []);

  // If only _id index exists, create our indexes
  if (indexes.length <= 1) {
    await createToolResponseIndexes(db, slug);
    console.log(`[ResponseService] Created collection and indexes for ${collectionName}`);
  }

  return collection;
}

// ========== CREATE ==========

/**
 * Record result
 */
export interface RecordResult {
  success: boolean;
  response?: ToolResponse;
  error?: string;
}

/**
 * Record a user's tool response
 * Per contracts/database.yaml operations.tool_responses.create
 *
 * @param slug - Tool slug
 * @param input - Response input
 * @returns Record result
 */
export async function recordResponse(
  slug: string,
  input: RecordResponseInput
): Promise<RecordResult> {
  // Ensure collection exists with indexes
  const collection = await ensureCollection(slug);

  const responseId = generateUUID();
  const responseDoc = createToolResponseDocument(responseId, input);

  await collection.insertOne(responseDoc as ToolResponse & Document);

  // Increment response count on deployed tool
  await deployedToolService.incrementResponseCountBySlug(slug);

  return {
    success: true,
    response: { ...responseDoc, response_id: responseId } as ToolResponse
  };
}

// ========== READ ==========

/**
 * Get responses by user ID
 *
 * @param slug - Tool slug
 * @param userId - User ID
 * @returns User's responses for this tool
 */
export async function getByUserId(slug: string, userId: string): Promise<ToolResponse[]> {
  const collection = await ensureCollection(slug);

  const responses = await collection
    .find({ user_id: userId })
    .sort({ completed_at: -1 })
    .toArray();

  return responses as ToolResponse[];
}

/**
 * Get responses by date range
 *
 * @param slug - Tool slug
 * @param start - Start date
 * @param end - End date
 * @returns Responses in date range
 */
export async function getByDateRange(
  slug: string,
  start: Date,
  end: Date
): Promise<ToolResponse[]> {
  const collection = await ensureCollection(slug);

  const responses = await collection
    .find({
      completed_at: {
        $gte: start,
        $lte: end
      }
    })
    .sort({ completed_at: -1 })
    .toArray();

  return responses as ToolResponse[];
}

/**
 * Get paginated responses for a tool
 *
 * @param slug - Tool slug
 * @param page - Page number (1-indexed)
 * @param limit - Items per page (max 100)
 * @returns Paginated response list
 */
export async function getResponses(
  slug: string,
  page: number = 1,
  limit: number = 50
): Promise<ToolResponseListResponse> {
  const collection = await ensureCollection(slug);

  const safePage = Math.max(1, page);
  const safeLimit = Math.min(Math.max(1, limit), 100);
  const skip = (safePage - 1) * safeLimit;

  const [responses, total] = await Promise.all([
    collection
      .find({})
      .sort({ completed_at: -1 })
      .skip(skip)
      .limit(safeLimit)
      .toArray(),
    collection.countDocuments({})
  ]);

  return {
    responses: (responses as ToolResponse[]).map(toolResponseToResponse),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      pages: Math.ceil(total / safeLimit)
    }
  };
}

/**
 * Get response count for a tool
 *
 * @param slug - Tool slug
 * @returns Response count
 */
export async function getResponseCount(slug: string): Promise<number> {
  const collection = await ensureCollection(slug);
  return collection.countDocuments({});
}

// ========== ANALYTICS ==========

/**
 * Get verdict distribution for a tool
 *
 * @param slug - Tool slug
 * @returns Verdict counts
 */
export async function getVerdictDistribution(
  slug: string
): Promise<Record<string, number>> {
  const collection = await ensureCollection(slug);

  const result = await collection.aggregate([
    { $group: { _id: '$verdict', count: { $sum: 1 } } }
  ]).toArray();

  const distribution: Record<string, number> = {};
  for (const item of result) {
    distribution[item._id as string] = item.count as number;
  }

  return distribution;
}

/**
 * Get average score for a tool
 *
 * @param slug - Tool slug
 * @returns Average score or null if no responses
 */
export async function getAverageScore(slug: string): Promise<number | null> {
  const collection = await ensureCollection(slug);

  const result = await collection.aggregate([
    { $group: { _id: null, avg: { $avg: '$score' } } }
  ]).toArray();

  return result[0]?.avg || null;
}
