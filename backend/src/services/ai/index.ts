/**
 * AI Service Layer - Main Service
 * Spec: 019-ai-service-layer
 *
 * Unified service for Claude and Gemini AI providers.
 * Provides a single interface for all AI operations.
 */

import type { AICompletionRequest, AICompletionResponse, IAIProvider } from './types';
import { AIServiceError } from './types';
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
   * Check if AI service is configured (at least Claude available)
   * Used by routes for pre-flight checks
   */
  isConfigured(): boolean {
    return this.hasClaudeAvailable();
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

    return this.claudeProvider.complete(request);
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
}

// ========== SINGLETON EXPORT ==========

export const aiService = new AIService();

// Re-export types for convenience
export * from './types';
