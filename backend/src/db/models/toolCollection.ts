/**
 * Unified Tool Collection Model
 * Feature: 021-unified-tool-collection
 *
 * Each deployed tool has ONE collection named `tool_{slug}` containing:
 * - One defaults document (type: "defaults") with tool configuration
 * - Multiple response documents (type: "response") with user submissions
 *
 * This replaces the separate deployed_tools and tool_{slug}_responses pattern.
 */

import { ObjectId } from 'mongodb';

// ========== DISCRIMINATOR ==========

/**
 * Document type discriminator values
 */
export const TOOL_DOC_TYPES = {
  DEFAULTS: 'defaults',
  RESPONSE: 'response'
} as const;

export type ToolDocType = typeof TOOL_DOC_TYPES[keyof typeof TOOL_DOC_TYPES];

// ========== TOOL DEFAULTS ==========

/**
 * Question definition for tool input fields
 */
export interface Question {
  fieldId: string;           // Unique field identifier (e.g., "value.proposition.statement")
  prompt: string;            // Question text shown to user
  helpText?: string;         // Additional guidance
  inputType?: string;        // "text" | "number" | "select" | "textarea"
  required?: boolean;        // Default: true
}

/**
 * Course terminology definition
 */
export interface TermDefinition {
  term: string;
  definition: string;
}

/**
 * Course framework reference
 */
export interface Framework {
  name: string;
  description: string;
}

/**
 * Expert quote from course material
 */
export interface ExpertQuote {
  quote: string;
  source: string;
}

/**
 * Input range for contextual feedback
 */
export interface InputRange {
  fieldId: string;
  fieldLabel: string;
  inferredMin?: number;
  inferredMax?: number;
  recommendedValue?: number;
  sourceQuote?: string;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Course context for AI-powered tool intelligence
 */
export interface CourseContext {
  terminology?: TermDefinition[];
  frameworks?: Framework[];
  expertQuotes?: ExpertQuote[];
  inputRanges?: InputRange[];
}

/**
 * Quality gate configuration
 */
export interface QualityGate {
  enabled: boolean;          // Default: false
  minimumScore: number;      // 0-100, threshold for passing
}

/**
 * Tool defaults document - configuration for the tool
 * Exactly one per collection
 */
export interface ToolDefaults {
  _id?: ObjectId;

  // Discriminator
  type: 'defaults';

  // Identity
  tool_id: string;           // UUID, unique across all tools
  tool_slug: string;         // URL-safe identifier (matches collection suffix)
  tool_name: string;         // Human-readable name

  // Deployment
  github_url: string;        // GitHub Pages URL for the tool
  created_at: Date;          // When deployed
  updated_at: Date;          // Last modification

  // Tool Definition
  sprint_id?: string;        // Course sprint reference (e.g., "spr-17-value-prop")
  instructions?: string;     // Tool instructions text
  questions: Question[];     // Input field definitions
  inputs: string[];          // Expected input field IDs
  outputs: string[];         // Output field IDs

  // Tool Intelligence (018)
  courseContext?: CourseContext;
  qualityGate?: QualityGate;
}

// ========== TOOL RESPONSE ==========

/**
 * Response status values
 */
export type ResponseStatus = 'completed' | 'draft' | 'abandoned';

/**
 * Analysis reference for tool response
 */
export interface AnalysisReference {
  _id: ObjectId;             // Reference to tool_analyses collection
  status: 'completed' | 'failed' | 'unavailable';
  generatedAt: Date;
}

/**
 * Tool response document - user submission
 * Zero or more per collection
 */
export interface ToolResponse {
  _id?: ObjectId;

  // Discriminator
  type: 'response';

  // Identity
  response_id: string;       // UUID, unique within collection
  tool_id: string;           // Reference to tool (matches defaults.tool_id)
  tool_slug: string;         // Denormalized for convenience

  // User
  user_id: string;           // LearnWorlds user ID or visitor ID
  user_email?: string;       // Optional, for identified users

  // Submission
  answers: Record<string, unknown>;  // Field values keyed by fieldId
  score: number;             // Calculated score (0-100)
  verdict: string;           // "GO" | "NO-GO" | "CONDITIONAL"
  status: ResponseStatus;    // Submission status
  commitment?: string;       // User's commitment text

  // Metadata
  session_id?: string;       // Browser session identifier
  source?: string;           // "learnworlds" | "direct" | "embed"
  completed_at: Date;        // When submitted

