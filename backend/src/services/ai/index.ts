/**
 * AI Service Layer - Main Service
 * Spec: 019-ai-service-layer
 *
 * Unified service for Claude and Gemini AI providers.
 * Features:
 * - Automatic fallback from Claude to Gemini on failure
 * - Token limits per stage
 * - Cost tracking per request
 */

import type {
  AICompletionRequest,
  AICompletionResponse,
  AICompletionResponseWithCost,
  IAIProvider,
  AIProviderType
} from './types';
import {
  AIServiceError,
  TOKEN_COSTS,
  DEFAULT_TOKEN_LIMITS
} from './types';
import logger from '../../utils/logger';

// ========== AI SERVICE CLASS ==========

export class AIService {
  private claudeProvider: IAIProvider | null = null;
  private geminiProvider: IAIProvider | null = null;
  private initialized = false;

  /**
   * Initialize all AI providers at server startup
   * Logs warnings for missing API keys but does not throw
   */
  initialize(): void {
    if (this.initialized) {
      logger.warn('AI Service already initialized');
      return;
    }

    console.log('[Startup] AI Service initializing...');

    // Initialize Claude provider
    try {
      // Dynamic import to avoid loading SDK if key is missing
      const { ClaudeProvider } = require('./claude');
      this.claudeProvider = new ClaudeProvider();

      if (this.claudeProvider.isAvailable()) {
        console.log('[Startup] Claude AI provider initialized (model: claude-sonnet-4-20250514)');
      } else {
        console.log('[Startup] WARNING: ANTHROPIC_API_KEY not configured - Claude provider unavailable');
      }
    } catch (error) {
      console.log('[Startup] WARNING: Failed to initialize Claude provider:', error);
      this.claudeProvider = null;
    }

    // Initialize Gemini provider
    try {
      const { GeminiProvider } = require('./gemini');
      this.geminiProvider = new GeminiProvider();

      if (this.geminiProvider.isAvailable()) {
        console.log('[Startup] Gemini AI provider initialized (model: gemini-2.0-flash)');
      } else {
        console.log('[Startup] WARNING: GEMINI_API_KEY not configured - Gemini provider unavailable');
      }
    } catch (error) {
      console.log('[Startup] WARNING: Failed to initialize Gemini provider:', error);
      this.geminiProvider = null;
    }

    this.initialized = true;
    console.log('[Startup] AI Service initialization complete');
  }

  /**
   * Check if Claude provider is configured and available
   */
  hasClaudeAvailable(): boolean {
    return this.claudeProvider?.isAvailable() ?? false;
  }

  /**
   * Check if Gemini provider is configured and available
   */
  hasGeminiAvailable(): boolean {
    return this.geminiProvider?.isAvailable() ?? false;
  }

  /**
   * Check if AI service is configured (at least one provider available)
   * Used by routes for pre-flight checks
   */
  isConfigured(): boolean {
    return this.hasClaudeAvailable() || this.hasGeminiAvailable();
  }

  /**
   * Get the primary available provider
   */
  getPrimaryProvider(): AIProviderType | null {
    if (this.hasClaudeAvailable()) return 'claude';
    if (this.hasGeminiAvailable()) return 'gemini';
    return null;
  }

  /**
   * Execute completion request using Claude API
   * @throws AIServiceError if provider unavailable or API call fails
   */
  async callClaude(request: AICompletionRequest): Promise<AICompletionResponse> {
    if (!this.claudeProvider) {
      throw new AIServiceError(
        'PROVIDER_UNAVAILABLE',
        'Claude provider not initialized',
        'claude'
      );
    }

    if (!this.claudeProvider.isAvailable()) {
      throw new AIServiceError(
        'PROVIDER_UNAVAILABLE',
        'Claude provider not available - ANTHROPIC_API_KEY not configured',
        'claude'
      );
    }

    // Pass useHaiku option to provider (ClaudeProvider.complete accepts this as 2nd param)
    return (this.claudeProvider as any).complete(request, request.useHaiku ?? false);
  }

  /**
   * Execute completion request using Gemini API
   * @throws AIServiceError if provider unavailable or API call fails
   */
  async callGemini(request: AICompletionRequest): Promise<AICompletionResponse> {
    if (!this.geminiProvider) {
      throw new AIServiceError(
        'PROVIDER_UNAVAILABLE',
        'Gemini provider not initialized',
        'gemini'
      );
    }

    if (!this.geminiProvider.isAvailable()) {
      throw new AIServiceError(
        'PROVIDER_UNAVAILABLE',
        'Gemini provider not available - GEMINI_API_KEY not configured',
        'gemini'
      );
    }

    return this.geminiProvider.complete(request);
  }

