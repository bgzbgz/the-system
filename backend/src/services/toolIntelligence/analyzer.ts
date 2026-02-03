/**
 * Tool Intelligence Service - Analyzer
 * Feature: 018-tool-intelligence
 *
 * Main AI analysis logic for tool submissions.
 * Generates personalized, course-aware insights and recommendations.
 */

import { ObjectId } from 'mongodb';
import { aiService } from '../ai';
import { createLog, generateSummary } from '../logStore';
import { buildAnalysisSystemPrompt, buildAnalysisUserPrompt } from '../../prompts/toolAnalysis';
import { parseAnalysisResponse, validateAnalysisResponse } from './parser';
import { calculateQualityScore } from './qualityScorer';
import { storeAnalysis } from './storage';
import {
  ToolAnalysis,
  CourseContext,
  CreateAnalysisInput,
  Insight,
  Recommendation,
  QualityScore,
  TokenUsage
} from './types';

// ========== CONSTANTS ==========

/** Maximum tokens for AI analysis */
const MAX_ANALYSIS_TOKENS = 2000;

// ========== MAIN ANALYSIS FUNCTION ==========

/**
 * Analyze a tool submission and generate AI coaching feedback
 *
 * @param input - Analysis input data
 * @param courseContext - Course context for personalization
 * @param qualityThreshold - Quality gate threshold (0 = disabled)
 * @returns Complete analysis with insights, recommendations, and quality score
 */
export async function analyzeSubmission(
  input: CreateAnalysisInput,
  courseContext: CourseContext,
  qualityThreshold: number = 0
): Promise<ToolAnalysis> {
  const startTime = Date.now();

  // Calculate quality score first (doesn't require AI)
  const qualityScore = calculateQualityScore(
    input.inputs,
    courseContext.inputRanges,
    qualityThreshold
  );

  try {
    // Build prompts with course context
    const systemPrompt = buildAnalysisSystemPrompt({
      terminology: courseContext.terminology,
      frameworks: courseContext.frameworks,
      expertQuotes: courseContext.expertQuotes
    });

    const userPrompt = buildAnalysisUserPrompt({
      toolName: input.toolSlug,
      verdict: input.verdict,
      score: input.score || 0,
      inputs: input.inputs,
      ranges: courseContext.inputRanges.map(r => ({
        fieldId: r.fieldId,
        inferredMin: r.inferredMin,
        inferredMax: r.inferredMax,
        recommendedValue: r.recommendedValue
      }))
    });

    // Call AI service
    const response = await aiService.callClaude({
      systemPrompt,
      userPrompt,
      maxTokens: MAX_ANALYSIS_TOKENS
    });

    const generationDurationMs = Date.now() - startTime;

    // Parse and validate response
    const parsed = parseAnalysisResponse(response.content);

    if (!parsed) {
      // AI returned unparseable response
      return createFailedAnalysis(
        input,
        qualityScore,
        generationDurationMs,
        response.usage,
        'Failed to parse AI response'
      );
    }

    // Validate the parsed response
    const validation = validateAnalysisResponse(parsed);
    if (!validation.valid) {
      console.warn('[Analyzer] Validation warnings:', validation.warnings);
    }

    // Build token usage
    const tokenUsage: TokenUsage = {
      inputTokens: response.usage?.inputTokens || 0,
      outputTokens: response.usage?.outputTokens || 0,
      totalTokens: (response.usage?.inputTokens || 0) + (response.usage?.outputTokens || 0)
    };

    // Log to agent_logs for transparency (Principle X)
    logAnalysisCall(
      input.toolSlug,
      input.responseId,
      systemPrompt,
      userPrompt,
      response.content,
      tokenUsage,
      generationDurationMs
    );

    // Build analysis document
    const analysis: Omit<ToolAnalysis, '_id'> = {
      responseId: new ObjectId(input.responseId),
      toolSlug: input.toolSlug,
      userId: input.userId,
      insights: parsed.insights,
      recommendations: parsed.recommendations,
      verdictExplanation: parsed.verdictExplanation,
      qualityScore,
      courseReferences: parsed.courseReferences,
      generatedAt: new Date(),
      generationDurationMs,
      tokenUsage,
      status: 'completed'
    };

    // Store analysis
    const stored = await storeAnalysis(analysis);

    return stored;
  } catch (error) {
    const generationDurationMs = Date.now() - startTime;
    console.error('[Analyzer] Analysis failed:', error);

    return createFailedAnalysis(
      input,
      qualityScore,
      generationDurationMs,
      undefined,
      (error as Error).message
    );
  }
}

// ========== HELPER FUNCTIONS ==========

/**
 * Create a failed analysis document
 */
async function createFailedAnalysis(
  input: CreateAnalysisInput,
  qualityScore: QualityScore,
  generationDurationMs: number,
  usage?: { inputTokens?: number; outputTokens?: number },
  errorMessage?: string
): Promise<ToolAnalysis> {
  const tokenUsage: TokenUsage = {
    inputTokens: usage?.inputTokens || 0,
    outputTokens: usage?.outputTokens || 0,
    totalTokens: (usage?.inputTokens || 0) + (usage?.outputTokens || 0)
  };

  const analysis: Omit<ToolAnalysis, '_id'> = {
    responseId: new ObjectId(input.responseId),
    toolSlug: input.toolSlug,
    userId: input.userId,
    insights: createFallbackInsights(input.verdict),
    recommendations: [],
    verdictExplanation: 'Analysis could not be completed. Please try again later.',
    qualityScore,
    courseReferences: [],
    generatedAt: new Date(),
    generationDurationMs,
    tokenUsage,
    status: 'failed',
    errorMessage
  };

  // Still store the failed analysis for tracking
  return await storeAnalysis(analysis);
}

/**
 * Create fallback insights when AI analysis fails
 */
function createFallbackInsights(verdict: string): Insight[] {
  return [
    {
      text: `Your submission resulted in a ${verdict} verdict.`,
      courseReference: null,
      sentiment: verdict === 'GO' ? 'positive' : 'warning',
      inputsInvolved: []
    },
    {
      text: 'Review your inputs against the course recommendations for improvement.',
      courseReference: null,
      sentiment: 'warning',
      inputsInvolved: []
    },
    {
      text: 'Consider re-running this tool after adjusting your inputs.',
      courseReference: null,
      sentiment: 'warning',
      inputsInvolved: []
    }
  ];
}

/**
 * Log AI analysis call to agent_logs collection (Principle X)
 */
function logAnalysisCall(
  toolSlug: string,
  responseId: string,
  systemPrompt: string,
  userPrompt: string,
  response: string,
  tokenUsage: TokenUsage,
  durationMs: number
): void {
  // Fire and forget - don't await
  createLog({
    job_id: `analysis_${responseId}`,
    stage: 'unknown', // Using 'unknown' since 'analysis' isn't in AgentStage
    provider: 'claude',
    model: 'claude-sonnet-4-20250514',
    prompt: `${systemPrompt}\n\n---USER---\n\n${userPrompt}`,
    response,
    input_tokens: tokenUsage.inputTokens,
    output_tokens: tokenUsage.outputTokens,
    duration_ms: durationMs,
    summary: generateSummary(
      'unknown',
      'claude',
      response.length,
      { input: tokenUsage.inputTokens, output: tokenUsage.outputTokens }
    ),
    metadata: {
      toolSlug,
      responseId,
      feature: '018-tool-intelligence'
    }
  }).catch(err => console.error('[Analyzer] Failed to log analysis:', err));
}

export default {
  analyzeSubmission
};