  // Tool Intelligence (018)
  analysis?: AnalysisReference;
}

// ========== UNION TYPE ==========

/**
 * Union type for any document in a tool collection
 */
export type ToolCollectionDocument = ToolDefaults | ToolResponse;

// ========== TYPE GUARDS ==========

/**
 * Check if document is a defaults document
 */
export function isDefaults(doc: ToolCollectionDocument): doc is ToolDefaults {
  return doc.type === TOOL_DOC_TYPES.DEFAULTS;
}

/**
 * Check if document is a response document
 */
export function isResponse(doc: ToolCollectionDocument): doc is ToolResponse {
  return doc.type === TOOL_DOC_TYPES.RESPONSE;
}

// ========== INPUT TYPES ==========

/**
 * Input for creating a defaults document
 */
export interface CreateDefaultsInput {
  tool_id: string;
  tool_slug: string;
  tool_name: string;
  github_url: string;
  sprint_id?: string;
  instructions?: string;
  questions?: Question[];
  inputs?: string[];
  outputs?: string[];
  courseContext?: CourseContext;
  qualityGate?: QualityGate;
}

/**
 * Input for creating a response document
 */
export interface CreateResponseInput {
  tool_id: string;
  tool_slug: string;
  user_id: string;
  user_email?: string;
  answers: Record<string, unknown>;
  score: number;
  verdict: string;
  status?: ResponseStatus;
  commitment?: string;
  session_id?: string;
  source?: string;
}

// ========== FACTORY FUNCTIONS ==========

/**
 * Create a defaults document
 */
export function createDefaultsDocument(input: CreateDefaultsInput): Omit<ToolDefaults, '_id'> {
  const now = new Date();
  return {
    type: 'defaults',
    tool_id: input.tool_id,
    tool_slug: input.tool_slug,
    tool_name: input.tool_name,
    github_url: input.github_url,
    created_at: now,
    updated_at: now,
    sprint_id: input.sprint_id,
    instructions: input.instructions,
    questions: input.questions || [],
    inputs: input.inputs || [],
    outputs: input.outputs || [],
    courseContext: input.courseContext,
    qualityGate: input.qualityGate || { enabled: false, minimumScore: 0 }
  };
}

/**
 * Create a response document
 */
export function createResponseDocument(
  responseId: string,
  input: CreateResponseInput
): Omit<ToolResponse, '_id'> {
  return {
    type: 'response',
    response_id: responseId,
    tool_id: input.tool_id,
    tool_slug: input.tool_slug,
    user_id: input.user_id,
    user_email: input.user_email,
    answers: input.answers,
    score: input.score,
    verdict: input.verdict,
    status: input.status || 'completed',
    commitment: input.commitment,
    session_id: input.session_id,
    source: input.source,
    completed_at: new Date()
  };
}

// ========== API RESPONSE TYPES ==========

/**
 * Defaults document API response
 */
export interface ToolDefaultsResponse {
  tool_id: string;
  tool_slug: string;
  tool_name: string;
  github_url: string;
  created_at: string;
  updated_at: string;
  sprint_id?: string;
  instructions?: string;
  questions: Question[];
  inputs: string[];
  outputs: string[];
  courseContext?: CourseContext;
  qualityGate?: QualityGate;
}

/**
 * Response document API response
 */
export interface ToolResponseApiResponse {
  response_id: string;
  tool_id: string;
  tool_slug: string;
  user_id: string;
  user_email?: string;
  answers: Record<string, unknown>;
  score: number;
  verdict: string;
  status: ResponseStatus;
  commitment?: string;
  completed_at: string;
}

/**
 * Convert defaults to API response
 */
export function defaultsToResponse(defaults: ToolDefaults): ToolDefaultsResponse {
  return {
    tool_id: defaults.tool_id,
    tool_slug: defaults.tool_slug,
    tool_name: defaults.tool_name,
    github_url: defaults.github_url,
    created_at: defaults.created_at.toISOString(),
    updated_at: defaults.updated_at.toISOString(),
    sprint_id: defaults.sprint_id,
    instructions: defaults.instructions,
    questions: defaults.questions,
    inputs: defaults.inputs,
    outputs: defaults.outputs,
    courseContext: defaults.courseContext,
    qualityGate: defaults.qualityGate
  };
}

/**
 * Convert response to API response
 */
export function responseToApiResponse(response: ToolResponse): ToolResponseApiResponse {
  return {
    response_id: response.response_id,
    tool_id: response.tool_id,
    tool_slug: response.tool_slug,
    user_id: response.user_id,
    user_email: response.user_email,
    answers: response.answers,
    score: response.score,
    verdict: response.verdict,
    status: response.status,
    commitment: response.commitment,
    completed_at: response.completed_at.toISOString()
  };
}
