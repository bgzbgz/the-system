/**
 * Copy Writer Stage
 *
 * Writes compelling microcopy for tools in Fast Track voice.
 */

import { aiService } from '../../ai';
import { getPrompt } from '../../../prompts';
import type {
  Stage,
  CopyWriterInput,
  CopyWriterOutput,
  PipelineContext
} from '../types';
import { createLog, generateSummary } from '../../logStore';

/**
 * Copy Writer stage implementation
 */
export const copyWriterStage: Stage<CopyWriterInput, CopyWriterOutput> = {
  name: 'copyWriter',

  async execute(input: CopyWriterInput, context: PipelineContext): Promise<CopyWriterOutput> {
    const prompt = getPrompt('copyWriter');

    // Build user message
    const userMessage = `TOOL SPECIFICATION:
- Tool Name: ${input.toolSpec.name}
- Decision: ${input.toolSpec.purpose}
- Inputs: ${input.toolSpec.inputs.map(i => `${i.name}: ${i.label} (${i.type}${i.required ? ', required' : ''})`).join('\n')}
- Processing Logic: ${input.toolSpec.processingLogic}

Write all microcopy for this tool in Fast Track voice.`;

    // Call Claude Haiku for copy writing (cost optimized)
    const startTime = Date.now();
    const response = await aiService.callClaude({
      systemPrompt: prompt.systemPrompt,
      userPrompt: userMessage,
      maxTokens: 2048,
      useHaiku: true
    });
    const duration = Date.now() - startTime;

    // Log the AI call
    createLog({
      job_id: context.jobId,
      stage: 'copy-write',
      provider: 'claude',
      model: response.model,
      prompt: `${prompt.systemPrompt}\n\n---\n\n${userMessage}`,
      response: response.content,
      input_tokens: response.usage.inputTokens,
      output_tokens: response.usage.outputTokens,
      duration_ms: duration,
      summary: generateSummary('copy-write', 'claude', response.content.length, {
        input: response.usage.inputTokens,
        output: response.usage.outputTokens
      })
    }).catch(err => console.error('[CopyWriter] Log creation failed:', err));

    // Parse the response
    let copy: CopyWriterOutput['copy'];
    try {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        copy = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (e) {
      console.warn('[CopyWriter] Failed to parse response, using defaults');
      copy = {
        toolTitle: `THE ${input.toolSpec.name.toUpperCase()}`,
        toolSubtitle: input.toolSpec.purpose,
        fieldLabels: {},
        progressMessages: [
          'Getting started...',
          'Looking good...',
          'Almost there...',
          'Ready for your verdict.'
        ],
        verdicts: {
          go: {
            headline: 'GO',
            subtext: 'The numbers support this decision.',
            nextStep: 'Take action now.'
          },
          noGo: {
            headline: 'NO-GO',
            subtext: 'The numbers don\'t support this decision.',
            alternative: 'Consider an alternative approach.'
          }
        },
        commitment: {
          headline: 'LOCK IN YOUR DECISION',
          whoLabel: 'WHO WILL OWN THIS?',
          whatLabel: 'WHAT SPECIFIC ACTION?',
          whenLabel: 'BY WHEN?'
        },
        cta: {
          primary: 'GET MY VERDICT',
          secondary: 'CLEAR FORM',
          share: 'SHARE MY DECISION'
        }
      };
    }

    return { copy };
  }
};

export default copyWriterStage;
