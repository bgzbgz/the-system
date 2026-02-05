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
  /** Form fields for the tool (used in single-step mode) */
  inputs: ToolInput[];
  /** How results are displayed */
  outputType: OutputType;
  /** What happens between input and output */
  processingLogic: string;
  /** Multi-phase support (019-multistep-wizard-tools) */
  phases?: Phase[];
  /** Default sequence of phase IDs */
  defaultPhasePath?: string[];
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
    /** Deep content for richer, course-connected tools */
    deepContent?: {
      keyTerminology: Array<{
        term: string;
        definition: string;
        howToUseInTool: string;
      }>;
      /** Numbered frameworks like "7 Levers", "5 Steps", etc. */
      numberedFramework?: {
        frameworkName: string;
        items: Array<{
          number: number;
          name: string;
          fullLabel: string;
          definition: string;
          toolInputLabel: string;
        }>;
      } | null;
      reflectionQuestions: Array<{
        question: string;
        section: string;
        toolInputOpportunity: string;
      }>;
      expertWisdom: Array<{
        quote: string;
        source: string;
        principle: string;
      }>;
      bookReferences: Array<{
        title: string;
        author: string;
        keyTakeaway: string;
      }>;
      sprintChecklist: Array<{
        item: string;
        validationType: string;
        toolValidation: string;
      }>;
      conceptsToLearn: string[];
      decisionsToMake: string[];
      processesToImplement: string[];
      capabilitiesToDevelop: string[];
      /** Input ranges for AI coaching feedback (018-tool-intelligence) */
      inputRanges?: Array<{
        fieldId: string;
        fieldLabel: string;
        inferredMin?: number;
        inferredMax?: number;
        recommendedValue?: number;
        sourceQuote?: string;
        confidence: 'high' | 'medium' | 'low';
      }>;
    };
  };
  /** Fix instructions from output validation retry (internal use only) */
  _outputFixInstructions?: string;
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
  | 'edgeCaseTester'
  // Tool Intelligence (018-tool-intelligence)
  | 'toolAnalysis';

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

// ========== MULTI-STEP WIZARD TYPES (019-multistep-wizard-tools) ==========

/**
 * Operators for branch condition evaluation
 */
export type BranchOperator =
  | 'equals'
  | 'not_equals'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'contains'
  | 'not_contains';

/**
 * Action to take when branch condition matches
 */
export type BranchAction = 'show' | 'hide';

/**
 * A rule that evaluates input values to determine phase/input visibility
 */
export interface BranchCondition {
  /** Input field ID to evaluate */
  sourceField: string;
  /** Comparison operator */
  operator: BranchOperator;
  /** Value to compare against */
  targetValue: string | number;
  /** What to do when condition matches */
  action: BranchAction;
  /** Phase ID to show/hide (mutually exclusive with targetInput) */
  targetPhase?: string;
  /** Input ID to show/hide (mutually exclusive with targetPhase) */
  targetInput?: string;
}

/**
 * A distinct step in the decision journey
 */
export interface Phase {
  /** Unique identifier (e.g., "context", "data-analysis") */
  id: string;
  /** Display name (e.g., "Your Situation") */
  name: string;
  /** Brief explanation of phase purpose */
  description: string;
  /** Sequence position (1-based) */
  order: number;
  /** Input fields for this phase (empty for info-only phases) */
  inputs: ToolInput[];
  /** Template with {{fieldName}} placeholders for summary generation */
  summaryTemplate: string;
  /** Tag to match expertWisdom for this phase's teaching moment */
  teachingMomentTag?: string;
  /** Conditions that affect subsequent phases */
  branchConditions?: BranchCondition[];
}

/**
 * Course content displayed between phases
 */
export interface TeachingMoment {
  /** Expert wisdom quote */
  quote: string;
  /** Attribution (person or book) */
  source: string;
  /** Underlying concept name */
  principle?: string;
  /** Which phase this is relevant to */
  phaseTag?: string;
}

