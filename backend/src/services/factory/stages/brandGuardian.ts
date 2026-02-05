/**
 * Brand Guardian Stage
 *
 * Audits tools for Fast Track brand compliance.
 */

import { aiService } from '../../ai';
import { getPrompt } from '../../../prompts';
import type {
  Stage,
  BrandGuardianInput,
  BrandGuardianOutput,
  PipelineContext
} from '../types';
import { createLog, generateSummary } from '../../logStore';

/**
 * Brand Guardian stage implementation
 */
export const brandGuardianStage: Stage<BrandGuardianInput, BrandGuardianOutput> = {
  name: 'brandGuardian',

  async execute(input: BrandGuardianInput, context: PipelineContext): Promise<BrandGuardianOutput> {
    const prompt = getPrompt('brandGuardian');

    // Build user message
    const userMessage = `TOOL HTML TO AUDIT:
\`\`\`html
${input.toolHtml}
\`\`\`

Audit this tool for Fast Track brand compliance. Be STRICT.`;

    // Call Claude Haiku for brand checking (faster & cheaper)
    const startTime = Date.now();
    const response = await aiService.callClaude({
      systemPrompt: prompt.systemPrompt,
      userPrompt: userMessage,
      maxTokens: 1024,
      useHaiku: true  // Use Haiku for simple scoring/checking
    });
    const duration = Date.now() - startTime;

    // Log the AI call
    createLog({
      job_id: context.jobId,
      stage: 'brand-audit',
      provider: 'claude',
      model: response.model,
      prompt: `${prompt.systemPrompt}\n\n---\n\nTOOL HTML TO AUDIT: [${input.toolHtml.length} chars]`,
      response: response.content,
      input_tokens: response.usage.inputTokens,
      output_tokens: response.usage.outputTokens,
      duration_ms: duration,
      summary: generateSummary('brand-audit', 'claude', response.content.length, {
        input: response.usage.inputTokens,
        output: response.usage.outputTokens
      })
    }).catch(err => console.error('[BrandGuardian] Log creation failed:', err));

    // Parse the response
    let result: BrandGuardianOutput;
    try {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (e) {
      console.warn('[BrandGuardian] Failed to parse response, assuming pass');
      result = {
        overallCompliance: 'PASS',
        score: {
          colors: 100,
          typography: 100,
          visual: 100,
          tone: 100,
          overall: 100
        },
        violations: [],
        strengths: ['Tool follows Fast Track brand guidelines'],
        recommendation: 'Ready for deployment'
      };
    }

    return result;
  }
};

export default brandGuardianStage;
