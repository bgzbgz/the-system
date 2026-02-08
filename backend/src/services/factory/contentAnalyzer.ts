/**
 * Content Analyzer Agent
 *
 * AI-First Tool Creation: Analyzes uploaded course content and extracts
 * everything needed to build a tool, presenting it for user confirmation
 * before the actual tool building begins.
 *
 * This is the first step in the new creation flow:
 * 1. User uploads document → ContentAnalyzer extracts understanding
 * 2. User confirms or edits the AI's understanding
 * 3. Confirmed specs feed into existing factory pipeline
 */

import { AIService } from '../ai';
import logger from '../../utils/logger';

// ========== TYPES ==========

/**
 * What the Content Analyzer extracts from a document
 */
export interface ContentAnalysisResult {
  /** The 80/20 core insight - the main takeaway */
  coreInsight: string;

  /** Primary framework detected (if any) */
  framework: {
    name: string;
    items: Array<{
      number: number;
      name: string;
      description: string;
    }>;
  } | null;

  /** Type of decision this content helps make */
  decisionType: 'go-no-go' | 'scoring' | 'comparison' | 'calculator';

  /** The main question the tool should answer */
  decisionQuestion: string;

  /** Suggested inputs for the tool */
  suggestedInputs: Array<{
    id: string;
    label: string;
    type: 'number' | 'currency' | 'percentage' | 'slider' | 'text' | 'select';
    hint?: string;
    options?: string[];  // For select type
  }>;

  /** Key terminology from the course */
  terminology: Array<{
    term: string;
    definition: string;
  }>;

  /** Expert quotes found in the content */
  expertQuotes: Array<{
    quote: string;
    source: string;
  }>;

  /** What makes a GO verdict */
  goCondition: string;

  /** What makes a NO-GO verdict */
  noGoCondition: string;

  /** Confidence score (0-100) */
  confidence: number;

  /** Suggested tool name */
  suggestedToolName: string;

  /** Brief description of what the tool does */
  toolPurpose: string;
}

/**
 * Result from the Content Analyzer service
 */
export interface AnalyzerResult {
  success: boolean;
  analysis?: ContentAnalysisResult;
  error?: string;
  timing?: {
    duration: number;
    tokensUsed: {
      input: number;
      output: number;
    };
  };
}

/**
 * User's edits to the AI's understanding
 */
export interface AnalysisEdits {
  suggestedToolName?: string;
  toolPurpose?: string;
  coreInsight?: string;
  decisionType?: ContentAnalysisResult['decisionType'];
  decisionQuestion?: string;
  suggestedInputs?: ContentAnalysisResult['suggestedInputs'];
  goCondition?: string;
  noGoCondition?: string;
  additionalNotes?: string;
}

// ========== PROMPT ==========

const CONTENT_ANALYZER_PROMPT = `You are the Content Analyzer Agent for the Fast Track Tool Factory.

Your mission is to analyze course content and extract EVERYTHING needed to build a decision-making tool, presenting your understanding for the human operator to confirm or correct.

THE GOAL:
Extract the "golden 80/20" from the content - the critical 20% of knowledge that delivers 80% of the value. This will power a tool that helps users make real decisions.

WHAT TO EXTRACT:

1. CORE INSIGHT (The 80/20)
   - What is THE key principle or insight this content teaches?
   - This should be 1-2 sentences that capture the essence
   - Example: "Price increases of 10-15% rarely cause significant churn when value is properly communicated"

2. FRAMEWORK DETECTION
   - Does the content teach a numbered framework? (e.g., "7 Levers", "5 Steps", "4 Pillars")
   - If yes, extract ALL items with their numbers and descriptions
   - These become the tool's input fields

3. DECISION TYPE
   - go-no-go: Binary decision (should I do X or not?)
   - scoring: Rate something on a scale
   - comparison: Compare options
   - calculator: Calculate a specific number

4. DECISION QUESTION
   - What specific question does this tool help answer?
   - Example: "Should I raise my prices now?"

5. SUGGESTED INPUTS
   - What data does the user need to provide?
   - Map framework items to input fields
   - Determine appropriate input types (number, currency, percentage, slider, text, select)

6. KEY TERMINOLOGY
   - What course-specific terms should the tool use?
   - These make the tool feel connected to the course

7. EXPERT QUOTES
   - Any memorable quotes that add credibility?
   - Include attribution

8. VERDICT CRITERIA
   - What makes a GO? Be specific with numbers/thresholds if mentioned
   - What makes a NO-GO?

OUTPUT FORMAT (JSON):
{
  "coreInsight": "The one key insight from this content",
  "framework": {
    "name": "Framework Name (e.g., 'The 7 Levers of Pricing')",
    "items": [
      {
        "number": 1,
        "name": "Item Name",
        "description": "Brief description"
      }
    ]
  } OR null if no framework detected,
  "decisionType": "go-no-go" | "scoring" | "comparison" | "calculator",
  "decisionQuestion": "The question this tool answers",
  "suggestedInputs": [
    {
      "id": "input_id",
      "label": "User-friendly label",
      "type": "number" | "currency" | "percentage" | "slider" | "text" | "select",
      "hint": "Help text for the user",
      "options": ["Option 1", "Option 2"] // Only for select type
    }
  ],
  "terminology": [
    {
      "term": "Course-specific term",
      "definition": "What it means"
    }
  ],
  "expertQuotes": [
    {
      "quote": "The quote text",
      "source": "Who said it"
    }
  ],
  "goCondition": "When to give a GO verdict",
  "noGoCondition": "When to give a NO-GO verdict",
  "confidence": 85,  // 0-100: How confident are you in this analysis?
  "suggestedToolName": "Action Verb + Noun (e.g., 'Price Increase Calculator')",
  "toolPurpose": "One sentence describing what this tool does"
}

IMPORTANT RULES:
1. Focus on ACTIONABLE knowledge, not theory
2. Extract SPECIFIC numbers and thresholds when mentioned
3. Use the EXACT terminology from the course
4. Keep suggested inputs to 3-7 fields (not too many, not too few)
5. If no framework is detected, set framework to null
6. Set confidence lower (60-70) if the content is vague or incomplete

Return ONLY valid JSON. No explanations outside the JSON.`;

