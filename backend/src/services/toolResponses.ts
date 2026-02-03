/**
 * Tool Response API - Tool Responses Service
 * Spec: 026-tool-response-api
 * Per contracts/tools-api.yaml and data-model.md
 *
 * Handles storage and retrieval of user responses from deployed tools
 */

import { Collection, ObjectId, Document } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';
import { getDB, isConnected } from '../db/connection';
import logger from '../utils/logger';

// ========== TYPES ==========

/**
 * Source of tool response
 */
export type ResponseSource = 'learnworlds' | 'direct' | 'embed' | 'share';

/**
 * Tool response document stored in MongoDB
 * Per data-model.md ToolResponse entity
 */
export interface ToolResponse {
  _id?: ObjectId;

  // User Identity
  visitorId: string;
  userName?: string;
  userEmail?: string;
  learnworldsUserId?: string;

  // Tool Data
  inputs: Record<string, unknown>;
  result: {
    score?: number;
    verdict?: string;
    verdictText?: string;
    [key: string]: unknown;
  };

  // Context
  source: ResponseSource;
  courseId?: string;
  lessonId?: string;
  referrer?: string;

  // Timestamps
  createdAt: Date;
  completedAt?: Date;

  // Metadata
  toolVersion?: string;
  userAgent?: string;
  ipHash?: string;
}

/**
 * Input for saving a tool response
 */
export interface SaveResponseInput {
  // User Identity (optional - visitorId generated if not provided)
  visitorId?: string;
  userName?: string;
  userEmail?: string;
  learnworldsUserId?: string;

  // Tool Data (required)
  inputs: Record<string, unknown>;
  result: Record<string, unknown>;

  // Context (optional)
  source?: ResponseSource;
  courseId?: string;
  lessonId?: string;
  referrer?: string;

  // Metadata (optional)
  completedAt?: Date;
  toolVersion?: string;
  userAgent?: string;
  ipAddress?: string;
}

/**
 * Result of saving a response
 */
export interface SaveResponseResult {
  id: string;
  visitorId: string;
}

/**
 * Query options for getResponses
 */
export interface GetResponsesOptions {
  limit?: number;
  skip?: number;
  visitorId?: string;
}

/**
 * Result of getResponses query
 */
export interface GetResponsesResult {
  data: ToolResponse[];
  pagination: {
    total: number;
    limit: number;
    skip: number;
    hasMore: boolean;
  };
}

/**
 * Tool statistics
 */
export interface ToolStats {
  totalResponses: number;
  uniqueVisitors: number;
  avgScore: number | null;
  firstResponse: Date | null;
  lastResponse: Date | null;
}

// ========== COLLECTION NAMING ==========

/**
 * Slug validation regex
 * Per data-model.md: lowercase alphanumeric with hyphens, max 100 chars
 */
const SLUG_REGEX = /^[a-z0-9-]+$/;
const MAX_SLUG_LENGTH = 100;

/**
 * Validate tool slug format
 * Per FR-003: Validate slug format (lowercase alphanumeric with hyphens only)
 *
 * @param slug - Tool slug to validate
 * @returns true if valid, false otherwise
 */
export function validateSlug(slug: string): boolean {
  if (!slug || slug.length > MAX_SLUG_LENGTH) {
    return false;
  }
  return SLUG_REGEX.test(slug);
}

/**
 * Get collection name for a tool slug
 * Per data-model.md: tool_{slug}_responses with hyphens converted to underscores
 *
 * @param slug - Tool slug
 * @returns Collection name
 */
export function getCollectionName(slug: string): string {
  return `tool_${slug.replace(/-/g, '_')}_responses`;
}

// ========== VISITOR ID GENERATION ==========

/**
 * Generate anonymous visitor ID
 * Per data-model.md: Format is anon_{uuid}
 *
 * @returns Generated anonymous visitor ID
 */
export function generateVisitorId(): string {
  return `anon_${uuidv4()}`;
}

// ========== IP HASHING ==========

/**
 * Hash IP address for privacy
 * Per NFR-003: IP addresses MUST be hashed before storage
 *
 * @param ipAddress - Raw IP address
 * @returns First 16 chars of SHA-256 hash
 */
export function hashIpAddress(ipAddress: string): string {
  const salt = process.env.IP_SALT || 'default-salt';
  return createHash('sha256')
    .update(ipAddress + salt)
    .digest('hex')
    .substring(0, 16);
}

// ========== RATE LIMITING ==========

/**
 * Rate limit: max requests per visitor per minute
 */
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute

/**
 * Check if visitor has exceeded rate limit
 * Per FR-010: 10 requests per visitor per tool per minute
 *
 * @param collection - Tool response collection
 * @param visitorId - Visitor ID to check
 * @returns true if rate limited, false otherwise
 */
export async function checkRateLimit(
  collection: Collection<ToolResponse>,
  visitorId: string
): Promise<boolean> {
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);

  const recentCount = await collection.countDocuments({
    visitorId,
    createdAt: { $gte: windowStart }
  });

  return recentCount >= RATE_LIMIT_MAX;
}

// ========== COLLECTION MANAGEMENT ==========

// Track collections that have been initialized (indexes created)
const initializedCollections = new Set<string>();

