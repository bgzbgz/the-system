/**
 * Quality Scoring Service
 * Feature: 020-self-improving-factory
 *
 * Orchestrates the 8-point quality assessment for generated tools.
 */

import { createHash } from 'crypto';
import {
  QualityScore,
  ScoreToolRequest,
  CriterionScore,
} from './types';

// Criterion checkers
import { checkDecision } from './criteriaChecks/decisionCheck';
import { checkZeroQuestions } from './criteriaChecks/zeroQuestionsCheck';
import { checkEasySteps } from './criteriaChecks/easyStepsCheck';
import { checkFeedback } from './criteriaChecks/feedbackCheck';
import { checkGamification } from './criteriaChecks/gamificationCheck';
import { checkResults } from './criteriaChecks/resultsCheck';
import { checkCommitment } from './criteriaChecks/commitmentCheck';
import { checkBrand } from './criteriaChecks/brandCheck';

/**
 * Get prompt versions used for a specific job (T027)
 *
 * TODO: Implement full version tracking when prompt versioning is active
 * Currently returns empty map as prompts aren't versioned yet
 */
export async function getPromptVersionsForJob(jobId: string): Promise<Record<string, string>> {
  // TODO: Look up job to find which prompt versions were used
  // For now, return empty - prompt versioning (US5) will populate this
  return {};
}

/**
 * Score a tool against the 8-point quality criteria (T026)
 *
 * Runs all 8 criterion checks in parallel and aggregates results.
 * Per research.md: Uses equal weighted average (12.5% per criterion).
 */
export async function scoreTool(request: ScoreToolRequest): Promise<QualityScore> {
  const startTime = Date.now();
  const html = request.html_content;

  // Run all 8 criterion checks in parallel
  const criteria: CriterionScore[] = await Promise.all([
    checkDecision(html),
    checkZeroQuestions(html),
    checkEasySteps(html),
    checkFeedback(html),
    checkGamification(html),
    checkResults(html),
    checkCommitment(html),
    checkBrand(html),
  ]);

  // Calculate overall score (equal weighted)
  const totalScore = criteria.reduce((sum, c) => sum + c.score, 0);
  const overallScore = (totalScore / 8) * 100;
  const passed = criteria.every(c => c.passed);

  return {
    job_id: request.job_id,
    tool_slug: request.tool_slug,
    html_hash: createHash('sha256').update(html).digest('hex'),
    overall_score: Math.round(overallScore * 10) / 10,
    passed,
    criteria,
    prompt_versions: await getPromptVersionsForJob(request.job_id),
    scoring_duration_ms: Date.now() - startTime,
    created_at: new Date(),
  };
}

export * from './types';
