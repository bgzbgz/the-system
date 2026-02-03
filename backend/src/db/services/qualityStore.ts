/**
 * Quality Store Service
 * Feature: 020-self-improving-factory
 *
 * Database operations for quality scores, patterns, suggestions, and daily aggregates.
 */

import { Collection, ObjectId } from 'mongodb';
import { getDB, COLLECTIONS } from '../connection';
import {
  QualityScore,
  QualityPattern,
  Suggestion,
  DailyAggregate,
  DashboardSummary,
  CriterionId,
  SuggestionStatus,
  PatternStatus,
} from '../../services/qualityScoring/types';

// Helper to convert MongoDB document to typed object with string _id
function toTypedDoc<T extends { _id?: string }>(doc: unknown): T {
  if (!doc) return doc as T;
  const d = doc as Record<string, unknown>;
  if (d._id instanceof ObjectId) {
    return { ...d, _id: d._id.toString() } as T;
  }
  return d as T;
}

function toTypedDocs<T extends { _id?: string }>(docs: unknown[]): T[] {
  return docs.map(doc => toTypedDoc<T>(doc));
}

// ========== COLLECTION ACCESS ==========

function getQualityScoresCollection(): Collection {
  return getDB().collection(COLLECTIONS.QUALITY_SCORES);
}

function getPatternsCollection(): Collection {
  return getDB().collection(COLLECTIONS.QUALITY_PATTERNS);
}

function getSuggestionsCollection(): Collection {
  return getDB().collection(COLLECTIONS.SUGGESTIONS);
}

function getDailyAggregatesCollection(): Collection {
  return getDB().collection(COLLECTIONS.DAILY_AGGREGATES);
}

// ========== QUALITY SCORES ==========

/**
 * Save a quality score
 */
export async function saveQualityScore(score: QualityScore): Promise<QualityScore> {
  const collection = getQualityScoresCollection();
  const doc = { ...score, _id: new ObjectId() };
  await collection.insertOne(doc);
  return { ...score, _id: doc._id.toString() };
}

/**
 * Get quality score by job ID (T034)
 */
export async function getScoreByJobId(jobId: string): Promise<QualityScore | null> {
  const collection = getQualityScoresCollection();
  const score = await collection.findOne({ job_id: jobId });
  return toTypedDoc<QualityScore>(score);
}

/**
 * Get scores within a time window (T045)
 */
export async function getScoresInWindow(
  windowStart: Date,
  windowEnd: Date
): Promise<QualityScore[]> {
  const collection = getQualityScoresCollection();
  const scores = await collection
    .find({
      created_at: {
        $gte: windowStart,
        $lte: windowEnd,
      },
    })
    .sort({ created_at: -1 })
    .toArray();
  return toTypedDocs<QualityScore>(scores);
}

/**
 * Get dashboard summary (T035)
 */
