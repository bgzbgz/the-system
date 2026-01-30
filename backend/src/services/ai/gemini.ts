/**
 * Gemini AI Provider
 * Spec: 019-ai-service-layer
 *
 * Google Gemini API integration using official SDK.
 * Model: gemini-2.0-flash (fast, cost-effective for QA validation)
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import type { AICompletionRequest, AICompletionResponse, IAIProvider } from './types';
import { AIServiceError } from './types';
import logger from '../../utils/logger';

// ========== CONSTANTS ==========

const GEMINI_MODEL = 'gemini-2.0-flash';
const DEFAULT_MAX_TOKENS = 4096;

// ========== GEMINI PROVIDER ==========

export class GeminiProvider implements IAIProvider {
  private client: GoogleGenerativeAI | null = null;
  private apiKey: string | undefined;

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;

    if (this.apiKey) {
      this.client = new GoogleGenerativeAI(this.apiKey);
    }
  }

  /**
   * Get provider identifier
   */
  getName(): 'gemini' {
    return 'gemini';
  }

  /**
   * Check if provider is configured and available
   */
  isAvailable(): boolean {
    return !!this.apiKey && !!this.client;
  }

  /**
   * Execute completion request using Gemini API
   */
  async complete(request: AICompletionRequest): Promise<AICompletionResponse> {
    if (!this.client) {
      throw new AIServiceError(
        'PROVIDER_UNAVAILABLE',
        'Gemini client not initialized - GEMINI_API_KEY not configured',
        'gemini'
      );
    }

    const startTime = Date.now();
    const promptLength = request.systemPrompt.length + request.userPrompt.length;

    // Log start
    logger.info('AI call started', {
      provider: 'gemini',
      model: GEMINI_MODEL,
      promptLength,
    });

    try {
      const model = this.client.getGenerativeModel({
        model: GEMINI_MODEL,
        systemInstruction: request.systemPrompt,
        generationConfig: {
          maxOutputTokens: request.maxTokens ?? DEFAULT_MAX_TOKENS,
        },
      });

      const result = await model.generateContent({
        contents: [
          {
            role: 'user',
            parts: [{ text: request.userPrompt }],
          },
        ],
      });

      const durationMs = Date.now() - startTime;

      // Extract content from response
      const response = result.response;
      const content = response.text();

      // Extract token usage (Gemini provides this in usageMetadata)
      const usageMetadata = response.usageMetadata;
      const usage = {
        inputTokens: usageMetadata?.promptTokenCount ?? 0,
        outputTokens: usageMetadata?.candidatesTokenCount ?? 0,
      };

      // Log success
      logger.info('AI call completed', {
        provider: 'gemini',
        model: GEMINI_MODEL,
        durationMs,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
      });

      return {
        content,
        model: GEMINI_MODEL,
        provider: 'gemini',
        usage,
        durationMs,
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Log error
      logger.error('AI call failed', {
        provider: 'gemini',
        model: GEMINI_MODEL,
        error: errorMessage,
        durationMs,
      });

      // Re-throw as AIServiceError
      throw new AIServiceError('API_ERROR', `Gemini API error: ${errorMessage}`, 'gemini');
    }
  }
}