/**
 * Get or create tool response collection with indexes
 * Per data-model.md: Collections auto-created on first request
 *
 * @param slug - Tool slug
 * @returns MongoDB collection
 */
export async function getToolCollection(slug: string): Promise<Collection<ToolResponse>> {
  const db = getDB();
  const collectionName = getCollectionName(slug);
  const collection = db.collection<ToolResponse>(collectionName);

  // Create indexes if not already done
  if (!initializedCollections.has(collectionName)) {
    try {
      // Per data-model.md indexes
      await collection.createIndex({ visitorId: 1, createdAt: -1 });
      await collection.createIndex({ createdAt: -1 });
      await collection.createIndex({ visitorId: 1 });
      await collection.createIndex({ visitorId: 1, createdAt: 1 });

      initializedCollections.add(collectionName);
      logger.info('Tool collection indexes created', { collection: collectionName });
    } catch (error) {
      // Indexes may already exist - log and continue
      logger.debug('Index creation skipped (may already exist)', {
        collection: collectionName,
        error: (error as Error).message
      });
      initializedCollections.add(collectionName);
    }
  }

  return collection;
}

// ========== CORE OPERATIONS ==========

/**
 * Save a tool response
 * Per FR-001, FR-002, FR-004, FR-005
 *
 * @param slug - Tool slug
 * @param input - Response input data
 * @returns Save result with document ID and visitor ID
 */
export async function saveResponse(
  slug: string,
  input: SaveResponseInput
): Promise<SaveResponseResult> {
  const collection = await getToolCollection(slug);

  // Generate visitor ID if not provided (FR-004)
  const visitorId = input.visitorId || generateVisitorId();

  // Build document
  const doc: ToolResponse = {
    // User Identity
    visitorId,
    userName: input.userName,
    userEmail: input.userEmail,
    learnworldsUserId: input.learnworldsUserId,

    // Tool Data (FR-007: required fields)
    inputs: input.inputs,
    result: input.result,

    // Context with defaults
    source: input.source || 'direct',
    courseId: input.courseId,
    lessonId: input.lessonId,
    referrer: input.referrer,

    // Timestamps
    createdAt: new Date(),
    completedAt: input.completedAt,

    // Metadata
    toolVersion: input.toolVersion,
    userAgent: input.userAgent,
    ipHash: input.ipAddress ? hashIpAddress(input.ipAddress) : undefined
  };

  // Remove undefined fields
  Object.keys(doc).forEach(key => {
    if ((doc as any)[key] === undefined) {
      delete (doc as any)[key];
    }
  });

  const result = await collection.insertOne(doc as any);

  logger.logOperation({
    operation: 'SAVE_TOOL_RESPONSE',
    details: {
      slug,
      visitorId,
      source: doc.source
    }
  });

  return {
    id: result.insertedId.toString(),
    visitorId
  };
}

/**
 * Get tool responses with pagination and filtering
 * Per FR-008
 *
 * @param slug - Tool slug
 * @param options - Query options (limit, skip, visitorId filter)
 * @returns Paginated response list
 */
export async function getResponses(
  slug: string,
  options: GetResponsesOptions = {}
): Promise<GetResponsesResult> {
  const collection = await getToolCollection(slug);

  const limit = Math.min(options.limit || 50, 100);
  const skip = options.skip || 0;

  // Build query filter
  const filter: Document = {};
  if (options.visitorId) {
    filter.visitorId = options.visitorId;
  }

  // Get total count
  const total = await collection.countDocuments(filter);

  // Get paginated results (most recent first)
  const data = await collection
    .find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .toArray();

  return {
    data,
    pagination: {
      total,
      limit,
      skip,
      hasMore: skip + data.length < total
    }
  };
}

/**
 * Get tool statistics
 * Per FR-009 and data-model.md aggregation queries
 *
 * @param slug - Tool slug
 * @returns Aggregate statistics
 */
export async function getStats(slug: string): Promise<ToolStats> {
  const collection = await getToolCollection(slug);

  const pipeline = [
    {
      $group: {
        _id: null,
        totalResponses: { $sum: 1 },
        uniqueVisitors: { $addToSet: '$visitorId' },
        avgScore: { $avg: '$result.score' },
        firstResponse: { $min: '$createdAt' },
        lastResponse: { $max: '$createdAt' }
      }
    },
    {
      $project: {
        _id: 0,
        totalResponses: 1,
        uniqueVisitors: { $size: '$uniqueVisitors' },
        avgScore: { $round: ['$avgScore', 1] },
        firstResponse: 1,
        lastResponse: 1
      }
    }
  ];

  const results = await collection.aggregate(pipeline).toArray();

  if (results.length === 0) {
    return {
      totalResponses: 0,
      uniqueVisitors: 0,
      avgScore: null,
      firstResponse: null,
      lastResponse: null
    };
  }

  return results[0] as ToolStats;
}

// ========== DATABASE STATUS ==========

/**
 * Check if database is available
 *
 * @returns true if connected to MongoDB
 */
export function isDatabaseAvailable(): boolean {
  return isConnected();
}

// ========== EXPORTS ==========

export default {
  validateSlug,
  getCollectionName,
  generateVisitorId,
  hashIpAddress,
  checkRateLimit,
  getToolCollection,
  saveResponse,
  getResponses,
  getStats,
  isDatabaseAvailable
};