export async function getDashboardSummary(days: number = 30): Promise<DashboardSummary> {
  const collection = getQualityScoresCollection();
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

  const rawScores = await collection
    .find({
      created_at: { $gte: startDate, $lte: endDate },
    })
    .toArray();
  const scores = toTypedDocs<QualityScore>(rawScores);

  const totalTools = scores.length;
  const passCount = scores.filter(s => s.passed).length;
  const avgScore = totalTools > 0
    ? scores.reduce((sum, s) => sum + s.overall_score, 0) / totalTools
    : 0;

  // Calculate per-criterion pass rates
  const criteriaIds: CriterionId[] = [
    'decision', 'zero_questions', 'easy_steps', 'feedback',
    'gamification', 'results', 'commitment', 'brand'
  ];

  const criterionPassRates = {} as Record<CriterionId, number>;
  for (const criterionId of criteriaIds) {
    const passCount = scores.filter(s =>
      s.criteria.find(c => c.criterion_id === criterionId)?.passed
    ).length;
    criterionPassRates[criterionId] = totalTools > 0
      ? Math.round((passCount / totalTools) * 100)
      : 0;
  }

  // Calculate daily scores for trend chart
  const dailyMap = new Map<string, { total: number; sum: number; count: number }>();
  for (const score of scores) {
    const dateKey = score.created_at.toISOString().split('T')[0];
    const existing = dailyMap.get(dateKey) || { total: 0, sum: 0, count: 0 };
    dailyMap.set(dateKey, {
      total: existing.total + 1,
      sum: existing.sum + score.overall_score,
      count: existing.count + 1,
    });
  }

  const dailyScores = Array.from(dailyMap.entries())
    .map(([date, data]) => ({
      date,
      average_score: Math.round((data.sum / data.count) * 10) / 10,
      total_tools: data.total,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Calculate trend (compare last 7 days vs previous 7 days)
  const midpoint = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
  const recentScores = scores.filter(s => s.created_at >= midpoint);
  const olderScores = scores.filter(s => s.created_at < midpoint);

  const recentAvg = recentScores.length > 0
    ? recentScores.reduce((sum, s) => sum + s.overall_score, 0) / recentScores.length
    : 0;
  const olderAvg = olderScores.length > 0
    ? olderScores.reduce((sum, s) => sum + s.overall_score, 0) / olderScores.length
    : 0;

  let scoreTrend: 'up' | 'down' | 'stable' = 'stable';
  if (recentAvg > olderAvg + 5) scoreTrend = 'up';
  else if (recentAvg < olderAvg - 5) scoreTrend = 'down';

  return {
    period: {
      start: startDate,
      end: endDate,
      days,
    },
    total_tools: totalTools,
    average_score: Math.round(avgScore * 10) / 10,
    pass_rate: totalTools > 0 ? Math.round((passCount / totalTools) * 100) : 0,
    score_trend: scoreTrend,
    criterion_pass_rates: criterionPassRates,
    daily_scores: dailyScores,
    prompt_performance: [], // TODO: Implement prompt version tracking
  };
}

/**
 * Get quality trends (T036)
 */
export async function getQualityTrends(days: number = 30): Promise<{
  daily: Array<{ date: string; average_score: number; total_tools: number }>;
  criterion_trends: Record<CriterionId, Array<{ date: string; pass_rate: number }>>;
}> {
  const summary = await getDashboardSummary(days);

  // For now, return daily scores - criterion trends can be calculated from aggregates
  return {
    daily: summary.daily_scores,
    criterion_trends: {} as Record<CriterionId, Array<{ date: string; pass_rate: number }>>,
  };
}

/**
 * Get quality scores by prompt version (T105)
 */
export async function getQualityByPromptVersion(
  promptName: string,
  version: number
): Promise<{ average_score: number; total_tools: number; pass_rate: number }> {
  const collection = getQualityScoresCollection();
  const rawScores = await collection
    .find({
      [`prompt_versions.${promptName}`]: version.toString(),
    })
    .toArray();
  const scores = toTypedDocs<QualityScore>(rawScores);

  const totalTools = scores.length;
  const passCount = scores.filter(s => s.passed).length;
  const avgScore = totalTools > 0
    ? scores.reduce((sum, s) => sum + s.overall_score, 0) / totalTools
    : 0;

  return {
    average_score: Math.round(avgScore * 10) / 10,
    total_tools: totalTools,
    pass_rate: totalTools > 0 ? Math.round((passCount / totalTools) * 100) : 0,
  };
}

// ========== PATTERNS ==========

/**
 * Save a quality pattern (T046)
 */
export async function savePattern(pattern: QualityPattern): Promise<QualityPattern> {
  const collection = getPatternsCollection();
  const doc = { ...pattern, _id: new ObjectId() };
  await collection.insertOne(doc);
  return { ...pattern, _id: doc._id.toString() };
}

/**
 * Get active patterns (T047)
 */
export async function getActivePatterns(): Promise<QualityPattern[]> {
  const collection = getPatternsCollection();
  const patterns = await collection
    .find({ status: 'active' })
    .sort({ failure_rate: -1 })
    .toArray();
  return toTypedDocs<QualityPattern>(patterns);
}

/**
 * Update pattern status
 */
export async function updatePatternStatus(
  patternId: string,
  status: PatternStatus
): Promise<boolean> {
  const collection = getPatternsCollection();
  const result = await collection.updateOne(
    { _id: new ObjectId(patternId) },
    { $set: { status, updated_at: new Date() } }
  );
  return result.modifiedCount > 0;
}

// ========== SUGGESTIONS ==========

/**
 * Save a suggestion (T059)
 */
export async function saveSuggestion(suggestion: Suggestion): Promise<Suggestion> {
  const collection = getSuggestionsCollection();
  const doc = { ...suggestion, _id: new ObjectId() };
  await collection.insertOne(doc);
  return { ...suggestion, _id: doc._id.toString() };
}

/**
 * Get suggestions by status (T060)
 */
export async function getSuggestionsByStatus(status: SuggestionStatus): Promise<Suggestion[]> {
  const collection = getSuggestionsCollection();
  const suggestions = await collection
    .find({ status })
    .sort({ created_at: -1 })
    .toArray();
  return toTypedDocs<Suggestion>(suggestions);
}

/**
 * Get suggestion by ID
 */
export async function getSuggestionById(suggestionId: string): Promise<Suggestion | null> {
  const collection = getSuggestionsCollection();
  const suggestion = await collection.findOne({ _id: new ObjectId(suggestionId) });
  return toTypedDoc<Suggestion>(suggestion);
}

/**
 * Update suggestion status (T061)
 */
export async function updateSuggestionStatus(
  suggestionId: string,
  status: SuggestionStatus,
  operatorNotes?: string,
  reviewedBy?: string
): Promise<boolean> {
  const collection = getSuggestionsCollection();
  const update: Record<string, unknown> = {
    status,
    reviewed_at: new Date(),
  };
  if (operatorNotes !== undefined) update.operator_notes = operatorNotes;
  if (reviewedBy !== undefined) update.reviewed_by = reviewedBy;

  const result = await collection.updateOne(
    { _id: new ObjectId(suggestionId) },
    { $set: update }
  );
  return result.modifiedCount > 0;
}

// ========== DAILY AGGREGATES ==========

/**
 * Save daily aggregate (T053)
 */
export async function saveDailyAggregate(aggregate: DailyAggregate): Promise<DailyAggregate> {
  const collection = getDailyAggregatesCollection();

  // Upsert by date
  await collection.updateOne(
    { date: aggregate.date },
    { $set: aggregate },
    { upsert: true }
  );

  return aggregate;
}

/**
 * Get daily aggregates for a date range
 */
export async function getDailyAggregates(
  startDate: Date,
  endDate: Date
): Promise<DailyAggregate[]> {
  const collection = getDailyAggregatesCollection();
  const aggregates = await collection
    .find({
      date: { $gte: startDate, $lte: endDate },
    })
    .sort({ date: 1 })
    .toArray();
  return toTypedDocs<DailyAggregate>(aggregates);
}

// ========== INDEXES ==========

/**
 * Create indexes for quality scoring collections
 * Should be called during application startup
 */
export async function createIndexes(): Promise<void> {
  const db = getDB();

  // Quality scores indexes (T011)
  await db.collection(COLLECTIONS.QUALITY_SCORES).createIndexes([
    { key: { job_id: 1 }, unique: true },
    { key: { tool_slug: 1 } },
    { key: { created_at: -1 } },
    { key: { overall_score: -1 } },
    { key: { passed: 1 } },
  ]);

  // Quality patterns indexes (T013)
  await db.collection(COLLECTIONS.QUALITY_PATTERNS).createIndexes([
    { key: { criterion_id: 1 } },
    { key: { status: 1 } },
    { key: { created_at: -1 } },
  ]);

  // Suggestions indexes (T014)
  await db.collection(COLLECTIONS.SUGGESTIONS).createIndexes([
    { key: { status: 1 } },
    { key: { criterion_id: 1 } },
    { key: { created_at: -1 } },
  ]);

  // Daily aggregates indexes (T017)
  await db.collection(COLLECTIONS.DAILY_AGGREGATES).createIndexes([
    { key: { date: 1 }, unique: true },
  ]);

  console.log('[QualityStore] Indexes created');
}
