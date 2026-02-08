/**
 * Example Generator Stage
 *
 * Creates realistic case studies and test scenarios for tools.
 */

import { aiService } from '../../ai';
import { getPrompt } from '../../../prompts';
import type {
  Stage,
  ExampleGeneratorInput,
  ExampleGeneratorOutput,
  PipelineContext
} from '../types';
import { createLog, generateSummary } from '../../logStore';

/**
 * Example Generator stage implementation
 */
export const exampleGeneratorStage: Stage<ExampleGeneratorInput, ExampleGeneratorOutput> = {
  name: 'exampleGenerator',

  async execute(input: ExampleGeneratorInput, context: PipelineContext): Promise<ExampleGeneratorOutput> {
    const prompt = getPrompt('exampleGenerator');

    // Build user message
    const userMessage = `TOOL SPECIFICATION:
- Tool Name: ${input.toolSpec.name}
- Decision: ${input.toolSpec.purpose}
- Inputs: ${input.toolSpec.inputs.map(i => `${i.label} (${i.type})`).join(', ')}
- Processing Logic: ${input.toolSpec.processingLogic}

Generate test scenarios and inspiring case studies for this tool.`;

    // Call Claude Haiku for example generation (cost optimized)
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
      stage: 'example-gen',
      provider: 'claude',
      model: response.model,
      prompt: `${prompt.systemPrompt}\n\n---\n\n${userMessage}`,
      response: response.content,
      input_tokens: response.usage.inputTokens,
      output_tokens: response.usage.outputTokens,
      duration_ms: duration,
      summary: generateSummary('example-gen', 'claude', response.content.length, {
        input: response.usage.inputTokens,
        output: response.usage.outputTokens
      })
    }).catch(err => console.error('[ExampleGenerator] Log creation failed:', err));

    // Parse the response
    let result: { testScenarios: ExampleGeneratorOutput['testScenarios']; caseStudies: ExampleGeneratorOutput['caseStudies'] };
    try {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (e) {
      console.warn('[ExampleGenerator] Failed to parse response, using defaults');
      result = {
        testScenarios: [
          {
            name: 'GO Scenario - Strong Case',
            inputs: {},
            expectedVerdict: 'GO',
            reasoning: 'All metrics exceed thresholds'
          },
          {
            name: 'NO-GO Scenario - Below Threshold',
            inputs: {},
            expectedVerdict: 'NO-GO',
            reasoning: 'Key metrics below minimum requirements'
          }
        ],
        caseStudies: [
          {
            id: 'cs1',
            title: 'How a Fast Track Client Applied This Tool',
            business: {
              name: 'Growth Business',
              location: 'London, UK',
              industry: 'Professional Services',
              size: '10-50 employees'
            },
            situation: {
              challenge: 'Needed clarity on a critical business decision',
              stakesDescription: 'Significant investment at stake'
            },
            application: {
              toolUsed: input.toolSpec.name,
              keyInputs: 'Business metrics',
              verdict: 'GO',
              decision: 'Proceeded with confidence'
            },
            results: {
              primaryMetric: { label: 'Revenue Impact', before: 'Uncertain', after: 'Clear path', improvement: 'Clarity gained' },
              secondaryMetric: { label: 'Time Saved', before: 'Weeks of analysis', after: 'Minutes', improvement: '95%' },
              timeframe: '3 months',
              quote: 'This tool gave me the clarity I needed to make the right decision.'
            }
          }
        ]
      };
    }

    return {
      testScenarios: result.testScenarios || [],
      caseStudies: result.caseStudies || []
    };
  }
};

export default exampleGeneratorStage;
