/**
 * Tool Builder Stage
 * Spec: 021-tool-factory-engine (US3)
 *
 * Generates complete single-file HTML tools from specifications.
 * Includes brand colors and required structure per Fast Track guidelines.
 */

import { aiService } from '../../ai';
import { getPrompt } from '../../../prompts';
import { loadContext } from '../../../context';
import { extractHTML, validateHTMLStructure } from '../parser';
import type {
  Stage,
  ToolBuilderInput,
  ToolBuilderOutput,
  PipelineContext
} from '../types';
import { createLog, generateSummary } from '../../logStore';

/**
 * Tool Builder stage implementation
 */
export const toolBuilderStage: Stage<ToolBuilderInput, ToolBuilderOutput> = {
  name: 'toolBuilder',

  async execute(input: ToolBuilderInput, context: PipelineContext): Promise<ToolBuilderOutput> {
    // Get tool builder prompt and criteria context
    const prompt = getPrompt('toolBuilder');
    const criteriaContext = loadContext('criteria');

    // Build the full system prompt with context
    const systemPrompt = `${prompt.systemPrompt}\n\n## Quality Criteria\n\n${criteriaContext}`;

    // Build user message with tool spec and optional template
    let userMessage = `## Tool Specification\n\n${JSON.stringify(input.toolSpec, null, 2)}`;

    if (input.template) {
      userMessage += `\n\n## Template Pattern\n\nUse the ${input.template} template pattern for this tool.`;
    }

    // Call Claude to generate HTML
    const startTime = Date.now();
    const response = await aiService.callClaude({
      systemPrompt,
      userPrompt: userMessage,
      maxTokens: 8192 // Larger limit for HTML generation
    });
    const duration = Date.now() - startTime;

    // Fire-and-forget: Log the AI call (spec 024-agent-reasoning-logs)
    createLog({
      job_id: context.jobId,
      stage: 'tool-build',
      provider: 'claude',
      model: response.model,
      prompt: `${systemPrompt}\n\n---\n\n${userMessage}`,
      response: response.content,
      input_tokens: response.usage.inputTokens,
      output_tokens: response.usage.outputTokens,
      duration_ms: duration,
      summary: generateSummary('tool-build', 'claude', response.content.length, {
        input: response.usage.inputTokens,
        output: response.usage.outputTokens
      })
    }).catch(err => console.error('[ToolBuilder] Log creation failed:', err));

    // Extract HTML from response
    const html = extractHTML(response.content);

    // Validate HTML structure
    if (!validateHTMLStructure(html)) {
      throw new Error('Generated HTML missing required structure (html, head, body tags)');
    }

    return { html };
  }
};

export default toolBuilderStage;
