/**
 * Feedback Applier Stage
 * Spec: 021-tool-factory-engine (US6)
 *
 * Applies QA feedback to revise tools with minimal changes.
 * Preserves working functionality while fixing identified issues.
 */

import { aiService } from '../../ai';
import { getPrompt } from '../../../prompts';
import { loadContext } from '../../../context';
import { extractHTML, validateHTMLStructure } from '../parser';
import type {
  Stage,
  FeedbackApplierInput,
  FeedbackApplierOutput,
  PipelineContext
} from '../types';
import { createLog, generateSummary } from '../../logStore';

/**
 * Feedback Applier stage implementation
 */
export const feedbackApplierStage: Stage<FeedbackApplierInput, FeedbackApplierOutput> = {
  name: 'feedbackApplier',

  async execute(input: FeedbackApplierInput, context: PipelineContext): Promise<FeedbackApplierOutput> {
    // Get feedback applier prompt and feedback context
    const prompt = getPrompt('feedbackApplier');
    const feedbackContext = loadContext('feedback');

    // Build the full system prompt with context
    const systemPrompt = `${prompt.systemPrompt}\n\n## Feedback Format Guidelines\n\n${feedbackContext}`;

    // Build user message with HTML, spec, and feedback
    const feedbackList = input.feedback.map((f, i) => `${i + 1}. ${f}`).join('\n');

    const userMessage = `## Original Tool Specification\n\n${JSON.stringify(input.toolSpec, null, 2)}\n\n## Current HTML Tool\n\n\`\`\`html\n${input.html}\n\`\`\`\n\n## Issues to Fix\n\n${feedbackList}\n\nApply minimal changes to fix these issues while preserving all working functionality. Return the complete revised HTML.`;

    // Call Claude Haiku for revision (cost optimized, still capable of HTML edits)
    const startTime = Date.now();
    const response = await aiService.callClaude({
      systemPrompt,
      userPrompt: userMessage,
      maxTokens: 8192,
      useHaiku: true
    });
    const duration = Date.now() - startTime;

    // Fire-and-forget: Log the AI call (spec 024-agent-reasoning-logs)
    createLog({
      job_id: context.jobId,
      stage: 'feedback-apply',
      provider: 'claude',
      model: response.model,
      prompt: `${systemPrompt}\n\n---\n\n${userMessage}`,
      response: response.content,
      input_tokens: response.usage.inputTokens,
      output_tokens: response.usage.outputTokens,
      duration_ms: duration,
      summary: generateSummary('feedback-apply', 'claude', response.content.length, {
        input: response.usage.inputTokens,
        output: response.usage.outputTokens
      })
    }).catch(err => console.error('[FeedbackApplier] Log creation failed:', err));

    // Extract revised HTML from response
    const html = extractHTML(response.content);

    // Validate HTML structure
    if (!validateHTMLStructure(html)) {
      throw new Error('Revised HTML missing required structure (html, head, body tags)');
    }

    return { html };
  }
};

export default feedbackApplierStage;
