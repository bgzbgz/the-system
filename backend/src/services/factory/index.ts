/**
 * Tool Factory Engine
 * Spec: 021-tool-factory-engine (FR-001)
 *
 * Core orchestrator for the AI pipeline.
 * Executes: Secretary → (Template Decider) → Tool Builder → QA → (Feedback Applier)
 */

import { v4 as uuidv4 } from 'uuid';
import {
  FactoryRequest,
  FactoryResult,
  PipelineContext,
  StageName,
  StageInput,
  StageOutput,
  SecretaryInput,
  SecretaryOutput,
  ToolBuilderInput,
  ToolBuilderOutput,
  TemplateDeciderInput,
  TemplateDeciderOutput,
  QAInput,
  QAOutput,
  FeedbackApplierInput,
  FeedbackApplierOutput,
  ToolSpec,
  TemplateType,
  // New enhanced stage types
  AudienceProfilerInput,
  AudienceProfilerOutput,
  ExampleGeneratorInput,
  ExampleGeneratorOutput,
  CopyWriterInput,
  CopyWriterOutput,
  BrandGuardianInput,
  BrandGuardianOutput
} from './types';
import { getStage } from './stages';
import {
  logPipelineStart,
  logPipelineComplete,
  logPipelineClarification,
  logStageStart,
  logStageComplete,
  logStageFailed,
  logQAIteration,
  logRevisionAttempt,
  logRetryAttempt,
  logValidationError
} from './logger';
import { CourseProcessor } from './courseProcessor';
import { aiService } from '../ai';

// ========== CONSTANTS ==========

const DEFAULT_MAX_REVISIONS = 3;
const DEFAULT_MAX_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 10000;

// ========== TOOL FACTORY CLASS ==========

/**
 * Main factory class for processing tool requests
 */
export class ToolFactory {
  /**
   * Process a tool request through the complete factory pipeline
   *
   * @param request - Factory request with job ID and user request
   * @returns Factory result with tool HTML or error
   */
  async processRequest(request: FactoryRequest): Promise<FactoryResult> {
    // Validate request
    if (!this.validateRequest(request)) {
      return this.createErrorResult(request.jobId, 'secretary', 'Invalid request: jobId and userRequest are required');
    }

    // Create pipeline context
    const context = this.createPipelineContext(request);

    // Log pipeline start
    logPipelineStart(context, request.userRequest);

    try {
      // Run the pipeline
      return await this.runPipeline(request, context);
    } catch (error) {
      // Handle unexpected errors
      const stage = context.currentStage || 'secretary';
      logStageFailed(context, stage, error as Error);
      logPipelineComplete(context, false);

      return this.createErrorResult(
        request.jobId,
        stage,
        (error as Error).message,
        error,
        context
      );
    }
  }

  // ========== PIPELINE EXECUTION ==========

