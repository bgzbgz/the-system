/**
 * Tool Visits Tracking Service
 *
 * Logs and tracks when LearnWorlds users visit tools
 */

import { getDB, isConnected } from '../../config/database';
import { LearnWorldsUser } from './users';

export interface ToolVisit {
  _id?: string;
  tool_slug: string;
  tool_name?: string;
  user_id: string;
  email: string;
  username?: string;
  full_name?: string;
  company?: string;
  tags?: string[];
  source_course?: string;
  visited_at: Date;
  ip_address?: string;
  user_agent?: string;
}

// In-memory fallback when MongoDB not available
const inMemoryVisits: ToolVisit[] = [];

/**
 * Log a tool visit
 */
export async function logToolVisit(
  toolSlug: string,
  user: LearnWorldsUser,
  metadata?: {
    sourceCourse?: string;
    ipAddress?: string;
    userAgent?: string;
    toolName?: string;
  }
): Promise<ToolVisit> {
  const visit: ToolVisit = {
    tool_slug: toolSlug,
    tool_name: metadata?.toolName,
    user_id: user.id,
    email: user.email,
    username: user.username,
    full_name: [user.first_name, user.last_name].filter(Boolean).join(' ') || undefined,
    company: user.fields?.company,
    tags: user.tags,
    source_course: metadata?.sourceCourse,
    visited_at: new Date(),
    ip_address: metadata?.ipAddress,
    user_agent: metadata?.userAgent
  };

  console.log(`[Tool Visits] Logging visit: ${user.email} → ${toolSlug}`);

  if (isConnected()) {
    try {
      const db = getDB();
      const collection = db.collection('tool_visits');
      const result = await collection.insertOne(visit as unknown as Record<string, unknown>);
      visit._id = result.insertedId.toString();
      console.log(`[Tool Visits] Saved to MongoDB: ${visit._id}`);
    } catch (error) {
      console.error('[Tool Visits] Failed to save to MongoDB:', error);
      inMemoryVisits.push(visit);
    }
  } else {
    inMemoryVisits.push(visit);
    console.log(`[Tool Visits] Saved to memory (${inMemoryVisits.length} total)`);
  }

  return visit;
}

/**
 * Get visits for a specific tool
 */
export async function getToolVisits(toolSlug: string, limit = 100): Promise<ToolVisit[]> {
  if (isConnected()) {
    try {
      const db = getDB();
      const collection = db.collection<ToolVisit>('tool_visits');
      return await collection
        .find({ tool_slug: toolSlug })
        .sort({ visited_at: -1 })
        .limit(limit)
        .toArray();
    } catch (error) {
      console.error('[Tool Visits] Failed to fetch from MongoDB:', error);
    }
  }

  return inMemoryVisits
    .filter(v => v.tool_slug === toolSlug)
    .sort((a, b) => b.visited_at.getTime() - a.visited_at.getTime())
    .slice(0, limit);
}

/**
 * Get visits by a specific user
 */
export async function getUserVisits(userId: string, limit = 100): Promise<ToolVisit[]> {
  if (isConnected()) {
    try {
      const db = getDB();
      const collection = db.collection<ToolVisit>('tool_visits');
      return await collection
        .find({ user_id: userId })
        .sort({ visited_at: -1 })
        .limit(limit)
        .toArray();
    } catch (error) {
      console.error('[Tool Visits] Failed to fetch from MongoDB:', error);
    }
  }

  return inMemoryVisits
    .filter(v => v.user_id === userId)
    .sort((a, b) => b.visited_at.getTime() - a.visited_at.getTime())
    .slice(0, limit);
}

/**
 * Get visit statistics for a tool
 */
export async function getToolStats(toolSlug: string): Promise<{
  total_visits: number;
  unique_users: number;
  recent_visits: ToolVisit[];
}> {
  if (isConnected()) {
    try {
      const db = getDB();
      const collection = db.collection<ToolVisit>('tool_visits');

      const [totalResult, uniqueResult, recentVisits] = await Promise.all([
        collection.countDocuments({ tool_slug: toolSlug }),
        collection.distinct('user_id', { tool_slug: toolSlug }),
        collection
          .find({ tool_slug: toolSlug })
          .sort({ visited_at: -1 })
          .limit(10)
          .toArray()
      ]);

      return {
        total_visits: totalResult,
        unique_users: uniqueResult.length,
        recent_visits: recentVisits
      };
    } catch (error) {
      console.error('[Tool Visits] Failed to get stats from MongoDB:', error);
    }
  }

  const toolVisits = inMemoryVisits.filter(v => v.tool_slug === toolSlug);
  const uniqueUsers = new Set(toolVisits.map(v => v.user_id));

  return {
    total_visits: toolVisits.length,
    unique_users: uniqueUsers.size,
    recent_visits: toolVisits
      .sort((a, b) => b.visited_at.getTime() - a.visited_at.getTime())
      .slice(0, 10)
  };
}

/**
 * Ensure indexes exist for tool_visits collection
 */
export async function ensureToolVisitsIndexes(): Promise<void> {
  if (!isConnected()) return;

  try {
    const db = getDB();
    const collection = db.collection('tool_visits');

    await collection.createIndexes([
      { key: { tool_slug: 1, visited_at: -1 } },
      { key: { user_id: 1, visited_at: -1 } },
      { key: { email: 1 } },
      { key: { visited_at: -1 } }
    ]);

    console.log('[Tool Visits] Indexes created');
  } catch (error) {
    console.error('[Tool Visits] Failed to create indexes:', error);
  }
}
