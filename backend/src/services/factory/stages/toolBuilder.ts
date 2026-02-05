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

    // Build the full system prompt with context
    const systemPrompt = `${prompt.systemPrompt}\n\n## Quality Criteria\n\n${criteriaContext}`;

    // Build user message with tool spec and optional template
    let userMessage = `## Tool Specification\n\n${JSON.stringify(input.toolSpec, null, 2)}`;

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

    // Multi-phase wizard detection (019-multistep-wizard-tools)
    const isWizardMode = isMultiPhaseSpec(input.toolSpec);
    if (isWizardMode) {
      userMessage += `\n\n## MULTI-PHASE WIZARD MODE DETECTED

⚠️ This tool has ${input.toolSpec.phases!.length} phases defined. Generate WIZARD MODE HTML, not typeform-style slides.

### Phase Configuration:
${JSON.stringify(input.toolSpec.phases, null, 2)}

### Default Phase Path:
${JSON.stringify(input.toolSpec.defaultPhasePath || input.toolSpec.phases!.map(p => p.id), null, 2)}

### WIZARD MODE REQUIREMENTS:
1. Generate phase-based navigation (not slide-based)
2. Each phase shows only its assigned inputs
3. Show summary screen after each phase completion
4. Display teaching moments when expertWisdom matches phase tags
5. Implement branch condition evaluation for adaptive paths
6. Show rich 5-section results at the end
7. Use sessionStorage for wizard state persistence (30-min timeout)
8. Backward navigation must preserve all input data`;
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
    const response = await aiService.callClaude({
      systemPrompt,
      userPrompt: userMessage,
      maxTokens: 8192 // Reduced from 16K - 8K is enough for most HTML tools
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
