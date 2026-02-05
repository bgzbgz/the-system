/**
 * Audience Profiler Stage
 *
 * Analyzes target user to tailor tool language, complexity, and UX.
 */

import { aiService } from '../../ai';
import { getPrompt } from '../../../prompts';
import type {
  Stage,
  AudienceProfilerInput,
  AudienceProfilerOutput,
  PipelineContext
} from '../types';
import { createLog, generateSummary } from '../../logStore';

/**
 * Audience Profiler stage implementation
 */
export const audienceProfilerStage: Stage<AudienceProfilerInput, AudienceProfilerOutput> = {
  name: 'audienceProfiler',

  async execute(input: AudienceProfilerInput, context: PipelineContext): Promise<AudienceProfilerOutput> {
    const prompt = getPrompt('audienceProfiler');

    // Build user message
    const userMessage = `TOOL SPECIFICATION:
- Tool Name: ${input.toolSpec.name}
- Decision: ${input.toolSpec.purpose}
- Inputs: ${input.toolSpec.inputs.map(i => i.label).join(', ')}

CONTENT CONTEXT:
${input.contentSummary}

Create a detailed audience profile for the users of this tool.`;

    // Call Claude Haiku for simple profiling (faster & cheaper)
    const startTime = Date.now();
    const response = await aiService.callClaude({
      systemPrompt: prompt.systemPrompt,
      userPrompt: userMessage,
      maxTokens: 1024,
      useHaiku: true  // Use Haiku for simple analysis tasks
    });
    const duration = Date.now() - startTime;

    // Log the AI call
    createLog({
      job_id: context.jobId,
      stage: 'audience-profile',
      provider: 'claude',
      model: response.model,
      prompt: `${prompt.systemPrompt}\n\n---\n\n${userMessage}`,
      response: response.content,
      input_tokens: response.usage.inputTokens,
      output_tokens: response.usage.outputTokens,
      duration_ms: duration,
      summary: generateSummary('audience-profile', 'claude', response.content.length, {
        input: response.usage.inputTokens,
        output: response.usage.outputTokens
      })
    }).catch(err => console.error('[AudienceProfiler] Log creation failed:', err));

    // Parse the response
    let profile: AudienceProfilerOutput['profile'];
    try {
      // Try to extract JSON from the response
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        profile = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (e) {
      // Default profile if parsing fails
      console.warn('[AudienceProfiler] Failed to parse response, using defaults');
      profile = {
        primaryPersona: {
          name: 'Growth-Stage Entrepreneur',
          businessStage: 'GROWTH',
          decisionStyle: 'DATA_DRIVEN',
          timePressure: 'PLANNING',
          technicalComfort: 'NUMBERS_AWARE',
          emotionalState: 'UNCERTAIN',
          quote: 'I need to make the right call here.'
        },
        languageGuidelines: {
          tone: 'Direct and supportive',
          complexity: 'MEDIUM',
          jargonLevel: 'Business-friendly, avoid technical terms',
          examplesStyle: 'Revenue and profit numbers'
        },
        uxRecommendations: {
          inputStyle: 'Number inputs with clear labels',
          resultFormat: 'Single verdict with supporting data',
          commitmentLevel: 'Standard',
          helpTextDensity: 'MODERATE'
        },
        redFlags: ['Overly complex inputs', 'Jargon-heavy labels', 'Unclear verdicts']
      };
    }

    return { profile };
  }
};

export default audienceProfilerStage;
