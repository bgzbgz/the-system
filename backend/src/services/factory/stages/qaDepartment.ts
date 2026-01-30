/**
 * QA Department Stage
 * Spec: 021-tool-factory-engine (US5)
 *
 * Validates generated tools against 8-point quality criteria.
 * Returns pass/fail with detailed feedback for revision.
 */

import { aiService } from '../../ai';
import { getPrompt } from '../../../prompts';
import { loadContext } from '../../../context';
import { parseQAResponse } from '../parser';
import type {
  Stage,
  QAInput,
  QAOutput,
  PipelineContext
} from '../types';
import { createLog, generateSummary } from '../../logStore';

/**
 * QA Department stage implementation
 */
export const qaDepartmentStage: Stage<QAInput, QAOutput> = {
  name: 'qaDepartment',

  async execute(input: QAInput, context: PipelineContext): Promise<QAOutput> {
    // Get QA prompt and criteria context
    const prompt = getPrompt('qaDepartment');
    const criteriaContext = loadContext('criteria');
    const feedbackContext = loadContext('feedback');

    // Build the full system prompt with context
    const systemPrompt = `${prompt.systemPrompt}\n\n## Detailed Criteria\n\n${criteriaContext}\n\n## Feedback Guidelines\n\n${feedbackContext}`;

    // Build user message with HTML and spec for comparison
    const userMessage = `## Original Tool Specification\n\n${JSON.stringify(input.toolSpec, null, 2)}\n\n## Generated HTML Tool\n\n\`\`\`html\n${input.html}\n\`\`\`\n\nEvaluate this tool against all 8 quality criteria. Return your assessment as JSON.`;

    // Call Claude for QA (more reliable JSON output than Gemini)
    const startTime = Date.now();
    const response = await aiService.callClaude({
      systemPrompt,
      userPrompt: userMessage,
      maxTokens: 4096
    });
    const duration = Date.now() - startTime;

    // Fire-and-forget: Log the AI call (spec 024-agent-reasoning-logs)
    createLog({
      job_id: context.jobId,
      stage: 'qa-eval',
      provider: 'claude',
      model: response.model,
      prompt: `${systemPrompt}\n\n---\n\n${userMessage}`,
      response: response.content,
      input_tokens: response.usage.inputTokens,
      output_tokens: response.usage.outputTokens,
      duration_ms: duration,
      summary: generateSummary('qa-eval', 'claude', response.content.length, {
        input: response.usage.inputTokens,
        output: response.usage.outputTokens
      })
    }).catch(err => console.error('[QADepartment] Log creation failed:', err));

    // Parse the QA result
    const result = parseQAResponse(response.content);

    return { result };
  }
};

export default qaDepartmentStage;
