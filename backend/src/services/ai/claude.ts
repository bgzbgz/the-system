/**
 * Claude AI Provider
 * Spec: 019-ai-service-layer
 *
 * Anthropic Claude API integration using official SDK.
 * Model: claude-sonnet-4-20250514 (balanced capability/cost)
 */

import Anthropic from '@anthropic-ai/sdk';
import type { AICompletionRequest, AICompletionResponse, IAIProvider } from './types';
import { AIServiceError } from './types';
import logger from '../../utils/logger';

// ========== CONSTANTS ==========

const CLAUDE_MODEL = 'claude-sonnet-4-20250514';
const DEFAULT_MAX_TOKENS = 4096;
const DEFAULT_TIMEOUT_MS = 300000; // 5 minutes timeout for API calls (increased for large HTML generation)

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
   * Execute completion request using Claude API
   */
  async complete(request: AICompletionRequest): Promise<AICompletionResponse> {
    if (!this.client) {
      throw new AIServiceError(
        'PROVIDER_UNAVAILABLE',
        'Claude client not initialized - ANTHROPIC_API_KEY not configured',
        'claude'
      );
    }

    const startTime = Date.now();
    const promptLength = request.systemPrompt.length + request.userPrompt.length;

    // Log start
    logger.info('AI call started', {
      provider: 'claude',
      model: CLAUDE_MODEL,
      promptLength,
    });

    try {
      const response = await this.client.messages.create({
        model: CLAUDE_MODEL,
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
        model: CLAUDE_MODEL,
        durationMs,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
      });

      return {
        content,
        model: CLAUDE_MODEL,
        provider: 'claude',
        usage,
        durationMs,
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Log error
      logger.error('AI call failed', {
        provider: 'claude',
        model: CLAUDE_MODEL,
        error: errorMessage,
        durationMs,
      });

      // Re-throw as AIServiceError
      throw new AIServiceError('API_ERROR', `Claude API error: ${errorMessage}`, 'claude');
    }
  }
}
