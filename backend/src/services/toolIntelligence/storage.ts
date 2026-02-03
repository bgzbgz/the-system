/**
 * Tool Intelligence Service - Storage
 * Feature: 018-tool-intelligence
 *
 * MongoDB storage for tool analysis documents.
 */

import { Collection, ObjectId } from 'mongodb';
import { getDB, isConnected } from '../../db/connection';
import { ToolAnalysis, AnalysisStatus } from './types';

// ========== CONSTANTS ==========

/** Collection name for tool analyses */
const ANALYSIS_COLLECTION = 'tool_analyses';

// Track collections that have been initialized
const initializedCollections = new Set<string>();

// ========== COLLECTION MANAGEMENT ==========

/**
 * Get the tool_analyses collection with indexes
 */
async function getAnalysisCollection(): Promise<Collection<ToolAnalysis>> {
  const db = getDB();
  const collection = db.collection<ToolAnalysis>(ANALYSIS_COLLECTION);

  // Create indexes if not already done
  if (!initializedCollections.has(ANALYSIS_COLLECTION)) {
    try {
      // Index for looking up analysis by response
      await collection.createIndex({ responseId: 1 });

      // Index for rate limiting check
      await collection.createIndex(
        { toolSlug: 1, userId: 1, generatedAt: -1 }
      );

      // TTL index for automatic cleanup (30 days by default, same as tool responses)
      const ttlDays = parseInt(process.env.ANALYSIS_TTL_DAYS || '30', 10);
      await collection.createIndex(
        { generatedAt: 1 },
        { expireAfterSeconds: ttlDays * 24 * 60 * 60 }
      );

      initializedCollections.add(ANALYSIS_COLLECTION);
      console.log('[ToolIntelligence] Analysis collection indexes created');
    } catch (error) {
      // Indexes may already exist
      console.log('[ToolIntelligence] Index creation skipped (may already exist)');
      initializedCollections.add(ANALYSIS_COLLECTION);
    }
  }

  return collection;
}

// ========== STORAGE OPERATIONS ==========

/**
 * Store an analysis document
 *
 * @param analysis - Analysis data to store
 * @returns Stored document with _id
 */
export async function storeAnalysis(
  analysis: Omit<ToolAnalysis, '_id'>
): Promise<ToolAnalysis> {
  if (!isConnected()) {
    throw new Error('Database not connected');
  }

  const collection = await getAnalysisCollection();

  const doc: Omit<ToolAnalysis, '_id'> = {
    ...analysis,
    generatedAt: analysis.generatedAt || new Date()
  };

  const result = await collection.insertOne(doc as any);

  return {
    ...doc,
    _id: result.insertedId
  } as ToolAnalysis;
}

/**
 * Get analysis by response ID
 *
 * @param responseId - Tool response ID
 * @returns Analysis document or null
 */
export async function getAnalysisByResponseId(
  responseId: string
): Promise<ToolAnalysis | null> {
  if (!isConnected()) {
    return null;
  }

  try {
    const collection = await getAnalysisCollection();
    const objectId = new ObjectId(responseId);

    return await collection.findOne({ responseId: objectId });
  } catch (error) {
    console.error('[ToolIntelligence] Error getting analysis:', error);
    return null;
  }
}

/**
 * Get the most recent analysis for a user/tool combination
 *
 * @param toolSlug - Tool identifier
 * @param userId - User identifier
 * @returns Most recent analysis or null
 */
export async function getLatestAnalysis(
  toolSlug: string,
  userId: string
): Promise<ToolAnalysis | null> {
  if (!isConnected()) {
    return null;
  }

  try {
    const collection = await getAnalysisCollection();

    return await collection.findOne(
      { toolSlug, userId, status: 'completed' },
      { sort: { generatedAt: -1 } }
    );
  } catch (error) {
    console.error('[ToolIntelligence] Error getting latest analysis:', error);
    return null;
  }
}

/**
 * Update analysis status (e.g., mark as failed)
 *
 * @param analysisId - Analysis document ID
 * @param status - New status
 * @param errorMessage - Optional error message
 */
export async function updateAnalysisStatus(
  analysisId: ObjectId,
  status: AnalysisStatus,
  errorMessage?: string
): Promise<void> {
  if (!isConnected()) {
    return;
  }

  try {
    const collection = await getAnalysisCollection();

    await collection.updateOne(
      { _id: analysisId },
      {
        $set: {
          status,
          ...(errorMessage && { errorMessage })
        }
      }
    );
  } catch (error) {
    console.error('[ToolIntelligence] Error updating analysis status:', error);
  }
}

/**
 * Count analyses for a tool
 *
 * @param toolSlug - Tool identifier
 * @returns Count of analyses
 */
export async function countAnalyses(toolSlug: string): Promise<number> {
  if (!isConnected()) {
    return 0;
  }

  try {
    const collection = await getAnalysisCollection();
    return await collection.countDocuments({ toolSlug });
  } catch (error) {
    console.error('[ToolIntelligence] Error counting analyses:', error);
    return 0;
  }
}

export default {
  storeAnalysis,
  getAnalysisByResponseId,
  getLatestAnalysis,
  updateAnalysisStatus,
  countAnalyses
};
