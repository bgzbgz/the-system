/**
 * Claude AI Provider
 * Spec: 019-ai-service-layer
 *
 * Anthropic Claude API integration using official SDK.
 * Uses Sonnet for complex tasks, Haiku for simpler ones (cost optimization).
 */

import Anthropic from '@anthropic-ai/sdk';
import type { AICompletionRequest, AICompletionResponse, IAIProvider } from './types';
import { AIServiceError } from './types';
import logger from '../../utils/logger';

// ========== CONSTANTS ==========

const CLAUDE_SONNET = 'claude-sonnet-4-20250514';  // For complex tasks (toolBuilder, QA)
const CLAUDE_HAIKU = 'claude-3-5-haiku-20241022';   // For simpler tasks (secretary, templateDecider)
const DEFAULT_MAX_TOKENS = 4096;
const DEFAULT_TIMEOUT_MS = 600000; // 10 minutes - toolBuilder with 16K output needs this
const MAX_RETRIES = 1;  // Retry once on timeout (with 10min timeout, 1 retry = 20min max)
const RETRY_DELAY_MS = 3000;  // 3 second delay between retries

// ========== CLAUDE PROVIDER ==========

export class ClaudeProvider implements IAIProvider {
  private client: Anthropic | null = null;
  private apiKey: string | undefined;

  constructor() {
    this.apiKey = process.env.ANTHROPIC_API_KEY;

    if (this.apiKey) {
      this.client = new Anthropic({
        apiKey: this.apiKey,
        timeout: DEFAULT_TIMEOUT_MS,
      });
    }
  }

  /**
   * Get provider identifier
   */
  getName(): 'claude' {
    return 'claude';
  }

  /**
   * Check if provider is configured and available
   */
  isAvailable(): boolean {
    return !!this.apiKey && !!this.client;
  }

  /**
   * Execute completion request using Claude API with retry logic
   * @param request - The completion request
   * @param useHaiku - Use Haiku model for simpler/cheaper tasks (default: false)
   */
  async complete(request: AICompletionRequest, useHaiku: boolean = false): Promise<AICompletionResponse> {
    if (!this.client) {
      throw new AIServiceError(
        'PROVIDER_UNAVAILABLE',
        'Claude client not initialized - ANTHROPIC_API_KEY not configured',
        'claude'
      );
    }

    const model = useHaiku ? CLAUDE_HAIKU : CLAUDE_SONNET;
    const startTime = Date.now();
    const promptLength = request.systemPrompt.length + request.userPrompt.length;

    // Log start
    logger.info('AI call started', {
      provider: 'claude',
      model,
      promptLength,
      maxTokens: request.maxTokens ?? DEFAULT_MAX_TOKENS,
    });

    let lastError: Error | null = null;

    // Retry loop for timeout errors
    for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
      try {
        const response = await this.client.messages.create({
          model,
          max_tokens: request.maxTokens ?? DEFAULT_MAX_TOKENS,
          system: request.systemPrompt,
          messages: [
            {
              role: 'user',
              content: request.userPrompt,
            },
          ],
        });

        const durationMs = Date.now() - startTime;

        // Extract content from response
        const content = response.content
          .filter((block) => block.type === 'text')
          .map((block) => (block as { type: 'text'; text: string }).text)
          .join('');

        // Extract token usage
        const usage = {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
        };

        // Log success
        logger.info('AI call completed', {
          provider: 'claude',
          model,
          durationMs,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          attempt,
        });

        return {
          content,
          model,
          provider: 'claude',
          usage,
          durationMs,
        };
      } catch (error) {
        lastError = error as Error;
        const errorMessage = error instanceof Error ? error.message : String(error);
        const isTimeout = errorMessage.toLowerCase().includes('timeout');
        const isRateLimit = errorMessage.includes('429') || errorMessage.toLowerCase().includes('rate');

        // Only retry on timeout or rate limit errors
        if ((isTimeout || isRateLimit) && attempt <= MAX_RETRIES) {
          const delay = RETRY_DELAY_MS * attempt; // Exponential-ish backoff
          logger.warn('AI call failed, retrying...', {
            provider: 'claude',
            model,
            error: errorMessage,
            attempt,
            maxRetries: MAX_RETRIES,
            retryDelayMs: delay,
          });
          await this.sleep(delay);
          continue;
        }

        // Log final error
        const durationMs = Date.now() - startTime;
        logger.error('AI call failed', {
          provider: 'claude',
          model,
          error: errorMessage,
          durationMs,
          attempt,
        });

        throw new AIServiceError('API_ERROR', `Claude API error: ${errorMessage}`, 'claude');
      }
    }

    // Should never reach here, but just in case
    throw new AIServiceError('API_ERROR', `Claude API error: ${lastError?.message || 'Unknown error'}`, 'claude');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