  /**
   * Run the complete pipeline
   */
  private async runPipeline(request: FactoryRequest, context: PipelineContext): Promise<FactoryResult> {
    let toolSpec: ToolSpec;

    // Check if this is course content that needs special processing
    const isCourseContent = this.detectCourseContent(request.userRequest);

    if (isCourseContent) {
      // Use Course Processor for course content
      console.log(`[Factory] Detected course content for job ${request.jobId}, using CourseProcessor`);

      const courseProcessor = new CourseProcessor(aiService, request.jobId);
      const courseResult = await courseProcessor.processContent(request.userRequest);

      if (!courseResult.success || !courseResult.toolSpec) {
        return {
          success: false,
          jobId: request.jobId,
          status: 'failed',
          revisionCount: 0,
          error: courseResult.error || 'Failed to process course content',
          timing: this.buildTiming(context)
        };
      }

      toolSpec = courseResult.toolSpec;

      // Log course processing details
      console.log(`[Factory] Course analysis complete:`, {
        moduleTitle: courseResult.courseAnalysis?.moduleTitle,
        toolName: toolSpec.name,
        inputCount: toolSpec.inputs.length,
        hasFramework: !!courseResult.courseAnalysis?.framework,
        timing: courseResult.timing
      });
    } else {
      // Stage 1: Secretary - Extract tool specification (original flow)
      const secretaryOutput = await this.executeStage<SecretaryInput, SecretaryOutput>(
        'secretary',
        { userRequest: request.userRequest },
        context
      );

      // Check for clarification request
      if (secretaryOutput.type === 'clarification') {
        logPipelineClarification(context, secretaryOutput.clarificationRequest!.questions.length);

        return {
          success: false,
          jobId: request.jobId,
          status: 'needs_clarification',
          revisionCount: 0,
          clarificationRequest: {
            questions: secretaryOutput.clarificationRequest!.questions
          },
          timing: this.buildTiming(context)
        };
      }

      toolSpec = secretaryOutput.toolSpec!;
    }

    // ========== NEW ENHANCED STAGES ==========

    // Stage 2: Audience Profiler - Understand target user
    console.log(`[Factory] Running Audience Profiler for job ${request.jobId}`);
    const audienceOutput = await this.executeStage<AudienceProfilerInput, AudienceProfilerOutput>(
      'audienceProfiler',
      { toolSpec, contentSummary: request.userRequest.substring(0, 2000) },
      context
    );

    // Stage 3: Example Generator - Create case studies
    console.log(`[Factory] Running Example Generator for job ${request.jobId}`);
    const examplesOutput = await this.executeStage<ExampleGeneratorInput, ExampleGeneratorOutput>(
      'exampleGenerator',
      { toolSpec, audienceProfile: audienceOutput.profile },
      context
    );

    // Stage 4: Copy Writer - Generate microcopy
    console.log(`[Factory] Running Copy Writer for job ${request.jobId}`);
    const copyOutput = await this.executeStage<CopyWriterInput, CopyWriterOutput>(
      'copyWriter',
      { toolSpec, audienceProfile: audienceOutput.profile },
      context
    );

    // Enhance toolSpec with copywriting and case studies
    const enhancedSpec = {
      ...toolSpec,
      _enhancedContext: {
        audienceProfile: audienceOutput.profile,
        caseStudies: examplesOutput.caseStudies,
        testScenarios: examplesOutput.testScenarios,
        copy: copyOutput.copy
      }
    };

    // ========== ORIGINAL STAGES (with enhanced context) ==========

    // Stage 5 (Optional): Template Decider
    let template: TemplateType | undefined = request.templateHint;

    if (!request.skipTemplateDecider && !template) {
      const templateOutput = await this.executeStage<TemplateDeciderInput, TemplateDeciderOutput>(
        'templateDecider',
        { toolSpec: enhancedSpec },
        context
      );
      template = templateOutput.decision.template;
    }

    // Stage 6: Tool Builder - Generate HTML (with enhanced context)
    const builderOutput = await this.executeStage<ToolBuilderInput, ToolBuilderOutput>(
      'toolBuilder',
      { toolSpec: enhancedSpec, template },
      context
    );

    // Stage 7: Brand Guardian - Verify brand compliance
    console.log(`[Factory] Running Brand Guardian for job ${request.jobId}`);
    const brandOutput = await this.executeStage<BrandGuardianInput, BrandGuardianOutput>(
      'brandGuardian',
      { toolHtml: builderOutput.html },
      context
    );

    // Log brand compliance
    console.log(`[Factory] Brand Guardian result: ${brandOutput.overallCompliance} (score: ${brandOutput.score.overall})`);
    if (brandOutput.violations.length > 0) {
      console.log(`[Factory] Brand violations: ${brandOutput.violations.length}`);
    }

    // Stage 8+: QA with retry loop
    const qaResult = await this.runQAWithRetry(builderOutput.html, enhancedSpec, context);

    // Log pipeline completion
    logPipelineComplete(context, qaResult.result.passed);

    return {
      success: qaResult.result.passed,
      jobId: request.jobId,
      status: 'completed',
      toolSpec,
      toolHtml: qaResult.html,
      qaResult: qaResult.result,
      revisionCount: context.revisionCount,
      timing: this.buildTiming(context)
    };
  }

  /**
   * Run QA with automatic retry loop
   */
  private async runQAWithRetry(
    initialHtml: string,
    toolSpec: ToolSpec,
    context: PipelineContext
  ): Promise<{ html: string; result: QAOutput['result'] }> {
    let currentHtml = initialHtml;
    let qaOutput: QAOutput;
    let iteration = 1;

    // First QA check
    qaOutput = await this.executeStage<QAInput, QAOutput>(
      'qaDepartment',
      { html: currentHtml, toolSpec },
      context
    );

    logQAIteration(context, iteration, qaOutput.result.passed, qaOutput.result.score);

    // Retry loop if QA fails
    while (!qaOutput.result.passed && context.revisionCount < context.maxRevisions) {
      // Log revision attempt
      logRevisionAttempt(context, qaOutput.result.mustFix.length);

      // Apply feedback
      const feedbackOutput = await this.executeStage<FeedbackApplierInput, FeedbackApplierOutput>(
        'feedbackApplier',
        {
          html: currentHtml,
          feedback: qaOutput.result.mustFix,
          toolSpec
        },
        context
      );

      currentHtml = feedbackOutput.html;
      context.revisionCount++;
      iteration++;

      // Re-run QA
      qaOutput = await this.executeStage<QAInput, QAOutput>(
        'qaDepartment',
        { html: currentHtml, toolSpec },
        context
      );

      logQAIteration(context, iteration, qaOutput.result.passed, qaOutput.result.score);
    }

    return { html: currentHtml, result: qaOutput.result };
  }

  // ========== STAGE EXECUTION ==========

