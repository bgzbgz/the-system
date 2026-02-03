/**
 * Tool Intelligence Service - Entry Point
 * Feature: 018-tool-intelligence
 *
 * AI-powered analysis layer for generated tools that transforms
 * static GO/NO-GO verdicts into personalized coaching experiences.
 */

// Export types
export * from './types';

// Export analyzer (main analysis logic)
export { analyzeSubmission } from './analyzer';

// Export quality scorer
export { calculateQualityScore, calculateNormalizedVariance } from './qualityScorer';

// Export rate limiter
export { checkAnalysisRateLimit, getRateLimitRetryAfter } from './rateLimiter';

// Export storage
export { storeAnalysis, getAnalysisByResponseId } from './storage';

// Export parser
export { parseAnalysisResponse, validateAnalysisResponse } from './parser';

// Export range inference
export { inferInputRanges, generateInputFeedback } from './rangeInference';

// Export LearnWorlds integration helpers
export {
  passesQualityGate,
  getCompletionMessage,
  buildCompletionData,
  getQualityGateSummary
} from './learnworldsIntegration';
