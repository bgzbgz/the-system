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
import { ToolSpec } from '../../prompts/types';
import logger from '../../utils/logger';

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
}

export interface CourseProcessorResult {
  success: boolean;
  summarizedContent?: string;
  courseAnalysis?: CourseAnalysis;
  toolDesign?: ToolDesign;
  toolSpec?: ToolSpec;
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

      // Step 4: Convert to ToolSpec for existing pipeline
      const toolSpec = this.convertToToolSpec(design, analysis);

      timing.total = Date.now() - startTime;

      return {
        success: true,
        summarizedContent: processableContent,
        courseAnalysis: analysis,
        toolDesign: design,
        toolSpec,
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

      const response = await this.aiService.complete({
        systemPrompt: contentSummarizerPrompt.systemPrompt,
        userPrompt: content,
        maxTokens: MAX_TOKENS_SUMMARIZER
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

      const summary = await this.aiService.complete({
        systemPrompt: `Extract ONLY the actionable content from this section. Preserve formulas, steps, criteria exactly. Remove fluff. Output under 1000 chars.`,
        userPrompt: section.substring(0, 15000), // Cap each chunk
        maxTokens: 1024
      });

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
      const response = await this.aiService.complete({
        systemPrompt: courseAnalystPrompt.systemPrompt,
        userPrompt: content,
        maxTokens: MAX_TOKENS_ANALYST
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

      const response = await this.aiService.complete({
        systemPrompt: knowledgeArchitectPrompt.systemPrompt,
        userPrompt: userMessage,
        maxTokens: MAX_TOKENS_ARCHITECT
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
    // Safely extract nested properties with fallbacks
    const decision = design.output?.decision || {};
    const nextAction = design.output?.nextAction || {};
    const primaryResult = design.output?.primaryResult || {};
    const courseAlignment = design.courseAlignment || {};
    const processing = design.processing || {};

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
      processingLogic: `
COURSE CORRELATION: ${courseAlignment.moduleObjective || analysis.learningObjective || 'Apply course knowledge'}

PROCESSING LOGIC:
${processing.logic || 'Analyze inputs and provide decision'}

${processing.formula ? `FORMULA: ${processing.formula}` : ''}

DECISION CRITERIA:
- GO when: ${decision.goThreshold || decision.criteria || analysis.decisionCriteria?.goCondition || 'Criteria met'}
- NO-GO when: ${decision.noGoThreshold || analysis.decisionCriteria?.noGoCondition || 'Criteria not met'}

NEXT ACTIONS:
- If GO: ${nextAction.onGo || 'Proceed with implementation'}
- If NO-GO: ${nextAction.onNoGo || 'Revisit and reassess'}

RESULT INTERPRETATION:
${primaryResult.interpretation || 'Use the result to guide your decision'}
`,
      // Store extra context for tool builder
      _courseContext: {
        moduleTitle: analysis.moduleTitle,
        learningObjective: analysis.learningObjective,
        framework: analysis.framework,
        formulas: analysis.formulas,
        decisionCriteria: analysis.decisionCriteria,
        courseAlignment: design.courseAlignment
      }
    };
  }
}

export default CourseProcessor;
