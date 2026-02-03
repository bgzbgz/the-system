/**
 * Tool Intelligence Service - Type Definitions
 * Feature: 018-tool-intelligence
 *
 * Types for AI-powered analysis of tool submissions.
 */

import { ObjectId } from 'mongodb';

// ========== ENUMS ==========

/**
 * Analysis completion status
 */
export type AnalysisStatus = 'completed' | 'failed' | 'unavailable';

/**
 * Sentiment type for insights
 */
export type SentimentType = 'positive' | 'warning' | 'critical';

/**
 * Feedback type for input validation
 */
export type FeedbackType = 'good' | 'warning' | 'critical';

/**
 * Confidence level for inferred ranges
 */
export type ConfidenceLevel = 'high' | 'medium' | 'low';

// ========== EMBEDDED TYPES ==========

/**
 * AI call token metrics
 */
export interface TokenUsage {
  /** Tokens in prompt */
  inputTokens: number;
  /** Tokens in response */
  outputTokens: number;
  /** Combined total */
  totalTokens: number;
}

/**
 * A single AI-generated observation
 */
export interface Insight {
  /** Insight content (max 200 chars) */
  text: string;
  /** Referenced course term/framework */
  courseReference: string | null;
  /** Sentiment classification */
  sentiment: SentimentType;
  /** Field IDs this insight relates to */
  inputsInvolved: string[];
}

/**
 * An improvement suggestion
 */
export interface Recommendation {
  /** Field ID to improve */
  targetInput: string;
  /** Human-readable field name */
  inputLabel: string;
  /** User's submitted value */
  currentValue: string;
  /** Course-recommended range/value */
  recommendedRange: string;
  /** Module/lesson reference */
  courseModule: string | null;
  /** LearnWorlds deep link (if available) */
  courseModuleUrl: string | null;
  /** 1-10, higher = more impactful */
  impactScore: number;
}

/**
 * Engagement metrics for a submission
 */
export interface QualityScore {
  /** 0-100, % of fields filled */
  completeness: number;
  /** 0-100, % of values in expected ranges */
  realism: number;
  /** 0-100, normalized input variance */
  variance: number;
  /** 0-100, weighted composite score */
  overall: number;
  /** Whether submission meets tool's minimum */
  passedThreshold: boolean;
  /** Configured minimum (0 = disabled) */
  thresholdValue: number;
}

/**
 * Range metadata for contextual feedback (stored with tool, not response)
 */
export interface InputRange {
  /** Input field identifier */
  fieldId: string;
  /** Human-readable field name */
  fieldLabel: string;
  /** Lower bound of recommended range */
  inferredMin?: number;
  /** Upper bound of recommended range */
  inferredMax?: number;
  /** Ideal value if point estimate */
  recommendedValue?: number;
  /** Course text that informed this range */
  sourceQuote?: string;
  /** Confidence in the inference */
  confidence: ConfidenceLevel;
}

/**
 * Real-time feedback for a single input (transient, not persisted)
 */
export interface InputFeedback {
  /** Input field identifier */
  fieldId: string;
  /** What the user entered */
  userValue: string | number;
  /** Course guideline text */
  recommendedRange: string | null;
  /** Contextual feedback text */
  feedbackMessage: string;
  /** Feedback classification */
  feedbackType: FeedbackType;
}

// ========== MAIN ENTITY ==========

/**
 * AI-generated analysis attached to a tool response
 */
export interface ToolAnalysis {
  /** MongoDB document ID */
  _id?: ObjectId;
  /** Reference to parent tool response */
  responseId: ObjectId;
  /** Tool identifier */
  toolSlug: string;
  /** LearnWorlds user ID (if authenticated) */
  userId?: string;
  /** Array of 3-5 AI-generated insights */
  insights: Insight[];
  /** Array of 0-3 improvement recommendations */
  recommendations: Recommendation[];
  /** Why the tool gave this verdict (max 300 chars) */
  verdictExplanation: string;
  /** Engagement metrics for this submission */
  qualityScore: QualityScore;
  /** List of course terms/frameworks referenced */
  courseReferences: string[];
  /** Timestamp of analysis generation */
  generatedAt: Date;
  /** How long the AI call took */
  generationDurationMs: number;
  /** Input/output token counts */
  tokenUsage: TokenUsage;
  /** Completion status */
  status: AnalysisStatus;
  /** Error details if status is 'failed' */
  errorMessage?: string;
}

// ========== INPUT TYPES ==========

/**
 * Input for creating an analysis
 */
export interface CreateAnalysisInput {
  /** Tool response ID to analyze */
  responseId: string;
  /** Tool identifier */
  toolSlug: string;
  /** User's input values */
  inputs: Record<string, string | number | boolean>;
  /** The calculated verdict from the tool */
  verdict: string;
  /** The calculated score (if applicable) */
  score?: number;
  /** LearnWorlds user ID (if authenticated) */
  userId?: string;
}

/**
 * Course context for AI analysis
 */
export interface CourseContext {
  /** Course terminology */
  terminology: Array<{
    term: string;
    definition: string;
  }>;
  /** Course frameworks */
  frameworks: Array<{
    name: string;
    description: string;
  }>;
  /** Expert quotes from course */
  expertQuotes: Array<{
    quote: string;
    source: string;
  }>;
  /** Input ranges for this tool */
  inputRanges: InputRange[];
}

/**
 * Quality gate configuration for a tool
 */
export interface QualityGate {
  /** Enable/disable quality gate */
  enabled: boolean;
  /** Minimum score required (0-100) */
  minimumScore: number;
}

// ========== RESPONSE TYPES ==========

/**
 * Successful analysis response
 */
export interface AnalysisResponse {
  success: true;
  analysis: {
    id: string;
    insights: Insight[];
    recommendations: Recommendation[];
    verdictExplanation: string;
    qualityScore: QualityScore;
    courseReferences: string[];
    generatedAt: string;
  };
}

/**
 * Analysis unavailable response
 */
export interface AnalysisUnavailableResponse {
  success: false;
  status: 'unavailable' | 'rate_limited';
  message: string;
  /** Seconds until retry allowed */
  retryAfter?: number;
}

/**
 * Input validation response
 */
export interface ValidateInputResponse {
  success: true;
  /** null if no range defined */
  feedback: InputFeedback | null;
}

// ========== ERROR TYPES ==========

/**
 * Error codes for tool intelligence operations
 */
export type ErrorCode =
  | 'RESPONSE_NOT_FOUND'
  | 'TOOL_NOT_FOUND'
  | 'RATE_LIMITED'
  | 'AI_UNAVAILABLE'
  | 'INVALID_INPUT'
  | 'UNAUTHORIZED';

/**
 * Error response structure
 */
export interface ErrorResponse {
  success: false;
  error: string;
  code?: ErrorCode;
}