  /**
   * Execute a single stage with logging and timing
   */
  private async executeStage<TInput extends StageInput, TOutput extends StageOutput>(
    stageName: StageName,
    input: TInput,
    context: PipelineContext
  ): Promise<TOutput> {
    context.currentStage = stageName;
    logStageStart(context, stageName);

    const startTime = Date.now();

    try {
      const stage = getStage(stageName);
      const output = await this.executeWithRetry(
        () => stage.execute(input, context) as Promise<TOutput>,
        stageName,
        context
      );

      const durationMs = Date.now() - startTime;
      context.stageTiming.set(stageName, durationMs);
      context.stageResults.set(stageName, output as StageOutput);

      logStageComplete(context, stageName, output as StageOutput, durationMs);

      return output;
    } catch (error) {
      const durationMs = Date.now() - startTime;
      context.stageTiming.set(stageName, durationMs);
      logStageFailed(context, stageName, error as Error);
      throw error;
    }
  }

  /**
   * Execute with transient error retry
   */
  private async executeWithRetry<T>(
    fn: () => Promise<T>,
    stageName: StageName,
    context: PipelineContext
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= DEFAULT_MAX_RETRIES; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;

        // Check if error is transient (retryable)
        if (!this.isTransientError(lastError)) {
          throw lastError;
        }

        // Don't retry on last attempt
        if (attempt < DEFAULT_MAX_RETRIES) {
          logRetryAttempt(context, stageName, attempt, DEFAULT_MAX_RETRIES, lastError);

          // Exponential backoff
          const delay = Math.min(
            BASE_RETRY_DELAY_MS * Math.pow(2, attempt - 1),
            MAX_RETRY_DELAY_MS
          );
          await this.sleep(delay);
        }
      }
    }

    throw lastError!;
  }

  /**
   * Check if error is transient (retryable)
   */
  private isTransientError(error: Error): boolean {
    const message = error.message.toLowerCase();
    return (
      message.includes('network') ||
      message.includes('timeout') ||
      message.includes('rate limit') ||
      message.includes('429') ||
      message.includes('503') ||
      message.includes('502')
    );
  }

  // ========== HELPERS ==========

  /**
   * Validate request has required fields
   */
  private validateRequest(request: FactoryRequest): boolean {
    if (!request.jobId || typeof request.jobId !== 'string') {
      logValidationError(request.jobId || 'unknown', 'jobId', 'must be a non-empty string');
      return false;
    }

    if (!request.userRequest || typeof request.userRequest !== 'string') {
      logValidationError(request.jobId, 'userRequest', 'must be a non-empty string');
      return false;
    }

    // Course content can be up to 100KB, regular requests up to 10KB
    const isCourseContent = this.detectCourseContent(request.userRequest);
    const maxLength = isCourseContent ? 100000 : 10000;

    if (request.userRequest.length > maxLength) {
      logValidationError(request.jobId, 'userRequest', `must not exceed ${maxLength.toLocaleString()} characters`);
      return false;
    }

    return true;
  }

  /**
   * Detect if content appears to be course material
   * Course content typically has:
   * - Module/Sprint headers
   * - Learning objectives
   * - Structured sections with frameworks/tools
   */
  private detectCourseContent(content: string): boolean {
    const courseIndicators = [
      /\[?MODULE[:\s]/i,
      /\[?SPRINT[:\s]/i,
      /learning\s+objective/i,
      /INDIVIDUAL\s+PREPARATION/i,
      /TEAM\s+MEETING/i,
      /BRAIN\s+JUICE/i,
      /DEEP\s+DIVE/i,
      /Fast\s+Track/i,
      /\[EXPECTED\s+TIME:/i,
      /think\s+and\s+do/i
    ];

    let matchCount = 0;
    for (const indicator of courseIndicators) {
      if (indicator.test(content)) {
        matchCount++;
      }
    }

    // If 3+ indicators match, it's likely course content
    return matchCount >= 3;
  }

  /**
   * Create initial pipeline context
   */
  private createPipelineContext(request: FactoryRequest): PipelineContext {
    return {
      jobId: request.jobId,
      requestId: uuidv4(),
      startTime: new Date(),
      currentStage: 'secretary',
      stageResults: new Map(),
      stageTiming: new Map(),
      revisionCount: 0,
      maxRevisions: DEFAULT_MAX_REVISIONS
    };
  }

  /**
   * Build timing object from context
   */
  private buildTiming(context: PipelineContext): FactoryResult['timing'] {
    const total = Date.now() - context.startTime.getTime();
    const byStage: Partial<Record<StageName, number>> = {};

    context.stageTiming.forEach((duration, stage) => {
      byStage[stage] = duration;
    });

    return { total, byStage };
  }

  /**
   * Create error result
   */
  private createErrorResult(
    jobId: string,
    stage: StageName,
    message: string,
    details?: unknown,
    context?: PipelineContext
  ): FactoryResult {
    return {
      success: false,
      jobId,
      status: 'failed',
      revisionCount: context?.revisionCount ?? 0,
      error: {
        stage,
        message,
        details
      },
      timing: context
        ? this.buildTiming(context)
        : { total: 0, byStage: {} }
    };
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ========== SINGLETON EXPORT ==========

export const toolFactory = new ToolFactory();

// Re-export types
export * from './types';
