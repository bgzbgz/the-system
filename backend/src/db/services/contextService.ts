/**
 * Context Service
 * Spec: 017-mongodb-schema
 *
 * Per contracts/database.yaml operations.system_context
 * Operations for AI factory configuration documents
 */

import { Collection, Document } from 'mongodb';
import { getDB, COLLECTIONS } from '../connection';
import {
  SystemContext,
  UpdateContextInput,
  systemContextToResponse,
  SystemContextResponse,
  SystemContextListResponse
} from '../models/systemContext';
import { ContextKey, REQUIRED_CONTEXTS, CONTEXT_TITLES } from '../types/contextKeys';

// ========== COLLECTION ACCESS ==========

/**
 * Get system_context collection
 */
function getContextCollection(): Collection<SystemContext & Document> {
  return getDB().collection<SystemContext & Document>(COLLECTIONS.SYSTEM_CONTEXT);
}

// ========== READ ==========

/**
 * Get a context document by key
 * Per contracts/database.yaml operations.system_context.get_by_key
 *
 * @param key - Context key
 * @returns Context document or null
 */
export async function getByKey(key: string): Promise<SystemContext | null> {
  const collection = getContextCollection();
  const context = await collection.findOne({ key });
  return context as SystemContext | null;
}

/**
 * Get all context documents
 *
 * @returns All context documents
 */
export async function getAllContexts(): Promise<SystemContext[]> {
  const collection = getContextCollection();
  const contexts = await collection.find({}).toArray();
  return contexts as SystemContext[];
}

/**
 * Get all context documents as responses
 *
 * @returns Context list response
 */
export async function getAllContextsAsResponse(): Promise<SystemContextListResponse> {
  const contexts = await getAllContexts();
  return {
    contexts: contexts.map(systemContextToResponse)
  };
}

// ========== UPDATE ==========

/**
 * Update result
 */
export interface UpdateResult {
  success: boolean;
  context?: SystemContext;
  error?: string;
}

/**
 * Update context content
 * Per contracts/database.yaml operations.system_context.update_content
 *
 * Increments version and updates timestamp
 *
 * @param key - Context key
 * @param input - Update input
 * @returns Update result
 */
export async function updateContent(key: string, input: UpdateContextInput): Promise<UpdateResult> {
  const collection = getContextCollection();

  // Check if context exists
  const existing = await getByKey(key);
  if (!existing) {
    return { success: false, error: `Context not found: ${key}` };
  }

  // Update with version increment
  const result = await collection.findOneAndUpdate(
    { key },
    {
      $set: {
        content: input.content,
        updated_at: new Date()
      },
      $inc: { version: 1 }
    },
    { returnDocument: 'after' }
  );

  if (!result) {
    return { success: false, error: 'Update failed' };
  }

  return { success: true, context: result as SystemContext };
}

// ========== INITIALIZATION ==========

/**
 * Ensure a context document exists
 * Uses upsert with $setOnInsert to only create if missing
 *
 * @param key - Context key
 * @param title - Context title
 */
export async function ensureContext(key: string, title: string): Promise<void> {
  const collection = getContextCollection();

  await collection.updateOne(
    { key },
    {
      $setOnInsert: {
        key,
        title,
        content: '',
        version: 1,
        updated_at: new Date()
      }
    },
    { upsert: true }
  );
}

/**
 * Initialize all required context documents
 * Safe to call on every startup (idempotent)
 */
export async function initializeAllContexts(): Promise<void> {
  for (const key of REQUIRED_CONTEXTS) {
    const title = CONTEXT_TITLES[key as ContextKey];
    await ensureContext(key, title);
  }
}

// ========== VALIDATION ==========

/**
 * Check if all required contexts are initialized
 *
 * @returns true if all contexts exist
 */
export async function areAllContextsInitialized(): Promise<boolean> {
  const contexts = await getAllContexts();
  const keys = new Set(contexts.map(c => c.key));

  return REQUIRED_CONTEXTS.every(k => keys.has(k));
}

/**
 * Get missing required contexts
 *
 * @returns Array of missing context keys
 */
export async function getMissingContexts(): Promise<string[]> {
  const contexts = await getAllContexts();
  const keys = new Set(contexts.map(c => c.key));

  return REQUIRED_CONTEXTS.filter(k => !keys.has(k));
}
