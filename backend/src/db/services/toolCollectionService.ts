/**
 * Unified Tool Collection Service
 * Feature: 021-unified-tool-collection
 *
 * Primary service for tool data operations.
 * Each tool has ONE collection `tool_{slug}` containing:
 * - One defaults document (type: "defaults") with tool configuration
 * - Multiple response documents (type: "response") with user submissions
 *
 * Replaces: deployedToolService.ts, responseService.ts
 */

import { Collection, Document, IndexDescription } from 'mongodb';
import { getDB, getToolCollectionName } from '../connection';
import { generateUUID } from '../utils/uuid';
import {
  ToolDefaults,
  ToolResponse,
  ToolCollectionDocument,
  TOOL_DOC_TYPES,
  CreateDefaultsInput,
  CreateResponseInput,
  createDefaultsDocument,
  createResponseDocument,
  ToolDefaultsResponse,
  ToolResponseApiResponse,
  defaultsToResponse,
  responseToApiResponse
} from '../models/toolCollection';

// ========== COLLECTION ACCESS ==========

/**
 * Get tool collection by slug
 * Creates collection with indexes if it doesn't exist
 *
 * @param slug - Tool slug
 * @returns MongoDB collection
 */
export async function getCollection(
  slug: string
): Promise<Collection<ToolCollectionDocument & Document>> {
  const db = getDB();
  const collectionName = getToolCollectionName(slug);
  const collection = db.collection<ToolCollectionDocument & Document>(collectionName);

  // Check if indexes already exist
  const indexes = await collection.indexes().catch(() => []);

  // If only _id index exists, create our indexes
  if (indexes.length <= 1) {
    await createIndexes(collection);
    console.log(`[ToolCollectionService] Created collection and indexes for ${collectionName}`);
  }

  return collection;
}

/**
 * Create indexes for a tool collection
 * Per research.md RT-002: Optimized index strategy
 *
 * @param collection - MongoDB collection
 */
export async function createIndexes(
  collection: Collection<ToolCollectionDocument & Document>
): Promise<void> {
  const indexes: IndexDescription[] = [
    // For filtering document types
    { key: { type: 1 }, name: 'idx_type' },

    // For response queries by user
    { key: { type: 1, user_id: 1, completed_at: -1 }, name: 'idx_type_user_date' },

    // For unique response_id (responses only)
    { key: { response_id: 1 }, name: 'idx_response_id', unique: true, sparse: true },

    // For Tool Intelligence analysis lookups
    { key: { type: 1, completed_at: -1 }, name: 'idx_type_date' }
  ];

  await collection.createIndexes(indexes);
}

// ========== DEFAULTS OPERATIONS ==========

/**
 * Save defaults document for a tool
 * Creates or updates the single defaults document
 *
 * @param slug - Tool slug
 * @param input - Defaults input
 * @returns Created/updated defaults document
 */
export async function saveDefaults(
  slug: string,
  input: CreateDefaultsInput
): Promise<ToolDefaults> {
  const collection = await getCollection(slug);
  const defaults = createDefaultsDocument(input);

  // Upsert: create if not exists, update if exists
  const result = await collection.findOneAndUpdate(
    { type: TOOL_DOC_TYPES.DEFAULTS },
    { $set: defaults },
    { upsert: true, returnDocument: 'after' }
  );

  return result as unknown as ToolDefaults;
}

/**
 * Get defaults document for a tool
 *
 * @param slug - Tool slug
 * @returns Defaults document or null
 */
export async function getDefaults(slug: string): Promise<ToolDefaults | null> {
  const collection = await getCollection(slug);
  const defaults = await collection.findOne({ type: TOOL_DOC_TYPES.DEFAULTS });
  return defaults as ToolDefaults | null;
}

/**
 * Update defaults document fields
 *
 * @param slug - Tool slug
 * @param updates - Partial updates to apply
 * @returns Updated defaults or null if not found
 */
export async function updateDefaults(
  slug: string,
  updates: Partial<Omit<ToolDefaults, '_id' | 'type' | 'tool_id' | 'tool_slug' | 'created_at'>>
): Promise<ToolDefaults | null> {
  const collection = await getCollection(slug);

  const result = await collection.findOneAndUpdate(
    { type: TOOL_DOC_TYPES.DEFAULTS },
    {
      $set: {
        ...updates,
        updated_at: new Date()
      }
    },
    { returnDocument: 'after' }
  );

  return result as unknown as ToolDefaults | null;
}

// ========== RESPONSE OPERATIONS ==========

/**
 * Save response document for a tool
 *
 * @param slug - Tool slug
 * @param input - Response input
 * @returns Created response document
 */