/**
 * Session-level state tracking (persisted in sessionStorage)
 */
export interface WizardState {
  /** Tool identifier */
  toolSlug: string;
  /** Active phase ID */
  currentPhaseId: string;
  /** IDs of finished phases */
  completedPhases: string[];
  /** Inputs by phase ID -> field ID -> value */
  phaseInputs: Record<string, Record<string, unknown>>;
  /** Branch conditions currently active */
  activeBranches: string[];
  /** Timestamp (epoch ms) when wizard started */
  startedAt: number;
  /** Timestamp (epoch ms) of last update */
  lastUpdatedAt: number;
}

/**
 * Finding from analysis
 */
export interface KeyFinding {
  /** Finding label */
  label: string;
  /** Finding value */
  value: string;
  /** Sentiment indicator */
  sentiment: 'positive' | 'warning' | 'critical';
  /** Which phase this came from */
  phaseSource: string;
}

/**
 * Calculation display structure
 */
export interface CalculationDisplay {
  /** Formula used */
  formula: string;
  /** Variable values */
  variables: Record<string, number>;
  /** Final result */
  result: number;
  /** Result interpretation */
  interpretation: string;
}

/**
 * Analysis section of results
 */
export interface AnalysisSection {
  /** Framework name used */
  methodology: string;
  /** Important observations */
  keyFindings: KeyFinding[];
  /** Formula and values if applicable */
  calculation?: CalculationDisplay;
}

/**
 * Verdict types
 */
export type VerdictType = 'GO' | 'NO-GO' | 'CONDITIONAL';

/**
 * The decision output (maintains Constitution Principle II)
 */
export interface VerdictSection {
  /** Primary decision */
  verdict: VerdictType;
  /** Numeric score (0-100) if applicable */
  score?: number;
  /** One-line verdict summary */
  headline: string;
  /** Why this verdict (2-3 sentences) */
  reasoning: string;
  /** For CONDITIONAL verdict, what must change */
  conditions?: string[];
}

/**
 * WWW commitment structure
 */
export interface ActionPlanSection {
  /** Person responsible */
  who?: string;
  /** Specific action */
  what: string;
  /** Deadline */
  when?: string;
  /** First 3 things to do now */
  immediateActions: string[];
  /** Who to share commitment with */
  accountabilityPartner?: string;
}

/**
 * Link to relevant course module
 */
export interface CourseResource {
  /** Course module title */
  moduleName: string;
  /** LearnWorlds URL */
  moduleUrl?: string;
  /** Why this module matters for the user */
  relevance: string;
}

/**
 * Multi-section output structure for wizard results
 */
export interface RichResult {
  /** Synthesized from all phase inputs */
  situationSummary: string;
  /** Methodology application details */
  analysisSection: AnalysisSection;
  /** GO/NO-GO decision */
  verdictSection: VerdictSection;
  /** Commitments and next steps */
  actionPlanSection: ActionPlanSection;
  /** Relevant module links */
  courseResourcesSection: CourseResource[];
}

// ========== WIZARD CONSTANTS ==========

/** Minimum phases required for multi-step tool */
export const MIN_PHASES = 3;

/** Maximum phases allowed */
export const MAX_PHASES = 5;

/** Maximum inputs per phase */
export const MAX_INPUTS_PER_PHASE = 6;

/** Session timeout in milliseconds (30 minutes) */
export const WIZARD_SESSION_TIMEOUT_MS = 30 * 60 * 1000;

/** Storage key prefix for wizard state */
export const WIZARD_STATE_KEY_PREFIX = 'wizard_state_';

// ========== WIZARD TYPE GUARDS ==========

/**
 * Check if a ToolSpec has multi-phase configuration
 */
export function isMultiPhaseSpec(spec: ToolSpec): boolean {
  return spec.phases !== undefined && Array.isArray(spec.phases) && spec.phases.length > 0;
}
