/**
 * Secretary Stage
 * Spec: 021-tool-factory-engine (US2)
 *
 * Extracts structured tool specifications from natural language requests.
 * Returns ToolSpec on success or ClarificationRequest if more info needed.
 */

import { aiService } from '../../ai';
import { getPrompt } from '../../../prompts';
import { loadContext } from '../../../context';
import { parseSecretaryResponse } from '../parser';
import { isClarificationRequest } from '../../../prompts/types';
import type {
  Stage,
  SecretaryInput,
  SecretaryOutput,
  PipelineContext
} from '../types';
import { createLog, generateSummary } from '../../logStore';

/**
 * Secretary stage implementation
 */
export const secretaryStage: Stage<SecretaryInput, SecretaryOutput> = {
  name: 'secretary',

  async execute(input: SecretaryInput, context: PipelineContext): Promise<SecretaryOutput> {
    // Get secretary prompt and approach context
    const prompt = getPrompt('secretary');
    const approachContext = loadContext('approach');

    // Build the full system prompt with context
    const systemPrompt = `${prompt.systemPrompt}\n\n## Fast Track Approach\n\n${approachContext}`;

    // Call Claude Haiku for simple extraction (faster & cheaper)
    const startTime = Date.now();
    const response = await aiService.callClaude({
      systemPrompt,
      userPrompt: input.userRequest,
      maxTokens: 2048,
      useHaiku: true  // Use Haiku for simple extraction tasks
    });
    const duration = Date.now() - startTime;

    // Fire-and-forget: Log the AI call (spec 024-agent-reasoning-logs)
    createLog({
      job_id: context.jobId,
      stage: 'secretary',
      provider: 'claude',
      model: response.model,
      prompt: `${systemPrompt}\n\n---\n\n${input.userRequest}`,
      response: response.content,
      input_tokens: response.usage.inputTokens,
      output_tokens: response.usage.outputTokens,
      duration_ms: duration,
      summary: generateSummary('secretary', 'claude', response.content.length, {
        input: response.usage.inputTokens,
        output: response.usage.outputTokens
      })
    }).catch(err => console.error('[Secretary] Log creation failed:', err));

    // Parse the response
    const parsed = parseSecretaryResponse(response.content);

    // Check if it's a clarification request
    if (isClarificationRequest(parsed)) {
      return {
        type: 'clarification',
        clarificationRequest: parsed
      };
    }

    // Return extracted ToolSpec
    return {
      type: 'spec',
      toolSpec: parsed
    };
  }
};

export default secretaryStage;
