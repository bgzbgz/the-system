/**
 * Prompt Version Store Service
 * Feature: 020-self-improving-factory
 *
 * Database operations for prompt version control.
 */

import { Collection, ObjectId } from 'mongodb';
import { getDB, COLLECTIONS } from '../connection';
import { PromptVersion, PromptName } from '../../services/qualityScoring/types';

// Helper to convert MongoDB document to typed object with string _id
function toTypedDoc<T extends { _id?: string }>(doc: unknown): T | null {
  if (!doc) return null;
  const d = doc as Record<string, unknown>;
  if (d._id instanceof ObjectId) {
    return { ...d, _id: d._id.toString() } as T;
  }
  return d as T;
}

function toTypedDocs<T extends { _id?: string }>(docs: unknown[]): T[] {
  return docs.map(doc => {
    const d = doc as Record<string, unknown>;
    if (d._id instanceof ObjectId) {
      return { ...d, _id: d._id.toString() } as T;
    }
    return d as T;
  });
}

// ========== COLLECTION ACCESS ==========

function getPromptVersionsCollection(): Collection {
  return getDB().collection(COLLECTIONS.PROMPT_VERSIONS);
}

// ========== PROMPT VERSIONS ==========

/**
 * Save a prompt version (T097)
 */
export async function savePromptVersion(version: PromptVersion): Promise<PromptVersion> {
  const collection = getPromptVersionsCollection();
  const doc = { ...version, _id: new ObjectId() };
  await collection.insertOne(doc);
  return { ...version, _id: doc._id.toString() };
}

/**
 * Get prompt version by ID (T098)
 */
export async function getPromptVersionById(versionId: string): Promise<PromptVersion | null> {
  const collection = getPromptVersionsCollection();
  const version = await collection.findOne({ _id: new ObjectId(versionId) });
  return toTypedDoc<PromptVersion>(version);
}

/**
 * Get all versions for a prompt (T099)
 */
export async function getVersionsByPromptName(promptName: PromptName): Promise<PromptVersion[]> {
  const collection = getPromptVersionsCollection();
  const versions = await collection
    .find({ prompt_name: promptName })
    .sort({ version: -1 })
    .toArray();
  return toTypedDocs<PromptVersion>(versions);
}

/**
 * Get the currently active version for a prompt (T100)
 */
export async function getActiveVersionByPromptName(
  promptName: PromptName
): Promise<PromptVersion | null> {
  const collection = getPromptVersionsCollection();
  const version = await collection.findOne({
    prompt_name: promptName,
    is_active: true,
  });
  return toTypedDoc<PromptVersion>(version);
}

/**
 * Get a specific version by prompt name and version number
 */
export async function getVersionByNumber(
  promptName: PromptName,
  versionNumber: number
): Promise<PromptVersion | null> {
  const collection = getPromptVersionsCollection();
  const version = await collection.findOne({
    prompt_name: promptName,
    version: versionNumber,
  });
  return toTypedDoc<PromptVersion>(version);
}

/**
 * Check if a content hash already exists for a prompt
 */
export async function existsByContentHash(
  promptName: PromptName,
  contentHash: string
): Promise<PromptVersion | null> {
  const collection = getPromptVersionsCollection();
  const version = await collection.findOne({
    prompt_name: promptName,
    content_hash: contentHash,
  });
  return toTypedDoc<PromptVersion>(version);
}

/**
 * Get the next version number for a prompt
 */
export async function getNextVersionNumber(promptName: PromptName): Promise<number> {
  const collection = getPromptVersionsCollection();
  const latest = await collection
    .find({ prompt_name: promptName })
    .sort({ version: -1 })
    .limit(1)
    .toArray();

  if (latest.length > 0) {
    const doc = latest[0] as Record<string, unknown>;
    return (doc.version as number) + 1;
  }
  return 1;
}

/**
 * Set a version as active (deactivates all others)
 */
export async function setActiveVersion(
  promptName: PromptName,
  versionNumber: number
): Promise<boolean> {
  const collection = getPromptVersionsCollection();

  // Deactivate all versions for this prompt
  await collection.updateMany(
    { prompt_name: promptName },
    { $set: { is_active: false } }
  );

  // Activate the specified version
  const result = await collection.updateOne(
    { prompt_name: promptName, version: versionNumber },
    { $set: { is_active: true } }
  );

  return result.modifiedCount > 0;
}

// ========== INDEXES ==========

/**
 * Create indexes for prompt versions collection
 * Should be called during application startup
 */
export async function createIndexes(): Promise<void> {
  const db = getDB();

  // Prompt versions indexes (T012)
  await db.collection(COLLECTIONS.PROMPT_VERSIONS).createIndexes([
    { key: { prompt_name: 1, version: 1 }, unique: true },
    { key: { content_hash: 1 } },
    { key: { prompt_name: 1, is_active: 1 } },
  ]);

  console.log('[PromptVersionStore] Indexes created');
}
