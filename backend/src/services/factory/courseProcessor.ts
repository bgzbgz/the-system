/**
 * Course Content Processor
 *
 * Transforms course content into tool specifications using a specialized
 * agent pipeline designed for knowledge application.
 *
 * Pipeline:
 * 1. Content Summarizer - Handles large files, extracts actionable content
 * 2. Course Analyst - Identifies frameworks, formulas, decision criteria
 * 3. Knowledge Architect - Designs tool that applies the knowledge
 * 4. → Feeds into existing Tool Builder pipeline
 */

import { AIService } from '../ai';
import { contentSummarizerPrompt } from '../../prompts/contentSummarizer';
import { courseAnalystPrompt } from '../../prompts/courseAnalyst';
import { knowledgeArchitectPrompt } from '../../prompts/knowledgeArchitect';
import { ToolSpec, Phase, BranchCondition, BranchOperator, BranchAction } from '../../prompts/types';
import logger from '../../utils/logger';
import {
  validateExtraction,
  validateDesignAlignment,
  buildBuilderContext,
  formatValidationResult,
  validatePhases
} from './validation';
import { ValidationResult, BuilderContext } from './types';

export interface CourseAnalysis {
  moduleTitle: string;
  coreConcept: string;
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
  practicalApplication?: {
    userRole: string;
    realWorldScenario: string;
    dataNeeded: string[];
    actionAfterResult: string;
  };
  toolOpportunity?: {
    suggestedToolName: string;
    toolPurpose: string;
    valueProposition: string;
  };
  // Deep content extraction for richer tools
  deepContent?: {
    keyTerminology?: Array<{
      term: string;
      definition: string;
      howToUseInTool: string;
    }>;
    // Numbered frameworks like "7 Levers", "5 Steps", etc.
    numberedFramework?: {
      frameworkName: string;
      items: Array<{
        number: number;
        name: string;
        fullLabel: string;
        definition: string;
        toolInputLabel: string;
      }>;
    };
    reflectionQuestions?: Array<{
      question: string;
      section: string;
      toolInputOpportunity: string;
    }>;
    expertWisdom?: Array<{
      quote: string;
      source: string;
      principle: string;
    }>;
    bookReferences?: Array<{
      title: string;
      author: string;
      keyTakeaway: string;
    }>;
    sprintChecklist?: Array<{
      item: string;
      validationType: string;
      toolValidation: string;
    }>;
    conceptsToLearn?: string[];
    decisionsToMake?: string[];
    processesToImplement?: string[];
    capabilitiesToDevelop?: string[];
    // Input ranges for AI coaching feedback (018-tool-intelligence)
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
}

export interface ToolDesign {
  toolDesign: {
    name: string;
    tagline: string;
    courseCorrelation: string;
  };
  inputs: Array<{
    name: string;
    type: string;
    label: string;
    placeholder?: string;
    helpText?: string;
    required: boolean;
    courseReference?: string;
    courseTerminology?: string;
    reflectionQuestionBasis?: string;
    options?: string[];
  }>;
  processing: {
    logic: string;
    formula?: string;
    courseFramework?: string;
  };
  output: {
    primaryResult: {
      label: string;
      format: string;
      interpretation: string;
    };
    decision: {
      type: string;
      criteria: string;
      goThreshold: string;
      noGoThreshold: string;
    };
    nextAction: {
      onGo: string;
      onNoGo: string;
    };
  };
  courseAlignment: {
    moduleObjective: string;
    toolDelivery: string;
    knowledgeReinforcement: string;
  };
  // Deep content integration for richer tools
  deepContentIntegration?: {
    terminologyUsed?: string[];
    expertQuoteToDisplay?: {
      quote: string;
      source: string;
      displayLocation: string;
    };
    sprintChecklistValidation?: Array<{
      checklistItem: string;
      howToolValidates: string;
    }>;
    frameworkVisualization?: string;
    reflectionQuestionsAnswered?: string[];
  };
  // Multi-phase wizard design (019-multistep-wizard-tools)
  phases?: Array<{
    id: string;
    name: string;
    description: string;
    order: number;
    inputIds: string[];
    summaryTemplate: string;
    teachingMomentTag?: string;
    branchConditions?: Array<{
      sourceField: string;
      operator: string;
      targetValue: string | number;
      action: 'show' | 'hide';
      targetPhase?: string;
      targetInput?: string;
    }>;
  }>;
  defaultPhasePath?: string[];
}

/**
 * Extraction metrics for validation and debugging
 */
export interface ExtractionMetadata {
  /** Number of framework items extracted (e.g., 7 for "7 Levers") */
  frameworkItemCount: number;
  /** Name of the framework if found */
  frameworkName: string | null;
  /** Number of unique terminology items extracted */
  terminologyCount: number;
  /** Number of expert quotes extracted */
  quoteCount: number;
  /** Number of reflection questions extracted */
  reflectionQuestionCount: number;
  /** Number of sprint checklist items extracted */
  checklistItemCount: number;
  /** Whether extraction passed validation */
  validationPassed: boolean;
}

export interface CourseProcessorResult {
  success: boolean;
  summarizedContent?: string;
  courseAnalysis?: CourseAnalysis;
  toolDesign?: ToolDesign;
  toolSpec?: ToolSpec;
  builderContext?: BuilderContext;
  extractionValidation?: ValidationResult;
  designValidation?: ValidationResult;
  /** Extraction metrics for tracking and debugging */
  extractionMetadata?: ExtractionMetadata;
  error?: string;
  timing?: {
    summarize: number;
    analyze: number;
    design: number;
    total: number;
  };
}

const MAX_CONTENT_FOR_DIRECT_PROCESSING = 8000;
const MAX_TOKENS_SUMMARIZER = 4096;
const MAX_TOKENS_ANALYST = 4096;
const MAX_TOKENS_ARCHITECT = 4096;

export class CourseProcessor {
  private aiService: AIService;
  private jobId: string;

