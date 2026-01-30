/**
 * Database Initialization
 * Spec: 017-mongodb-schema
 *
 * Per contracts/database.yaml: Index creation and context seeding
 * All operations are idempotent - safe to run on every startup
 */

import { Db, Collection } from 'mongodb';
import { getDB, COLLECTIONS, getToolResponseCollectionName } from './connection';
import { REQUIRED_CONTEXTS, CONTEXT_TITLES, ContextKey } from './types/contextKeys';

// ========== INDEX CREATION ==========

/**
 * Create indexes for jobs collection
 * Per data-model.md Jobs Indexes
 */
export async function createJobsIndexes(db: Db): Promise<void> {
  const collection = db.collection(COLLECTIONS.JOBS);

  await collection.createIndex({ job_id: 1 }, { unique: true });
  await collection.createIndex({ status: 1 });
  await collection.createIndex({ created_at: -1 });
  await collection.createIndex({ 'questionnaire.category': 1 });

  console.log('[MongoDB] Jobs indexes created');
}

/**
 * Create indexes for audit_log collection
 * Per data-model.md Audit Log Indexes
 */
export async function createAuditLogIndexes(db: Db): Promise<void> {
  const collection = db.collection(COLLECTIONS.AUDIT_LOG);

  await collection.createIndex({ event_id: 1 }, { unique: true });
  await collection.createIndex({ job_id: 1 });
  await collection.createIndex({ timestamp: -1 });
  await collection.createIndex({ event_type: 1 });

  console.log('[MongoDB] Audit log indexes created');
}

/**
 * Create indexes for system_context collection
 * Per data-model.md System Context Indexes
 */
export async function createSystemContextIndexes(db: Db): Promise<void> {
  const collection = db.collection(COLLECTIONS.SYSTEM_CONTEXT);

  await collection.createIndex({ key: 1 }, { unique: true });

  console.log('[MongoDB] System context indexes created');
}

/**
 * Create indexes for deployed_tools collection
 * Per data-model.md Deployed Tools Indexes
 */
export async function createDeployedToolsIndexes(db: Db): Promise<void> {
  const collection = db.collection(COLLECTIONS.DEPLOYED_TOOLS);

  await collection.createIndex({ tool_id: 1 }, { unique: true });
  await collection.createIndex({ tool_slug: 1 }, { unique: true });

  console.log('[MongoDB] Deployed tools indexes created');
}

/**
 * Create indexes for a tool response collection
 * Per data-model.md Tool Response Indexes
 *
 * @param db - Database instance
 * @param slug - Tool slug
 */
export async function createToolResponseIndexes(db: Db, slug: string): Promise<void> {
  const collectionName = getToolResponseCollectionName(slug);
  const collection = db.collection(collectionName);

  await collection.createIndex({ response_id: 1 }, { unique: true });
  await collection.createIndex({ user_id: 1 });
  await collection.createIndex({ completed_at: -1 });

  console.log(`[MongoDB] Tool response indexes created for ${collectionName}`);
}

/**
 * Create all static collection indexes
 * Per contracts/database.yaml initialization.on_startup
 */
export async function createAllIndexes(db: Db): Promise<void> {
  console.log('[MongoDB] Creating indexes...');

  await createJobsIndexes(db);
  await createAuditLogIndexes(db);
  await createSystemContextIndexes(db);
  await createDeployedToolsIndexes(db);

  console.log('[MongoDB] All indexes created');
}

// ========== SYSTEM CONTEXT SEEDING ==========

/**
 * Seed required system context documents
 * Per contracts/database.yaml initialization.on_startup.seed_context
 *
 * Uses upsert with $setOnInsert to only create if not exists
 * Safe to run on every startup
 */
export async function seedSystemContext(db: Db): Promise<void> {
  console.log('[MongoDB] Seeding system context documents...');

  const collection = db.collection(COLLECTIONS.SYSTEM_CONTEXT);

  for (const key of REQUIRED_CONTEXTS) {
    const title = CONTEXT_TITLES[key as ContextKey];

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

  console.log(`[MongoDB] System context seeded: ${REQUIRED_CONTEXTS.length} documents`);
}

// ========== INITIALIZATION ==========

/**
 * Initialize database: create indexes and seed context
 * Per contracts/database.yaml initialization.on_startup
 *
 * @param db - Optional database instance (uses getDB() if not provided)
 */
export async function initializeDatabase(db?: Db): Promise<void> {
  const database = db || getDB();

  console.log('[MongoDB] Initializing database...');

  // Create all static collection indexes
  await createAllIndexes(database);

  // Seed required system context documents
  await seedSystemContext(database);

  console.log('[MongoDB] Database initialization complete');
}

/**
 * Ensure tool response collection exists with indexes
 * Called when first response is recorded for a tool
 *
 * @param slug - Tool slug
 */
export async function ensureToolResponseCollection(slug: string): Promise<Collection> {
  const db = getDB();
  const collectionName = getToolResponseCollectionName(slug);

  // Check if indexes already exist
  const collection = db.collection(collectionName);
  const indexes = await collection.indexes().catch(() => []);

  // If only _id index exists, create our indexes
  if (indexes.length <= 1) {
    await createToolResponseIndexes(db, slug);
  }

  return collection;
}
