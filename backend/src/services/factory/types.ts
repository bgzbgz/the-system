/**
 * Tool Factory Engine - Types
 * Spec: 021-tool-factory-engine
 *
 * Pipeline types, interfaces, and stage input/output definitions.
 */

import {
  ToolSpec,
  ClarificationRequest,
  TemplateType,
  TemplateDecision,
  QAResult
} from '../../prompts/types';

// Re-export prompt types for convenience
export { ToolSpec, ClarificationRequest, TemplateType, TemplateDecision, QAResult };

// ========== CORE TYPES ==========

/**
 * Stage identifiers for the factory pipeline
 */
export type StageName =
  | 'secretary'
  | 'toolBuilder'
  | 'templateDecider'
  | 'qaDepartment'
  | 'feedbackApplier'
  // Pre-submission context stages
  | 'contextInterviewer'
  | 'audienceProfiler'
  | 'exampleGenerator'
  // Quality enhancement stages
  | 'copyWriter'
  | 'brandGuardian'
  | 'edgeCaseTester';

/**
 * Pipeline result status
 */
export type FactoryStatus = 'completed' | 'needs_clarification' | 'failed';

// ========== REQUEST/RESPONSE ==========

/**
 * Input to ToolFactory.processRequest()
 */
export interface FactoryRequest {
  /** Unique job identifier for tracking */
  jobId: string;
  /** Natural language description of the tool to build */
  userRequest: string;
  /** Optional override for template selection */
  templateHint?: TemplateType;
  /** If true, skip the template decider stage */
  skipTemplateDecider?: boolean;
}

/**
 * Output from ToolFactory.processRequest()
 */
export interface FactoryResult {
  /** Whether pipeline completed successfully with passing QA */
  success: boolean;
  /** Job identifier (echoed from request) */
  jobId: string;
  /** Pipeline result status */
  status: FactoryStatus;
  /** Extracted specification (present if Secretary succeeded) */
  toolSpec?: ToolSpec;
  /** Generated HTML tool (present if ToolBuilder succeeded) */
  toolHtml?: string;
  /** Final QA assessment (present if QA stage ran) */
  qaResult?: QAResult;
  /** Number of QA revision iterations attempted */
  revisionCount: number;
  /** Present when status is 'needs_clarification' */
  clarificationRequest?: {
    questions: string[];
  };
  /** Present when status is 'failed' */
  error?: {
    stage: StageName;
    message: string;
    details?: unknown;
  };
  /** Timing information */
  timing: {
    /** Total pipeline duration in milliseconds */
    total: number;
    /** Duration per stage in milliseconds */
    byStage: Partial<Record<StageName, number>>;
  };
}

// ========== PIPELINE CONTEXT ==========

/**
 * Mutable context passed through all stages
 */
export interface PipelineContext {
  /** Job identifier */
  jobId: string;
  /** Unique request ID (for logging) */
  requestId: string;
  /** Pipeline start timestamp */
  startTime: Date;
  /** Currently executing stage */
  currentStage: StageName;
  /** Results from completed stages */
  stageResults: Map<StageName, StageOutput>;
  /** Duration per stage in ms */
  stageTiming: Map<StageName, number>;
  /** Current revision iteration (0-3) */
  revisionCount: number;
  /** Maximum revisions allowed (default: 3) */
  maxRevisions: number;
}

// ========== STAGE INTERFACE ==========

/**
 * Common interface for all pipeline stages
 */
export interface Stage<TInput extends StageInput = StageInput, TOutput extends StageOutput = StageOutput> {
  /** Stage identifier */
  name: StageName;
  /** Execute stage logic */
  execute(input: TInput, context: PipelineContext): Promise<TOutput>;
}

// ========== STAGE INPUTS ==========

/**
 * Input for Secretary stage
 */
export interface SecretaryInput {
  /** Natural language tool description */
  userRequest: string;
}

/**
 * Input for Tool Builder stage
 */
export interface ToolBuilderInput {
  /** Specification to build */
  toolSpec: ToolSpec;
  /** Optional template guidance */
  template?: TemplateType;
}

/**
 * Input for Template Decider stage
 */
export interface TemplateDeciderInput {
  /** Specification to analyze */
  toolSpec: ToolSpec;
}

/**
 * Input for QA Department stage
 */
export interface QAInput {
  /** HTML to validate */
  html: string;
  /** Original specification */
  toolSpec: ToolSpec;
}

/**
 * Input for Feedback Applier stage
 */
export interface FeedbackApplierInput {
  /** Current HTML */
  html: string;
  /** Issues to fix (from QAResult.mustFix) */
  feedback: string[];
  /** Original specification */
  toolSpec: ToolSpec;
}

/**
 * Input for Audience Profiler stage
 */
export interface AudienceProfilerInput {
  /** Tool specification */
  toolSpec: ToolSpec;
  /** Summary of the content */
  contentSummary: string;
}

/**
 * Output from Audience Profiler stage
 */
export interface AudienceProfilerOutput {
  /** Detailed audience profile */
  profile: {
    primaryPersona: {
      name: string;
      businessStage: string;
      decisionStyle: string;
      timePressure: string;
      technicalComfort: string;
      emotionalState: string;
      quote: string;
    };
    languageGuidelines: {
      tone: string;
      complexity: string;
      jargonLevel: string;
      examplesStyle: string;
    };
    uxRecommendations: {
      inputStyle: string;
      resultFormat: string;
      commitmentLevel: string;
      helpTextDensity: string;
    };
    redFlags: string[];
  };
}

/**
 * Input for Example Generator stage
 */
export interface ExampleGeneratorInput {
  /** Tool specification */
  toolSpec: ToolSpec;
  /** Audience profile */
  audienceProfile: AudienceProfilerOutput['profile'];
}

