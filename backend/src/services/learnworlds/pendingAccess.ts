/**
 * Pending Tool Access Service
 *
 * Stores temporary access grants from LearnWorlds tag webhooks
 * When user clicks a tool button in LearnWorlds:
 * 1. Tag is added → webhook sent here → stored as pending
 * 2. User's browser opens tool page
 * 3. Tool page checks pending access → instant verification
 */

import { getDb, isConnected } from '../../config/database';

export interface PendingAccess {
  _id?: string;
  user_id: string;
  email: string;
  tool_slug: string;
  user_name?: string;
  company?: string;
  tags?: string[];
  created_at: Date;
  expires_at: Date;
  used: boolean;
}

// In-memory fallback (with auto-cleanup)
const inMemoryPending: Map<string, PendingAccess> = new Map();

// Clean up expired entries every 30 seconds
setInterval(() => {
  const now = new Date();
  for (const [key, access] of inMemoryPending.entries()) {
    if (access.expires_at < now) {
      inMemoryPending.delete(key);
    }
  }
}, 30000);

/**
 * Create a pending access entry
 * Called when we receive a tool-access tag webhook
 */
export async function createPendingAccess(
  userId: string,
  email: string,
  toolSlug: string,
  userData?: {
    name?: string;
    company?: string;
    tags?: string[];
  }
): Promise<PendingAccess> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 60 * 1000); // 60 seconds

  const pending: PendingAccess = {
    user_id: userId,
    email: email.toLowerCase(),
    tool_slug: toolSlug,
    user_name: userData?.name,
    company: userData?.company,
    tags: userData?.tags,
    created_at: now,
    expires_at: expiresAt,
    used: false
  };

  const key = `${email.toLowerCase()}:${toolSlug}`;

  if (isConnected()) {
    try {
      const db = getDb();
      const collection = db.collection('pending_tool_access');

      // Upsert - replace any existing pending access for same user+tool
      await collection.updateOne(
        { email: pending.email, tool_slug: toolSlug },
        { $set: pending },
        { upsert: true }
      );

      console.log(`[Pending Access] Created: ${email} → ${toolSlug} (expires in 60s)`);
    } catch (error) {
      console.error('[Pending Access] Failed to save to MongoDB:', error);
      inMemoryPending.set(key, pending);
    }
  } else {
    inMemoryPending.set(key, pending);
    console.log(`[Pending Access] Created in memory: ${email} → ${toolSlug}`);
  }

  return pending;
}

/**
 * Check for pending access
 * Returns the pending access if valid and not expired
 */
export async function checkPendingAccess(
  email: string,
  toolSlug: string
): Promise<PendingAccess | null> {
  const normalizedEmail = email.toLowerCase();
  const key = `${normalizedEmail}:${toolSlug}`;
  const now = new Date();

  if (isConnected()) {
    try {
      const db = getDb();
      const collection = db.collection<PendingAccess>('pending_tool_access');

      const pending = await collection.findOne({
        email: normalizedEmail,
        tool_slug: toolSlug,
        expires_at: { $gt: now },
        used: false
      });

      if (pending) {
        // Mark as used
        await collection.updateOne(
          { _id: pending._id },
          { $set: { used: true } }
        );
        console.log(`[Pending Access] Found and consumed: ${email} → ${toolSlug}`);
        return pending;
      }
    } catch (error) {
      console.error('[Pending Access] Failed to check MongoDB:', error);
    }
  }

  // Check in-memory
  const memoryPending = inMemoryPending.get(key);
  if (memoryPending && memoryPending.expires_at > now && !memoryPending.used) {
    memoryPending.used = true;
    console.log(`[Pending Access] Found in memory: ${email} → ${toolSlug}`);
    return memoryPending;
  }

  return null;
}

/**
 * Clean up expired pending access entries
 */
export async function cleanupExpiredAccess(): Promise<number> {
  const now = new Date();
  let deleted = 0;

  if (isConnected()) {
    try {
      const db = getDb();
      const collection = db.collection('pending_tool_access');
      const result = await collection.deleteMany({
        expires_at: { $lt: now }
      });
      deleted = result.deletedCount;
    } catch (error) {
      console.error('[Pending Access] Cleanup failed:', error);
    }
  }

  // Clean in-memory
  for (const [key, access] of inMemoryPending.entries()) {
    if (access.expires_at < now) {
      inMemoryPending.delete(key);
      deleted++;
    }
  }

  return deleted;
}

/**
 * Ensure indexes for pending_tool_access collection
 */
export async function ensurePendingAccessIndexes(): Promise<void> {
  if (!isConnected()) return;

  try {
    const db = getDb();
    const collection = db.collection('pending_tool_access');

    await collection.createIndexes([
      { key: { email: 1, tool_slug: 1 } },
      { key: { expires_at: 1 }, expireAfterSeconds: 0 } // TTL index - auto-delete expired
    ]);

    console.log('[Pending Access] Indexes created');
  } catch (error) {
    console.error('[Pending Access] Failed to create indexes:', error);
  }
}
