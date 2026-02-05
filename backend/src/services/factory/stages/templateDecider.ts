/**
 * Template Decider Stage
 * Spec: 021-tool-factory-engine (US4)
 *
 * Selects the most appropriate template pattern based on tool requirements.
 * Returns template type with reasoning and adaptations.
 */

import { aiService } from '../../ai';
import { getPrompt } from '../../../prompts';
import { parseTemplateDecision } from '../parser';
import type {
  Stage,
  TemplateDeciderInput,
  TemplateDeciderOutput,
  PipelineContext
} from '../types';
import { createLog, generateSummary } from '../../logStore';

/**
 * Template Decider stage implementation
 */
export const templateDeciderStage: Stage<TemplateDeciderInput, TemplateDeciderOutput> = {
  name: 'templateDecider',

  async execute(input: TemplateDeciderInput, context: PipelineContext): Promise<TemplateDeciderOutput> {
    // Get template decider prompt
    const prompt = getPrompt('templateDecider');

    // Build user message with tool spec
    const userMessage = `## Tool Specification\n\n${JSON.stringify(input.toolSpec, null, 2)}\n\nAnalyze this specification and select the most appropriate template pattern.`;

    // Call Claude Haiku for simple template decision (faster & cheaper)
    const startTime = Date.now();
    const response = await aiService.callClaude({
      systemPrompt: prompt.systemPrompt,
      userPrompt: userMessage,
      maxTokens: 512,
      useHaiku: true  // Use Haiku for simple decisions
    });
    const duration = Date.now() - startTime;

    // Fire-and-forget: Log the AI call (spec 024-agent-reasoning-logs)
    createLog({
      job_id: context.jobId,
      stage: 'template-select',
      provider: 'claude',
      model: response.model,
      prompt: `${prompt.systemPrompt}\n\n---\n\n${userMessage}`,
      response: response.content,
      input_tokens: response.usage.inputTokens,
      output_tokens: response.usage.outputTokens,
      duration_ms: duration,
      summary: generateSummary('template-select', 'claude', response.content.length, {
        input: response.usage.inputTokens,
        output: response.usage.outputTokens
      })
    }).catch(err => console.error('[TemplateDecider] Log creation failed:', err));

    // Parse the template decision
    const decision = parseTemplateDecision(response.content);

    return { decision };
  }
};

export default templateDeciderStage;