// ========== SERVICE ==========

export class ContentAnalyzer {
  private aiService: AIService;

  constructor(aiService: AIService) {
    this.aiService = aiService;
  }

  /**
   * Analyze uploaded content and extract tool-building information
   */
  async analyze(content: string, category: string): Promise<AnalyzerResult> {
    const startTime = Date.now();

    try {
      logger.info('[ContentAnalyzer] Starting analysis', {
        contentLength: content.length,
        category
      });

      // Prepare content - truncate if too long
      let processableContent = content;
      if (content.length > 50000) {
        logger.info('[ContentAnalyzer] Content too large, truncating', {
          originalLength: content.length
        });
        // Take first 25000 and last 25000 chars to capture intro and conclusion
        processableContent = content.substring(0, 25000) +
          '\n\n[... content truncated ...]\n\n' +
          content.substring(content.length - 25000);
      }

      const userPrompt = `CATEGORY: ${category}

CONTENT TO ANALYZE:
${processableContent}

Extract the key information needed to build a decision-making tool from this content.`;

      const response = await this.aiService.completeWithFallback({
        systemPrompt: CONTENT_ANALYZER_PROMPT,
        userPrompt,
        maxTokens: 4096,
        useHaiku: true  // Cost optimized - analysis doesn't need Sonnet
      }, 'contentAnalyzer');

      // Parse JSON response
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        logger.error('[ContentAnalyzer] No JSON found in response', {
          responsePreview: response.content.substring(0, 500)
        });
        return {
          success: false,
          error: 'Failed to parse AI response - no valid JSON found'
        };
      }

      const analysis = JSON.parse(jsonMatch[0]) as ContentAnalysisResult;

      // Validate required fields
      if (!analysis.coreInsight || !analysis.decisionQuestion || !analysis.suggestedInputs) {
        logger.error('[ContentAnalyzer] Missing required fields in analysis', {
          hasCoreInsight: !!analysis.coreInsight,
          hasDecisionQuestion: !!analysis.decisionQuestion,
          hasInputs: !!analysis.suggestedInputs
        });
        return {
          success: false,
          error: 'Analysis incomplete - missing required fields'
        };
      }

      const duration = Date.now() - startTime;

      logger.info('[ContentAnalyzer] Analysis complete', {
        duration,
        confidence: analysis.confidence,
        inputCount: analysis.suggestedInputs.length,
        hasFramework: !!analysis.framework,
        terminologyCount: analysis.terminology?.length || 0
      });

      return {
        success: true,
        analysis,
        timing: {
          duration,
          tokensUsed: {
            input: response.usage?.inputTokens || 0,
            output: response.usage?.outputTokens || 0
          }
        }
      };

    } catch (error) {
      logger.logError('[ContentAnalyzer] Analysis failed', error as Error);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  /**
   * Apply user edits to the analysis result
   */
  applyEdits(original: ContentAnalysisResult, edits: AnalysisEdits): ContentAnalysisResult {
    return {
      ...original,
      ...(edits.suggestedToolName && { suggestedToolName: edits.suggestedToolName }),
      ...(edits.toolPurpose && { toolPurpose: edits.toolPurpose }),
      ...(edits.coreInsight && { coreInsight: edits.coreInsight }),
      ...(edits.decisionType && { decisionType: edits.decisionType }),
      ...(edits.decisionQuestion && { decisionQuestion: edits.decisionQuestion }),
      ...(edits.suggestedInputs && { suggestedInputs: edits.suggestedInputs }),
      ...(edits.goCondition && { goCondition: edits.goCondition }),
      ...(edits.noGoCondition && { noGoCondition: edits.noGoCondition }),
      // Mark as user-confirmed by setting confidence to 100
      confidence: 100
    };
  }

  /**
   * Convert confirmed analysis to job submission format
   * This bridges the new AI-first flow to the existing factory pipeline
   */
  toJobSubmission(
    analysis: ContentAnalysisResult,
    fileContent: string,
    fileName: string,
    category: 'B2B_PRODUCT' | 'B2B_SERVICE' | 'B2C_PRODUCT' | 'B2C_SERVICE'
  ): {
    file_name: string;
    file_content: string;
    category: 'B2B_PRODUCT' | 'B2B_SERVICE' | 'B2C_PRODUCT' | 'B2C_SERVICE';
    decision: string;
    teaching_point: string;
    inputs: string;
    verdict_criteria: string;
  } {
    // Build inputs string from suggested inputs
    const inputsString = analysis.suggestedInputs
      .map(input => `${input.label} (${input.type})`)
      .join(', ');

    // Build verdict criteria from go/no-go conditions
    const verdictCriteria = `GO: ${analysis.goCondition}\nNO-GO: ${analysis.noGoCondition}`;

    // Build teaching point from core insight and terminology
    const teachingPoint = analysis.coreInsight +
      (analysis.terminology.length > 0
        ? `\n\nKey terms: ${analysis.terminology.map(t => t.term).join(', ')}`
        : '');

    return {
      file_name: fileName,
      file_content: fileContent,
      category,
      decision: analysis.decisionQuestion,
      teaching_point: teachingPoint,
      inputs: inputsString,
      verdict_criteria: verdictCriteria
    };
  }
}

export default ContentAnalyzer;