export async function saveResponse(
  slug: string,
  input: CreateResponseInput
): Promise<ToolResponse> {
  const collection = await getCollection(slug);
  const responseId = generateUUID();
  const response = createResponseDocument(responseId, input);

  await collection.insertOne(response as ToolResponse & Document);

  return { ...response, response_id: responseId } as ToolResponse;
}

/**
 * Get paginated responses for a tool
 *
 * @param slug - Tool slug
 * @param options - Pagination options
 * @returns Paginated response list
 */
export interface GetResponsesOptions {
  page?: number;
  limit?: number;
}

export interface GetResponsesResult {
  responses: ToolResponseApiResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export async function getResponses(
  slug: string,
  options: GetResponsesOptions = {}
): Promise<GetResponsesResult> {
  const collection = await getCollection(slug);

  const page = Math.max(1, options.page || 1);
  const limit = Math.min(Math.max(1, options.limit || 50), 100);
  const skip = (page - 1) * limit;

  const [responses, total] = await Promise.all([
    collection
      .find({ type: TOOL_DOC_TYPES.RESPONSE })
      .sort({ completed_at: -1 })
      .skip(skip)
      .limit(limit)
      .toArray(),
    collection.countDocuments({ type: TOOL_DOC_TYPES.RESPONSE })
  ]);

  return {
    responses: (responses as ToolResponse[]).map(responseToApiResponse),
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
}

/**
 * Get responses by user ID
 *
 * @param slug - Tool slug
 * @param userId - User ID
 * @returns User's responses for this tool
 */
export async function getResponsesByUser(
  slug: string,
  userId: string
): Promise<ToolResponse[]> {
  const collection = await getCollection(slug);

  const responses = await collection
    .find({ type: TOOL_DOC_TYPES.RESPONSE, user_id: userId })
    .sort({ completed_at: -1 })
    .toArray();

  return responses as ToolResponse[];
}

/**
 * Get response count for a tool
 *
 * @param slug - Tool slug
 * @returns Response count
 */
export async function getResponseCount(slug: string): Promise<number> {
  const collection = await getCollection(slug);
  return collection.countDocuments({ type: TOOL_DOC_TYPES.RESPONSE });
}

/**
 * Get a single response by ID
 *
 * @param slug - Tool slug
 * @param responseId - Response UUID
 * @returns Response or null
 */
export async function getResponseById(
  slug: string,
  responseId: string
): Promise<ToolResponse | null> {
  const collection = await getCollection(slug);
  const response = await collection.findOne({
    type: TOOL_DOC_TYPES.RESPONSE,
    response_id: responseId
  });
  return response as ToolResponse | null;
}

// ========== STATISTICS ==========

/**
 * Tool statistics
 */
export interface ToolStats {
  totalResponses: number;
  avgScore: number | null;
  verdictCounts: Record<string, number>;
}

/**
 * Get statistics for a tool
 * Aggregates only response documents
 *
 * @param slug - Tool slug
 * @returns Tool statistics
 */
export async function getStats(slug: string): Promise<ToolStats> {
  const collection = await getCollection(slug);

  const [countResult, scoreResult, verdictResult] = await Promise.all([
    // Total responses
    collection.countDocuments({ type: TOOL_DOC_TYPES.RESPONSE }),

    // Average score
    collection.aggregate([
      { $match: { type: TOOL_DOC_TYPES.RESPONSE } },
      { $group: { _id: null, avg: { $avg: '$score' } } }
    ]).toArray(),

    // Verdict distribution
    collection.aggregate([
      { $match: { type: TOOL_DOC_TYPES.RESPONSE } },
      { $group: { _id: '$verdict', count: { $sum: 1 } } }
    ]).toArray()
  ]);

  const verdictCounts: Record<string, number> = {};
  for (const item of verdictResult) {
    verdictCounts[item._id as string] = item.count as number;
  }

  return {
    totalResponses: countResult,
    avgScore: scoreResult[0]?.avg || null,
    verdictCounts
  };
}

/**
 * Get tool with combined stats
 * Returns defaults document plus response statistics
 *
 * @param slug - Tool slug
 * @returns Defaults with stats or null
 */
export interface ToolWithStats {
  defaults: ToolDefaultsResponse;
  stats: ToolStats;
}

export async function getToolWithStats(slug: string): Promise<ToolWithStats | null> {
  const [defaults, stats] = await Promise.all([
    getDefaults(slug),
    getStats(slug)
  ]);

  if (!defaults) {
    return null;
  }

  return {
    defaults: defaultsToResponse(defaults),
    stats
  };
}

// ========== EXISTENCE CHECK ==========

/**
 * Check if a tool collection has a defaults document
 *
 * @param slug - Tool slug
 * @returns true if defaults exist
 */
export async function toolExists(slug: string): Promise<boolean> {
  const defaults = await getDefaults(slug);
  return defaults !== null;
}
