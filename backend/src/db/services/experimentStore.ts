/**
 * Experiment Store Service
 * Feature: 020-self-improving-factory
 *
 * Database operations for A/B tests and results.
 */

import { Collection, ObjectId } from 'mongodb';
import { getDB, COLLECTIONS } from '../connection';
import {
  ABTest,
  ABResult,
  ABTestStatus,
  ABTestResults,
  PromptName,
} from '../../services/qualityScoring/types';

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

function getABTestsCollection(): Collection {
  return getDB().collection(COLLECTIONS.AB_TESTS);
}

function getABResultsCollection(): Collection {
  return getDB().collection(COLLECTIONS.AB_RESULTS);
}

// ========== A/B TESTS ==========

/**
 * Create a new A/B test (T074)
 */
export async function createABTest(test: Omit<ABTest, '_id'>): Promise<ABTest> {
  const collection = getABTestsCollection();
  const doc = { ...test, _id: new ObjectId() };
  await collection.insertOne(doc);
  return { ...test, _id: doc._id.toString() };
}

/**
 * Get A/B test by ID
 */
export async function getABTestById(testId: string): Promise<ABTest | null> {
  const collection = getABTestsCollection();
  const test = await collection.findOne({ _id: new ObjectId(testId) });
  return toTypedDoc<ABTest>(test);
}

/**
 * Get active test for a prompt (T075)
 * Returns the running A/B test for a specific prompt, if any
 */
export async function getActiveTestForPrompt(promptName: PromptName): Promise<ABTest | null> {
  const collection = getABTestsCollection();
  const test = await collection.findOne({
    prompt_name: promptName,
    status: 'running',
  });
  return toTypedDoc<ABTest>(test);
}

/**
 * Get all A/B tests with optional status filter
 */
export async function getABTests(options?: {
  status?: ABTestStatus;
  promptName?: PromptName;
  limit?: number;
}): Promise<ABTest[]> {
  const collection = getABTestsCollection();
  const filter: Record<string, unknown> = {};

  if (options?.status) filter.status = options.status;
  if (options?.promptName) filter.prompt_name = options.promptName;

  const tests = await collection
    .find(filter)
    .sort({ created_at: -1 })
    .limit(options?.limit || 50)
    .toArray();

  return toTypedDocs<ABTest>(tests);
}

/**
 * Update A/B test status (T077)
 */
export async function updateABTestStatus(
  testId: string,
  status: ABTestStatus
): Promise<boolean> {
  const collection = getABTestsCollection();
  const update: Record<string, unknown> = { status };

  if (status === 'running') {
    update.started_at = new Date();
  } else if (status === 'completed' || status === 'cancelled') {
    update.completed_at = new Date();
  }

  const result = await collection.updateOne(
    { _id: new ObjectId(testId) },
    { $set: update }
  );
  return result.modifiedCount > 0;
}

/**
 * Update A/B test results (T078)
 */
export async function updateABTestResults(
  testId: string,
  results: ABTestResults
): Promise<boolean> {
  const collection = getABTestsCollection();
  const result = await collection.updateOne(
    { _id: new ObjectId(testId) },
    { $set: { results } }
  );
  return result.modifiedCount > 0;
}

// ========== A/B RESULTS ==========

/**
 * Record an A/B result (T076)
 */
export async function recordABResult(result: Omit<ABResult, '_id'>): Promise<ABResult> {
  const collection = getABResultsCollection();
  const doc = { ...result, _id: new ObjectId() };
  await collection.insertOne(doc);
  return { ...result, _id: doc._id.toString() };
}

/**
 * Get results for an A/B test
 */
export async function getABResultsByTestId(testId: string): Promise<ABResult[]> {
  const collection = getABResultsCollection();
  const results = await collection
    .find({ ab_test_id: testId })
    .sort({ created_at: -1 })
    .toArray();
  return toTypedDocs<ABResult>(results);
}

/**
 * Get results grouped by variant
 */
export async function getABResultsByVariant(
  testId: string
): Promise<{ A: ABResult[]; B: ABResult[] }> {
  const results = await getABResultsByTestId(testId);
  return {
    A: results.filter(r => r.variant_id === 'A'),
    B: results.filter(r => r.variant_id === 'B'),
  };
}

/**
 * Count results by variant
 */
export async function countResultsByVariant(
  testId: string
): Promise<{ A: number; B: number }> {
  const collection = getABResultsCollection();

  const [countA, countB] = await Promise.all([
    collection.countDocuments({ ab_test_id: testId, variant_id: 'A' }),
    collection.countDocuments({ ab_test_id: testId, variant_id: 'B' }),
  ]);

  return { A: countA, B: countB };
}

// ========== INDEXES ==========

/**
 * Create indexes for A/B testing collections
 * Should be called during application startup
 */
export async function createIndexes(): Promise<void> {
  const db = getDB();

  // A/B tests indexes (T015)
  await db.collection(COLLECTIONS.AB_TESTS).createIndexes([
    { key: { status: 1 } },
    { key: { prompt_name: 1 } },
    { key: { created_at: -1 } },
    { key: { prompt_name: 1, status: 1 } },
  ]);

  // A/B results indexes (T016)
  await db.collection(COLLECTIONS.AB_RESULTS).createIndexes([
    { key: { ab_test_id: 1 } },
    { key: { ab_test_id: 1, variant_id: 1 } },
  ]);

  console.log('[ExperimentStore] Indexes created');
}
