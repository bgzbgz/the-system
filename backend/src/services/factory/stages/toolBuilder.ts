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
  PipelineContext,
  BuilderContext
} from '../types';
import { ToolSpec, isMultiPhaseSpec } from '../../../prompts/types';
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

    // Detect mode early to optimize prompt
    const isWizardMode = isMultiPhaseSpec(input.toolSpec);

    // Build the full system prompt with context
    // Use compact mode-specific prompt to reduce token usage
    const systemPrompt = `${prompt.systemPrompt}\n\n## Quality Criteria\n\n${criteriaContext}`;

    // Build user message with tool spec - use compact JSON to reduce tokens
    // Remove internal fields that don't need to go to the AI
    const cleanSpec = { ...input.toolSpec };
    delete (cleanSpec as Record<string, unknown>)._outputFixInstructions;
    delete (cleanSpec as Record<string, unknown>)._builderContext;

    let userMessage = `## Tool Specification\n\n${JSON.stringify(cleanSpec)}`;

    console.log(`[ToolBuilder] Starting generation for job ${context.jobId}, mode: ${isWizardMode ? 'WIZARD' : 'CLASSIC'}, spec size: ${userMessage.length} chars`);

    // Extract BuilderContext if available (from course-based tools)
    const toolSpecWithContext = input.toolSpec as ToolSpec & { _builderContext?: BuilderContext };
    const builderContext = toolSpecWithContext._builderContext;

    if (builderContext) {
      userMessage += `\n\n## BUILDER CONTEXT (MANDATORY - USE THIS DATA)\n\n⚠️ This is validated course content. ALL items below MUST appear in the generated HTML:\n\n${JSON.stringify(builderContext, null, 2)}

### CHECKLIST FOR BUILDER CONTEXT:
- [ ] Each frameworkItem becomes ONE question slide with EXACT label
- [ ] Each terminology term appears in labels/help text as specified
- [ ] Expert quote (if present) appears in results section with attribution
- [ ] Checklist items (if present) appear in results section
- [ ] Calculation formula is implemented in JavaScript
- [ ] Verdict criteria (go/noGo) drive the verdict display`;
    }

    // Multi-phase wizard mode - include phase config (already in cleanSpec)
    if (isWizardMode) {
      userMessage += `\n\n## MULTI-PHASE WIZARD MODE

⚠️ Generate WIZARD MODE HTML with ${input.toolSpec.phases!.length} phases.
Requirements: phase-based nav, summary screens, teaching moments, sessionStorage state, branch conditions.`;
    }

    if (input.template) {
      userMessage += `\n\n## Template Pattern\n\nUse the ${input.template} template pattern for this tool.`;
    }

    // Fix #1: Handle output fix instructions from validation retry
    if (input.toolSpec._outputFixInstructions) {
      userMessage += `\n\n## ⚠️ OUTPUT VALIDATION FIX REQUIRED

The previous HTML generation failed output validation. The following issues MUST be fixed in this regeneration:

${input.toolSpec._outputFixInstructions}

CRITICAL: Do NOT skip or genericize any of the items listed above. Each one MUST appear verbatim in the generated HTML.`;
    }

    // Call Claude to generate HTML
    const startTime = Date.now();
    const totalPromptSize = systemPrompt.length + userMessage.length;
    console.log(`[ToolBuilder] AI call starting, total prompt: ${totalPromptSize} chars (~${Math.round(totalPromptSize / 4)} tokens), maxTokens: 16384`);

    let response;
    try {
      response = await aiService.callClaude({
        systemPrompt,
        userPrompt: userMessage,
        maxTokens: 16384 // Full token limit for high-quality HTML generation
      });
    } catch (error) {
      const elapsed = Date.now() - startTime;
      console.error(`[ToolBuilder] AI call failed after ${Math.round(elapsed / 1000)}s:`, error instanceof Error ? error.message : error);
      throw error;
    }
    const duration = Date.now() - startTime;
    console.log(`[ToolBuilder] AI call completed in ${Math.round(duration / 1000)}s, output: ${response.content.length} chars`);

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
