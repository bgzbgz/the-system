/**
 * System Prompts - TypeScript Type Definitions
 * Spec: 020-system-prompts
 * Per data-model.md and contracts/prompts.yaml
 */

// ========== INPUT TYPES ==========

/**
 * Input field type for tool forms
 */
export type InputType = 'text' | 'number' | 'select' | 'textarea';

/**
 * Output display type for tool results
 */
export type OutputType = 'text' | 'list' | 'table' | 'download';

/**
 * A single input field for a tool
 */
export interface ToolInput {
  /** Field identifier (camelCase) */
  name: string;
  /** Input field type */
  type: InputType;
  /** User-facing label */
  label: string;
  /** Whether field is mandatory */
  required: boolean;
  /** Options for select type */
  options?: string[];
}

// ========== SECRETARY TYPES ==========

/**
 * Structured tool specification extracted by Secretary agent
 */
export interface ToolSpec {
  /** Human-readable tool name */
  name: string;
  /** One-sentence description */
  purpose: string;
  /** Form fields for the tool */
  inputs: ToolInput[];
  /** How results are displayed */
  outputType: OutputType;
  /** What happens between input and output */
  processingLogic: string;
  /** Optional course context from CourseProcessor (for enhanced tool building) */
  _courseContext?: {
    moduleTitle: string;
    learningObjective: string;
    framework?: {
      name: string;
      steps: string[];
      inputs: string[];
      outputs: string[];
    };
    formulas?: Array<{
      name: string;
      formula: string;
      variables: Array<{ name: string; description: string; unit: string }>;
      interpretation: string;
    }>;
    decisionCriteria?: {
      goCondition: string;
      noGoCondition: string;
      thresholds: string[];
    };
    courseAlignment?: {
      moduleObjective: string;
      toolDelivery: string;
      knowledgeReinforcement: string;
    };
  };
}

/**
 * Returned when Secretary needs more information
 */
export interface ClarificationRequest {
  /** Type discriminator - always true */
  needsClarification: true;
  /** Specific questions to ask */
  questions: string[];
  /** Whatever was extractable from the request */
  partialSpec: Partial<ToolSpec>;
}

/**
 * Union type for Secretary output
 */
export type SecretaryResponse = ToolSpec | ClarificationRequest;

/**
 * Type guard for ClarificationRequest
 */
export function isClarificationRequest(
  response: SecretaryResponse
): response is ClarificationRequest {
  return 'needsClarification' in response && response.needsClarification === true;
}

// ========== TEMPLATE TYPES ==========

/**
 * Available tool template patterns
 */
export type TemplateType =
  | 'CALCULATOR'
  | 'GENERATOR'
  | 'ANALYZER'
  | 'CONVERTER'
  | 'CHECKER';

/**
 * Output from Template Decider agent
 */
export interface TemplateDecision {
  /** Which template to use */
  template: TemplateType;
  /** Why this template fits */
  reasoning: string;
  /** Modifications needed for this specific tool */
  adaptations: string[];
}

// ========== QA TYPES ==========

/**
 * Result for a single QA criterion
 */
export interface QACriterion {
  /** Whether criterion passed */
  passed: boolean;
  /** "OK" or specific issue */
  feedback: string;
}

/**
 * All 8 QA criteria results
 */
export interface QACriteria {
  clarity: QACriterion;
  consistency: QACriterion;
  actionability: QACriterion;
  simplicity: QACriterion;
  completeness: QACriterion;
  usability: QACriterion;
  correctness: QACriterion;
  polish: QACriterion;
}

/**
 * Output from QA Department agent
 */
export interface QAResult {
  /** true only if 8/8 criteria pass */
  passed: boolean;
  /** Score 0-8 */
  score: number;
  /** Individual criterion results */
  criteria: QACriteria;
  /** One-sentence overall assessment */
  summary: string;
  /** Critical issues that must be fixed (empty if passed) */
  mustFix: string[];
}

// ========== AGENT TYPES ==========

/**
 * Agent identifiers
 */
export type AgentName =
  | 'secretary'
  | 'toolBuilder'
  | 'templateDecider'
  | 'qaDepartment'
  | 'feedbackApplier'
  | 'courseAnalyst'
  | 'knowledgeArchitect'
  | 'contentSummarizer'
  // New pre-submission agents
  | 'contextInterviewer'
  | 'audienceProfiler'
  | 'exampleGenerator'
  // New quality enhancement agents
  | 'copyWriter'
  | 'brandGuardian'
  | 'edgeCaseTester';

/**
 * Metadata wrapper for each agent's prompt
 */
export interface AgentPrompt {
  /** Agent identifier */
  name: AgentName;
  /** The full system prompt text */
  systemPrompt: string;
  /** Human-readable description of agent's purpose */
  description: string;
  /** Optional template for user prompts with {{variables}} */
  userPromptTemplate?: string;
  /** Expected output format */
  outputFormat?: 'json' | 'html' | 'text';
}

// ========== CONTEXT TYPES ==========

/**
 * Available context document names
 */
export type ContextName = 'approach' | 'criteria' | 'feedback';
