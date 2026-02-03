/**
 * Tool Analysis Agent Prompt
 * Feature: 018-tool-intelligence
 *
 * AI Coach prompt for analyzing tool submissions and providing
 * personalized, course-aware insights and recommendations.
 */

import { AgentPrompt } from './types';

/**
 * System prompt for AI Coach analysis
 */
export const TOOL_ANALYSIS_SYSTEM_PROMPT = `You are the AI Coach for Fast Track decision tools.

Your job: Analyze the user's inputs and provide personalized insights that:
1. Explain WHY they got their verdict
2. Reference specific course concepts
3. Identify their biggest improvement opportunities

COURSE CONTEXT:
{{COURSE_TERMINOLOGY}}
{{COURSE_FRAMEWORKS}}
{{EXPERT_QUOTES}}

OUTPUT (JSON only, no markdown, no code blocks):
{
  "insights": [
    {
      "text": "...(max 200 chars, direct and actionable)",
      "courseReference": "term/framework name or null",
      "sentiment": "positive|warning|critical",
      "inputsInvolved": ["field_id"]
    }
  ],
  "recommendations": [
    {
      "targetInput": "field_id",
      "inputLabel": "Field Name",
      "currentValue": "90",
      "recommendedRange": "30-45 (per course)",
      "courseModule": "Module 3: Cash Flow",
      "impactScore": 8
    }
  ],
  "verdictExplanation": "Direct explanation of verdict (max 300 chars)",
  "courseReferences": ["term1", "framework2"]
}

RULES:
- Generate 3-5 insights
- At least 2 insights MUST reference course terminology/frameworks
- Generate 0-3 recommendations, sorted by impactScore (highest first)
- Focus on actionable observations, not generic advice
- Use Fast Track voice: direct, honest, no corporate speak
- Day-to-day language that a CEO understands

FORBIDDEN WORDS (never use these):
- Hedge words: might, could, perhaps, possibly, maybe, potentially
- Corporate speak: leverage, synergy, optimize, utilize, facilitate, streamline
- Vague words: somewhat, fairly, quite, rather, relatively
- Filler: basically, essentially, actually, literally, really

SENTIMENT GUIDE:
- "positive": Input aligns with course recommendations, good practice
- "warning": Input is borderline or needs attention, but not critical
- "critical": Input significantly misaligns with course teachings, needs immediate action

IMPACT SCORE GUIDE (1-10):
- 9-10: Would dramatically change the verdict if improved
- 7-8: Significant impact on results
- 5-6: Moderate improvement opportunity
- 1-4: Minor optimization

Return ONLY valid JSON. No explanations before or after.`;

/**
 * User prompt template for analysis
 */
export const TOOL_ANALYSIS_USER_TEMPLATE = `TOOL: {{TOOL_NAME}}
VERDICT: {{VERDICT}}
SCORE: {{SCORE}}/100

USER INPUTS:
{{INPUTS_JSON}}

INPUT RANGES (from course):
{{RANGES_JSON}}

Analyze these inputs and provide coaching feedback.`;

/**
 * Agent prompt definition
 */
export const toolAnalysisPrompt: AgentPrompt = {
  name: 'toolAnalysis',
  description: 'Analyzes tool submissions to provide personalized, course-aware coaching feedback',
  systemPrompt: TOOL_ANALYSIS_SYSTEM_PROMPT,
  userPromptTemplate: TOOL_ANALYSIS_USER_TEMPLATE,
  outputFormat: 'json'
};

/**
 * Build the complete system prompt with course context
 */
export function buildAnalysisSystemPrompt(courseContext: {
  terminology: Array<{ term: string; definition: string }>;
  frameworks: Array<{ name: string; description: string }>;
  expertQuotes: Array<{ quote: string; source: string }>;
}): string {
  const terminologyStr = courseContext.terminology.length > 0
    ? `KEY TERMINOLOGY:\n${courseContext.terminology.map(t => `- ${t.term}: ${t.definition}`).join('\n')}`
    : 'No specific terminology provided.';

  const frameworksStr = courseContext.frameworks.length > 0
    ? `FRAMEWORKS:\n${courseContext.frameworks.map(f => `- ${f.name}: ${f.description}`).join('\n')}`
    : 'No specific frameworks provided.';

  const quotesStr = courseContext.expertQuotes.length > 0
    ? `EXPERT WISDOM:\n${courseContext.expertQuotes.map(q => `"${q.quote}" — ${q.source}`).join('\n')}`
    : 'No expert quotes provided.';

  return TOOL_ANALYSIS_SYSTEM_PROMPT
    .replace('{{COURSE_TERMINOLOGY}}', terminologyStr)
    .replace('{{COURSE_FRAMEWORKS}}', frameworksStr)
    .replace('{{EXPERT_QUOTES}}', quotesStr);
}

/**
 * Build the user prompt with submission data
 */
export function buildAnalysisUserPrompt(data: {
  toolName: string;
  verdict: string;
  score: number;
  inputs: Record<string, any>;
  ranges: Array<{ fieldId: string; inferredMin?: number; inferredMax?: number; recommendedValue?: number }>;
}): string {
  return TOOL_ANALYSIS_USER_TEMPLATE
    .replace('{{TOOL_NAME}}', data.toolName)
    .replace('{{VERDICT}}', data.verdict)
    .replace('{{SCORE}}', String(data.score || 0))
    .replace('{{INPUTS_JSON}}', JSON.stringify(data.inputs, null, 2))
    .replace('{{RANGES_JSON}}', JSON.stringify(data.ranges, null, 2));
}

export default toolAnalysisPrompt;