/**
 * Output from Example Generator stage
 */
export interface ExampleGeneratorOutput {
  /** Test scenarios for validating tool logic */
  testScenarios: Array<{
    name: string;
    inputs: Record<string, string | number>;
    expectedVerdict: 'GO' | 'NO-GO';
    reasoning: string;
  }>;
  /** Case studies for inspiring users */
  caseStudies: Array<{
    id: string;
    title: string;
    business: {
      name: string;
      location: string;
      industry: string;
      size: string;
    };
    situation: {
      challenge: string;
      stakesDescription: string;
    };
    application: {
      toolUsed: string;
      keyInputs: string;
      verdict: 'GO' | 'NO-GO';
      decision: string;
    };
    results: {
      primaryMetric: { label: string; before: string; after: string; improvement: string };
      secondaryMetric: { label: string; before: string; after: string; improvement: string };
      timeframe: string;
      quote: string;
    };
  }>;
}

/**
 * Input for Copy Writer stage
 */
export interface CopyWriterInput {
  /** Tool specification */
  toolSpec: ToolSpec;
  /** Audience profile */
  audienceProfile: AudienceProfilerOutput['profile'];
}

/**
 * Output from Copy Writer stage
 */
export interface CopyWriterOutput {
  /** All microcopy for the tool */
  copy: {
    toolTitle: string;
    toolSubtitle: string;
    fieldLabels: Record<string, {
      label: string;
      placeholder: string;
      helpText: string;
      errorEmpty: string;
      errorInvalid: string;
    }>;
    progressMessages: string[];
    verdicts: {
      go: { headline: string; subtext: string; nextStep: string };
      noGo: { headline: string; subtext: string; alternative: string };
    };
    commitment: {
      headline: string;
      whoLabel: string;
      whatLabel: string;
      whenLabel: string;
    };
    cta: {
      primary: string;
      secondary: string;
      share: string;
    };
  };
}

/**
 * Input for Brand Guardian stage
 */
export interface BrandGuardianInput {
  /** Tool HTML to audit */
  toolHtml: string;
}

/**
 * Output from Brand Guardian stage
 */
export interface BrandGuardianOutput {
  /** Overall compliance status */
  overallCompliance: 'PASS' | 'FAIL' | 'NEEDS_FIXES';
  /** Compliance scores */
  score: {
    colors: number;
    typography: number;
    visual: number;
    tone: number;
    overall: number;
  };
  /** List of violations found */
  violations: Array<{
    category: 'COLORS' | 'TYPOGRAPHY' | 'VISUAL' | 'TONE';
    severity: 'CRITICAL' | 'MAJOR' | 'MINOR';
    location: string;
    issue: string;
    currentValue: string;
    correctValue: string;
    fixCode?: string;
  }>;
  /** Brand strengths */
  strengths: string[];
  /** Final recommendation */
  recommendation: string;
}

/**
 * Union of all stage inputs
 */
export type StageInput =
  | SecretaryInput
  | ToolBuilderInput
  | TemplateDeciderInput
  | QAInput
  | FeedbackApplierInput
  | AudienceProfilerInput
  | ExampleGeneratorInput
  | CopyWriterInput
  | BrandGuardianInput;

// ========== STAGE OUTPUTS ==========

/**
 * Output from Secretary stage
 */
export interface SecretaryOutput {
  /** Output type discriminator */
  type: 'spec' | 'clarification';
  /** Extracted spec (if type='spec') */
  toolSpec?: ToolSpec;
  /** Questions (if type='clarification') */
  clarificationRequest?: ClarificationRequest;
}

/**
 * Output from Tool Builder stage
 */
export interface ToolBuilderOutput {
  /** Generated HTML tool */
  html: string;
}

/**
 * Output from Template Decider stage
 */
export interface TemplateDeciderOutput {
  /** Template selection with reasoning */
  decision: TemplateDecision;
}

/**
 * Output from QA Department stage
 */
export interface QAOutput {
  /** Validation result with criteria */
  result: QAResult;
}

/**
 * Output from Feedback Applier stage
 */
export interface FeedbackApplierOutput {
  /** Revised HTML */
  html: string;
}

/**
 * Union of all stage outputs
 */
export type StageOutput =
  | SecretaryOutput
  | ToolBuilderOutput
  | TemplateDeciderOutput
  | QAOutput
  | FeedbackApplierOutput
  | AudienceProfilerOutput
  | ExampleGeneratorOutput
  | CopyWriterOutput
  | BrandGuardianOutput;

// ========== TYPE GUARDS ==========

/**
 * Type guard for SecretaryOutput
 */
export function isSecretaryOutput(output: StageOutput): output is SecretaryOutput {
  return 'type' in output && (output.type === 'spec' || output.type === 'clarification');
}

/**
 * Type guard for ToolBuilderOutput
 */
export function isToolBuilderOutput(output: StageOutput): output is ToolBuilderOutput {
  return 'html' in output && !('result' in output) && !('type' in output);
}

/**
 * Type guard for QAOutput
 */
export function isQAOutput(output: StageOutput): output is QAOutput {
  return 'result' in output && 'passed' in (output as QAOutput).result;
}

/**
 * Type guard for TemplateDeciderOutput
 */
export function isTemplateDeciderOutput(output: StageOutput): output is TemplateDeciderOutput {
  return 'decision' in output && 'template' in (output as TemplateDeciderOutput).decision;
}

/**
 * Type guard for FeedbackApplierOutput
 */
export function isFeedbackApplierOutput(output: StageOutput): output is FeedbackApplierOutput {
  return 'html' in output && !('type' in output) && !('result' in output);
}
