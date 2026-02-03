/**
 * Daily Aggregator
 * Feature: 020-self-improving-factory
 *
 * Pre-computes daily statistics for dashboard performance.
 */

import {
  DailyAggregate,
  CriterionId,
  PromptName,
} from '../qualityScoring/types';
import * as qualityStore from '../../db/services/qualityStore';

const ALL_CRITERIA: CriterionId[] = [
  'decision', 'zero_questions', 'easy_steps', 'feedback',
  'gamification', 'results', 'commitment', 'brand'
];

/**
 * Generate daily aggregate for a specific date (T052)
 *
 * @param date - Date to aggregate (uses midnight UTC)
 * @returns Daily aggregate
 */
export async function generateDailyAggregate(date: Date): Promise<DailyAggregate> {
  // Set to midnight UTC for consistent day boundaries
  const dayStart = new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    0, 0, 0, 0
  ));
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000 - 1);

  // Get all scores for this day
  const scores = await qualityStore.getScoresInWindow(dayStart, dayEnd);

  const totalTools = scores.length;
  const passCount = scores.filter(s => s.passed).length;
  const failCount = totalTools - passCount;
  const averageScore = totalTools > 0
    ? scores.reduce((sum, s) => sum + s.overall_score, 0) / totalTools
    : 0;

  // Calculate pass rates per criterion
  const criterionPassRates = {} as Record<CriterionId, number>;
  for (const criterionId of ALL_CRITERIA) {
    const passedCount = scores.filter(s =>
      s.criteria.find(c => c.criterion_id === criterionId)?.passed
    ).length;
    criterionPassRates[criterionId] = totalTools > 0
      ? Math.round((passedCount / totalTools) * 100)
      : 0;
  }

  // Calculate prompt versions used
  const promptVersionsUsed = {} as Record<PromptName, Record<number, number>>;
  for (const score of scores) {
    for (const [promptName, versionStr] of Object.entries(score.prompt_versions)) {
      const version = parseInt(versionStr) || 1;
      if (!promptVersionsUsed[promptName as PromptName]) {
        promptVersionsUsed[promptName as PromptName] = {};
      }
      promptVersionsUsed[promptName as PromptName][version] =
        (promptVersionsUsed[promptName as PromptName][version] || 0) + 1;
    }
  }

  // Calculate score distribution
  const scoreDistribution = {
    bucket_0_25: 0,
    bucket_26_50: 0,
    bucket_51_75: 0,
    bucket_76_100: 0,
  };
  for (const score of scores) {
    if (score.overall_score <= 25) {
      scoreDistribution.bucket_0_25++;
    } else if (score.overall_score <= 50) {
      scoreDistribution.bucket_26_50++;
    } else if (score.overall_score <= 75) {
      scoreDistribution.bucket_51_75++;
    } else {
      scoreDistribution.bucket_76_100++;
    }
  }

  return {
    date: dayStart,
    total_tools: totalTools,
    average_score: Math.round(averageScore * 10) / 10,
    pass_count: passCount,
    fail_count: failCount,
    criterion_pass_rates: criterionPassRates,
    prompt_versions_used: promptVersionsUsed,
    score_distribution: scoreDistribution,
  };
}

/**
 * Run daily aggregation for today (or specified date)
 * Saves aggregate to database
 */
export async function runDailyAggregation(date?: Date): Promise<DailyAggregate> {
  const targetDate = date || new Date();
  const aggregate = await generateDailyAggregate(targetDate);

  // Save to database (upserts by date)
  await qualityStore.saveDailyAggregate(aggregate);

  console.log(`[Aggregator] Daily aggregate saved for ${aggregate.date.toISOString().split('T')[0]}: ${aggregate.total_tools} tools, ${aggregate.average_score} avg score`);

  return aggregate;
}

/**
 * Backfill daily aggregates for a date range
 * Useful for populating historical data
 */
export async function backfillAggregates(
  startDate: Date,
  endDate: Date
): Promise<DailyAggregate[]> {
  const aggregates: DailyAggregate[] = [];
  const current = new Date(startDate);

  while (current <= endDate) {
    const aggregate = await runDailyAggregation(current);
    aggregates.push(aggregate);
    current.setDate(current.getDate() + 1);
  }

  console.log(`[Aggregator] Backfilled ${aggregates.length} daily aggregates`);
  return aggregates;
}
