/**
 * AI Service Layer - Shared Types
 * Spec: 019-ai-service-layer
 *
 * TypeScript types for AI completion requests and responses.
 */

// ========== PROVIDER TYPE ==========

export type AIProviderType = 'claude' | 'gemini';

// ========== REQUEST/RESPONSE TYPES ==========

/**
 * Request payload for AI completion calls
 */
export interface AICompletionRequest {
  /** System instructions for the AI */
  systemPrompt: string;
  /** User message/prompt content */
  userPrompt: string;
  /** Maximum tokens in response (default: 4096) */
  maxTokens?: number;
  /** AI provider to use (default: 'claude') */
  provider?: AIProviderType;
}

/**
 * Token consumption tracking
 */
export interface TokenUsage {
  /** Tokens in the prompt */
  inputTokens: number;
  /** Tokens in the response */
  outputTokens: number;
}

/**
 * Response from AI completion calls
 */
export interface AICompletionResponse {
  /** Generated text response */
  content: string;
  /** Model used (e.g., "claude-sonnet-4-20250514") */
  model: string;
  /** AI provider identifier */
  provider: AIProviderType;
  /** Token consumption details */
  usage: TokenUsage;
  /** Request duration in milliseconds */
  durationMs: number;
}

// ========== PROVIDER INTERFACE ==========

/**
 * Abstract interface for AI provider implementations
 */
export interface IAIProvider {
  /** Execute completion request */
  complete(request: AICompletionRequest): Promise<AICompletionResponse>;
  /** Get provider identifier */
  getName(): AIProviderType;
  /** Check if provider is configured and available */
  isAvailable(): boolean;
}

// ========== ERROR TYPES ==========

export type AIErrorCode = 'PROVIDER_UNAVAILABLE' | 'API_ERROR' | 'TIMEOUT';

/**
 * Custom error for AI service failures
 */
export class AIServiceError extends Error {
  constructor(
    public code: AIErrorCode,
    message: string,
    public provider?: AIProviderType
  ) {
    super(message);
    this.name = 'AIServiceError';
  }
}
