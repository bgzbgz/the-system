/**
 * Tool Intelligence Service - Rate Limiter
 * Feature: 018-tool-intelligence
 *
 * Rate limiting for AI analysis requests.
 * Limit: 1 analysis per user per tool per 5 minutes.
 */

import { Collection, ObjectId } from 'mongodb';
import { getDB, isConnected } from '../../db/connection';
import { ToolAnalysis } from './types';

// ========== CONSTANTS ==========

/** Rate limit window in milliseconds (5 minutes) */
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;

/** Collection name for tool analyses */
const ANALYSIS_COLLECTION = 'tool_analyses';

// ========== HELPER FUNCTIONS ==========

/**
 * Get the tool_analyses collection
 */
function getAnalysisCollection(): Collection<ToolAnalysis> {
  return getDB().collection<ToolAnalysis>(ANALYSIS_COLLECTION);
}

// ========== RATE LIMITING ==========

/**
 * Check if a user has exceeded the rate limit for analysis requests
 *
 * @param toolSlug - Tool identifier
 * @param userId - User identifier (LearnWorlds user ID or visitor ID)
 * @returns Rate limit info: { limited: boolean, retryAfter?: number }
 */
export async function checkAnalysisRateLimit(
  toolSlug: string,
  userId: string
): Promise<{ limited: boolean; retryAfter?: number; lastAnalysisAt?: Date }> {
  if (!isConnected()) {
    // If DB is unavailable, don't rate limit
    return { limited: false };
  }

  try {
    const collection = getAnalysisCollection();
    const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);

    // Find the most recent analysis for this user/tool combination
    const recentAnalysis = await collection.findOne(
      {
        toolSlug,
        userId,
        generatedAt: { $gte: windowStart },
        status: 'completed'
      },
      { sort: { generatedAt: -1 } }
    );

    if (recentAnalysis) {
      const timeSinceLast = Date.now() - recentAnalysis.generatedAt.getTime();
      const retryAfter = Math.ceil((RATE_LIMIT_WINDOW_MS - timeSinceLast) / 1000);

      return {
        limited: true,
        retryAfter,
        lastAnalysisAt: recentAnalysis.generatedAt
      };
    }

    return { limited: false };
  } catch (error) {
    console.error('[RateLimiter] Error checking rate limit:', error);
    // On error, don't rate limit (fail open)
    return { limited: false };
  }
}

/**
 * Get the retry-after value in seconds for a rate-limited request
 *
 * @param toolSlug - Tool identifier
 * @param userId - User identifier
 * @returns Seconds until rate limit resets, or 0 if not limited
 */
export async function getRateLimitRetryAfter(
  toolSlug: string,
  userId: string
): Promise<number> {
  const result = await checkAnalysisRateLimit(toolSlug, userId);
  return result.retryAfter || 0;
}

/**
 * Get rate limit window in seconds (for API responses)
 */
export function getRateLimitWindowSeconds(): number {
  return RATE_LIMIT_WINDOW_MS / 1000;
}

export default {
  checkAnalysisRateLimit,
  getRateLimitRetryAfter,
  getRateLimitWindowSeconds
};