  /**
   * Execute completion request using the specified provider
   * Routes to callClaude or callGemini based on request.provider
   * @throws AIServiceError if provider unavailable or API call fails
   */
  async complete(request: AICompletionRequest): Promise<AICompletionResponse> {
    if (request.provider === 'gemini') {
      return this.callGemini(request);
    }
    // Default to Claude
    return this.callClaude(request);
  }

  // ========== FALLBACK SUPPORT ==========

  /**
   * Execute completion with automatic fallback to Gemini if Claude fails
   * This is the recommended method for production use.
   *
   * @param request - Completion request
   * @param stage - Optional stage name for token limits
   * @returns Response with cost tracking and fallback info
   */
  async completeWithFallback(
    request: AICompletionRequest,
    stage?: string
  ): Promise<AICompletionResponseWithCost> {
    // Check token limits
    const limits = DEFAULT_TOKEN_LIMITS[stage as keyof typeof DEFAULT_TOKEN_LIMITS]
      || DEFAULT_TOKEN_LIMITS.default;

    const estimatedInputTokens = this.estimateTokens(
      request.systemPrompt + request.userPrompt
    );

    if (estimatedInputTokens > limits.maxInput) {
      throw new AIServiceError(
        'TOKEN_LIMIT_EXCEEDED',
        `Input exceeds token limit: ${estimatedInputTokens} > ${limits.maxInput} for stage ${stage || 'default'}`,
        'claude'
      );
    }

    // Apply output limit
    const maxTokens = Math.min(request.maxTokens || limits.maxOutput, limits.maxOutput);
    const limitedRequest = { ...request, maxTokens };

    let response: AICompletionResponse;
    let usedFallback = false;
    let originalProvider: AIProviderType | undefined;

    // Try Claude first
    if (this.hasClaudeAvailable()) {
      try {
        logger.info('AI call starting', { provider: 'claude', stage, estimatedInputTokens });
        response = await this.callClaude(limitedRequest);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.warn('Claude failed, falling back to Gemini', {
          stage,
          error: errorMsg
        });

        // Fallback to Gemini
        if (this.hasGeminiAvailable()) {
          originalProvider = 'claude';
          usedFallback = true;
          response = await this.callGemini(limitedRequest);
        } else {
          throw error; // Re-throw if no fallback available
        }
      }
    } else if (this.hasGeminiAvailable()) {
      // Claude not available, use Gemini directly
      logger.info('Claude unavailable, using Gemini', { stage });
      response = await this.callGemini(limitedRequest);
    } else {
      throw new AIServiceError(
        'PROVIDER_UNAVAILABLE',
        'No AI providers available',
        undefined
      );
    }

    // Calculate cost
    const estimatedCostUsd = this.calculateCost(
      response.model,
      response.usage.inputTokens,
      response.usage.outputTokens
    );

    // Log cost
    logger.info('AI call completed', {
      provider: response.provider,
      stage,
      inputTokens: response.usage.inputTokens,
      outputTokens: response.usage.outputTokens,
      costUsd: estimatedCostUsd.toFixed(6),
      usedFallback,
      durationMs: response.durationMs
    });

    return {
      ...response,
      estimatedCostUsd,
      usedFallback,
      originalProvider
    };
  }

  // ========== TOKEN & COST UTILITIES ==========

  /**
   * Estimate token count from text (rough approximation)
   * ~4 chars per token for English text
   */
  estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Calculate cost in USD for a completion
   */
  calculateCost(model: string, inputTokens: number, outputTokens: number): number {
    const costs = TOKEN_COSTS[model] || TOKEN_COSTS['gemini-2.0-flash']; // Default to cheapest
    const inputCost = (inputTokens / 1_000_000) * costs.input;
    const outputCost = (outputTokens / 1_000_000) * costs.output;
    return inputCost + outputCost;
  }

  /**
   * Get token limits for a specific stage
   */
  getTokenLimits(stage: string): { maxInput: number; maxOutput: number } {
    return DEFAULT_TOKEN_LIMITS[stage as keyof typeof DEFAULT_TOKEN_LIMITS]
      || DEFAULT_TOKEN_LIMITS.default;
  }
}

// ========== SINGLETON EXPORT ==========

export const aiService = new AIService();

// Re-export types for convenience
export * from './types';