  constructor(aiService: AIService, jobId: string) {
    this.aiService = aiService;
    this.jobId = jobId;
  }

  /**
   * Process course content through the full pipeline
   */
  async processContent(content: string): Promise<CourseProcessorResult> {
    const startTime = Date.now();
    const timing = { summarize: 0, analyze: 0, design: 0, total: 0 };

    try {
      // Step 1: Summarize if content is too large
      let processableContent = content;
      if (content.length > MAX_CONTENT_FOR_DIRECT_PROCESSING) {
        logger.info('[CourseProcessor] Content too large, summarizing...', {
          originalLength: content.length,
          jobId: this.jobId
        });

        const summarizeStart = Date.now();
        const summarized = await this.summarizeContent(content);
        timing.summarize = Date.now() - summarizeStart;

        if (!summarized) {
          return { success: false, error: 'Failed to summarize content' };
        }
        processableContent = summarized;

        logger.info('[CourseProcessor] Content summarized', {
          originalLength: content.length,
          summarizedLength: processableContent.length,
          jobId: this.jobId
        });
      }

      // Step 2: Analyze the course content
      const analyzeStart = Date.now();
      const analysis = await this.analyzeCourse(processableContent);
      timing.analyze = Date.now() - analyzeStart;

      if (!analysis) {
        return {
          success: false,
          summarizedContent: processableContent,
          error: 'Failed to analyze course content'
        };
      }

      logger.info('[CourseProcessor] Course analyzed', {
        moduleTitle: analysis.moduleTitle,
        hasFramework: !!analysis.framework,
        formulaCount: analysis.formulas?.length || 0,
        jobId: this.jobId
      });

      // Step 2.5: Build extraction metadata for tracking
      const deepContent = analysis.deepContent;
      const extractionMetadata: ExtractionMetadata = {
        frameworkItemCount: deepContent?.numberedFramework?.items?.length || 0,
        frameworkName: deepContent?.numberedFramework?.frameworkName || null,
        terminologyCount: deepContent?.keyTerminology?.length || 0,
        quoteCount: deepContent?.expertWisdom?.length || 0,
        reflectionQuestionCount: deepContent?.reflectionQuestions?.length || 0,
        checklistItemCount: deepContent?.sprintChecklist?.length || 0,
        validationPassed: false // Will be updated after validation
      };

      logger.info('[CourseProcessor] Extraction metadata', {
        ...extractionMetadata,
        jobId: this.jobId
      });

      // Step 2.6: Validate extraction
      const extractionValidation = validateExtraction(analysis);
      extractionMetadata.validationPassed = extractionValidation.passed;

      logger.info('[CourseProcessor] Extraction validation', {
        passed: extractionValidation.passed,
        errors: extractionValidation.errors.length,
        warnings: extractionValidation.warnings.length,
        jobId: this.jobId
      });

      if (!extractionValidation.passed) {
        const errorMessages = extractionValidation.errors.map(e => e.message).join('; ');
        logger.error('[CourseProcessor] Extraction validation failed', {
          errors: extractionValidation.errors,
          extractionMetadata,
          jobId: this.jobId
        });
        return {
          success: false,
          summarizedContent: processableContent,
          courseAnalysis: analysis,
          extractionValidation,
          extractionMetadata,
          error: `Extraction validation failed: ${errorMessages}`
        };
      }

      // Step 3: Design the tool
      const designStart = Date.now();
      const design = await this.designTool(analysis, processableContent);
      timing.design = Date.now() - designStart;

      if (!design) {
        return {
          success: false,
          summarizedContent: processableContent,
          courseAnalysis: analysis,
          error: 'Failed to design tool'
        };
      }

      logger.info('[CourseProcessor] Tool designed', {
        toolName: design.toolDesign.name,
        inputCount: design.inputs.length,
        jobId: this.jobId
      });

      // Step 3.5: Validate design alignment
      const designValidation = validateDesignAlignment(analysis, design);
      logger.info('[CourseProcessor] Design validation', {
        passed: designValidation.passed,
        errors: designValidation.errors.length,
        warnings: designValidation.warnings.length,
        jobId: this.jobId
      });

      if (!designValidation.passed) {
        const errorMessages = designValidation.errors.map(e => e.message).join('; ');
        logger.error('[CourseProcessor] Design validation failed', {
          errors: designValidation.errors,
          extractionMetadata,
          jobId: this.jobId
        });
        return {
          success: false,
          summarizedContent: processableContent,
          courseAnalysis: analysis,
          toolDesign: design,
          extractionValidation,
          extractionMetadata,
          designValidation,
          error: `Design validation failed: ${errorMessages}`
        };
      }

      // Step 3.6: Build structured context for Tool Builder
      const builderContext = buildBuilderContext(analysis, design);
      logger.info('[CourseProcessor] BuilderContext created', {
        frameworkItems: builderContext.frameworkItems.length,
        terminology: builderContext.terminology.length,
        hasQuote: !!builderContext.expertQuote,
        jobId: this.jobId
      });

      // Step 4: Convert to ToolSpec for existing pipeline
      const toolSpec = this.convertToToolSpec(design, analysis);

      // Attach builderContext to toolSpec
      (toolSpec as ToolSpec & { _builderContext?: BuilderContext })._builderContext = builderContext;

      // Step 4.5: Validate phases if present (019-multistep-wizard-tools)
      if (toolSpec.phases && toolSpec.phases.length > 0) {
        const allInputIds = (design.inputs || []).map(i => i.name);
        const phaseValidation = validatePhases(toolSpec.phases, allInputIds);

        if (!phaseValidation.valid) {
          logger.warn('[CourseProcessor] Phase validation issues (non-blocking)', {
            issues: phaseValidation.issues,
            jobId: this.jobId
          });
          // Phase validation is a warning, not a blocker
          // Tool will still generate but may have suboptimal phase structure
        }
      }

      timing.total = Date.now() - startTime;

      return {
        success: true,
        summarizedContent: processableContent,
        courseAnalysis: analysis,
        toolDesign: design,
        toolSpec,
        builderContext,
        extractionValidation,
        extractionMetadata,
        designValidation,
        timing
      };

    } catch (error) {
      logger.logError('[CourseProcessor] Pipeline failed', error as Error, { jobId: this.jobId });
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  /**
   * Summarize large content while preserving actionable knowledge
   */
  private async summarizeContent(content: string): Promise<string | null> {
    try {
      // For very large content, chunk and summarize
      if (content.length > 50000) {
        return await this.chunkAndSummarize(content);
      }

      const response = await this.aiService.completeWithFallback({
        systemPrompt: contentSummarizerPrompt.systemPrompt,
        userPrompt: content,
        maxTokens: MAX_TOKENS_SUMMARIZER,
        useHaiku: true  // Cost optimized - summarization doesn't need Sonnet
      }, 'courseProcessor');

      logger.info('[CourseProcessor] Summarization complete', {
        jobId: this.jobId,
        cost: response.estimatedCostUsd.toFixed(6),
        usedFallback: response.usedFallback
      });

      return response.content;
    } catch (error) {
      logger.logError('[CourseProcessor] Summarization failed', error as Error, { jobId: this.jobId });
      return null;
    }
  }

  /**
   * Handle very large content by chunking
   */
  private async chunkAndSummarize(content: string): Promise<string | null> {
    // Split by section markers (---) or headers (#)
    const sections = content.split(/(?=^#{1,3}\s|\n---\n)/m);
    const summaries: string[] = [];

    for (const section of sections) {
      if (section.trim().length < 100) continue; // Skip tiny sections

      const summary = await this.aiService.completeWithFallback({
        systemPrompt: `Extract ONLY the actionable content from this section. Preserve formulas, steps, criteria exactly. Remove fluff. Output under 1000 chars.`,
        userPrompt: section.substring(0, 15000), // Cap each chunk
        maxTokens: 1024,
        useHaiku: true  // Cost optimized
      }, 'courseProcessor');

      if (summary.content) {
        summaries.push(summary.content);
      }
    }

    return summaries.join('\n\n---\n\n');
  }

  /**
   * Analyze course content to extract teachable knowledge
   */
  private async analyzeCourse(content: string): Promise<CourseAnalysis | null> {
    try {
      const response = await this.aiService.completeWithFallback({
        systemPrompt: courseAnalystPrompt.systemPrompt,
        userPrompt: content,
        maxTokens: MAX_TOKENS_ANALYST,
        useHaiku: true  // Cost optimized - analysis doesn't need Sonnet
      }, 'courseProcessor');

      logger.info('[CourseProcessor] Analysis complete', {
        jobId: this.jobId,
        cost: response.estimatedCostUsd.toFixed(6),
        usedFallback: response.usedFallback
      });

      // Parse JSON response
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        logger.error('[CourseProcessor] No JSON found in analyst response');
        return null;
      }

      return JSON.parse(jsonMatch[0]) as CourseAnalysis;
    } catch (error) {
      logger.logError('[CourseProcessor] Analysis failed', error as Error, { jobId: this.jobId });
      return null;
    }
  }

  /**
   * Design a tool based on course analysis
   */
  private async designTool(analysis: CourseAnalysis, originalContent: string): Promise<ToolDesign | null> {
    try {
      const userMessage = `
COURSE ANALYSIS:
${JSON.stringify(analysis, null, 2)}

ORIGINAL CONTENT EXCERPT (for reference):
${originalContent.substring(0, 3000)}

Design a tool that helps students APPLY the knowledge from this course to their real business situation.
`;

      const response = await this.aiService.completeWithFallback({
        systemPrompt: knowledgeArchitectPrompt.systemPrompt,
        userPrompt: userMessage,
        maxTokens: MAX_TOKENS_ARCHITECT,
        useHaiku: true  // Cost optimized - design doesn't need Sonnet
      }, 'courseProcessor');

      logger.info('[CourseProcessor] Design complete', {
        jobId: this.jobId,
        cost: response.estimatedCostUsd.toFixed(6),
        usedFallback: response.usedFallback
      });

      // Parse JSON response
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        logger.error('[CourseProcessor] No JSON found in architect response');
        return null;
      }

      return JSON.parse(jsonMatch[0]) as ToolDesign;
    } catch (error) {
      logger.logError('[CourseProcessor] Design failed', error as Error, { jobId: this.jobId });
      return null;
    }
  }

  /**
   * Convert ToolDesign to ToolSpec for existing pipeline
   */
  private convertToToolSpec(design: ToolDesign, analysis: CourseAnalysis): ToolSpec {
    // Safely extract nested properties with fallbacks using optional chaining
    const decision = design.output?.decision;
    const nextAction = design.output?.nextAction;
    const primaryResult = design.output?.primaryResult;
    const courseAlignment = design.courseAlignment;
    const processing = design.processing;
    const deepContent = analysis.deepContent;

    // Build terminology string for processing logic
    const terminologyContext = deepContent?.keyTerminology?.length
      ? `\nKEY TERMINOLOGY TO USE:\n${deepContent.keyTerminology.map(t => `- ${t.term}: ${t.definition}`).join('\n')}`
      : '';

    // Build numbered framework context (e.g., "7 Levers")
    const numberedFrameworkContext = deepContent?.numberedFramework
      ? `\nNUMBERED FRAMEWORK - ${deepContent.numberedFramework.frameworkName}:\n${deepContent.numberedFramework.items.map(item => `- ${item.fullLabel} → Tool input: "${item.toolInputLabel}"`).join('\n')}`
      : '';

    // Build expert quotes for results
    const expertQuotesContext = deepContent?.expertWisdom?.length
      ? `\nEXPERT QUOTES TO DISPLAY:\n${deepContent.expertWisdom.map(e => `"${e.quote}" — ${e.source}`).join('\n')}`
      : '';

    // Build sprint checklist for validation
    const checklistContext = deepContent?.sprintChecklist?.length
      ? `\nSPRINT CHECKLIST VALIDATION:\n${deepContent.sprintChecklist.map(c => `- ${c.item}`).join('\n')}`
      : '';

    // Convert phases if present (019-multistep-wizard-tools)
    const phases: Phase[] | undefined = design.phases?.map(phase => ({
      id: phase.id,
      name: phase.name,
      description: phase.description,
      order: phase.order,
      // Map inputIds to actual ToolInput objects
      inputs: (design.inputs || [])
        .filter(input => (phase.inputIds || []).includes(input.name))
        .map(input => ({
          name: input.name,
          type: input.type as 'text' | 'number' | 'select' | 'textarea',
          label: input.label,
          required: input.required,
          ...(input.options && { options: input.options })
        })),
      summaryTemplate: phase.summaryTemplate,
      teachingMomentTag: phase.teachingMomentTag,
      branchConditions: phase.branchConditions?.map(cond => ({
        sourceField: cond.sourceField,
        operator: cond.operator as BranchOperator,
        targetValue: cond.targetValue,
        action: cond.action as BranchAction,
        targetPhase: cond.targetPhase,
        targetInput: cond.targetInput
      }))
    }));

    return {
      name: design.toolDesign?.name || 'Decision Tool',
      purpose: design.toolDesign?.tagline || 'Make informed decisions',
      inputs: (design.inputs || []).map(input => ({
        name: input.name,
        type: input.type as 'text' | 'number' | 'select' | 'textarea',
        label: input.label,
        required: input.required,
        ...(input.options && { options: input.options }),
        ...(input.placeholder && { placeholder: input.placeholder })
      })),
      outputType: 'text' as const,
      // Multi-phase wizard support (019-multistep-wizard-tools)
      phases,
      defaultPhasePath: design.defaultPhasePath,
      processingLogic: `
COURSE CORRELATION: ${courseAlignment?.moduleObjective || analysis.learningObjective || 'Apply course knowledge'}
MODULE: ${analysis.moduleTitle}
${terminologyContext}
${numberedFrameworkContext}

PROCESSING LOGIC:
${processing?.logic || 'Analyze inputs and provide decision'}

${processing?.formula ? `FORMULA: ${processing.formula}` : ''}

DECISION CRITERIA:
- GO when: ${decision?.goThreshold || decision?.criteria || analysis.decisionCriteria?.goCondition || 'Criteria met'}
- NO-GO when: ${decision?.noGoThreshold || analysis.decisionCriteria?.noGoCondition || 'Criteria not met'}

NEXT ACTIONS:
- If GO: ${nextAction?.onGo || 'Proceed with implementation'}
- If NO-GO: ${nextAction?.onNoGo || 'Revisit and reassess'}

RESULT INTERPRETATION:
${primaryResult?.interpretation || 'Use the result to guide your decision'}
${expertQuotesContext}
${checklistContext}
`,
      // Store extra context for tool builder - including DEEP content
      _courseContext: {
        moduleTitle: analysis.moduleTitle,
        learningObjective: analysis.learningObjective,
        framework: analysis.framework,
        formulas: analysis.formulas,
        decisionCriteria: analysis.decisionCriteria,
        courseAlignment: design.courseAlignment,
        // NEW: Deep content for richer tools
        deepContent: {
          keyTerminology: deepContent?.keyTerminology || [],
          numberedFramework: deepContent?.numberedFramework || null,
          reflectionQuestions: deepContent?.reflectionQuestions || [],
          expertWisdom: deepContent?.expertWisdom || [],
          bookReferences: deepContent?.bookReferences || [],
          sprintChecklist: deepContent?.sprintChecklist || [],
          conceptsToLearn: deepContent?.conceptsToLearn || [],
          decisionsToMake: deepContent?.decisionsToMake || [],
          processesToImplement: deepContent?.processesToImplement || [],
          capabilitiesToDevelop: deepContent?.capabilitiesToDevelop || [],
          // Input ranges for AI coaching feedback (018-tool-intelligence)
          inputRanges: deepContent?.inputRanges || []
        }
      }
    };
  }
}

export default CourseProcessor;
