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
  /** Use faster/cheaper model (Haiku) for simpler tasks (default: false) */
  useHaiku?: boolean;
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

export type AIErrorCode = 'PROVIDER_UNAVAILABLE' | 'API_ERROR' | 'TIMEOUT' | 'TOKEN_LIMIT_EXCEEDED';

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

// ========== TOKEN & COST TRACKING ==========

/**
 * Cost per 1M tokens by provider and model (in USD)
 * Updated: 2026-02
 */
export const TOKEN_COSTS: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-20250514': { input: 3.00, output: 15.00 },
  'claude-3-5-haiku-20241022': { input: 0.80, output: 4.00 },  // ~4x cheaper than Sonnet
  'claude-opus-4-20250514': { input: 15.00, output: 75.00 },
  'gemini-2.0-flash': { input: 0.075, output: 0.30 },
  'gemini-2.0-pro': { input: 1.25, output: 5.00 },
};

/**
 * Default token limits per stage (optimized for cost)
 */
export const DEFAULT_TOKEN_LIMITS = {
  secretary: { maxInput: 50000, maxOutput: 2048 },      // Simple extraction - use Haiku
  courseProcessor: { maxInput: 100000, maxOutput: 4096 },
  exampleGenerator: { maxInput: 20000, maxOutput: 4096 },
  copyWriter: { maxInput: 20000, maxOutput: 2048 },
  toolBuilder: { maxInput: 50000, maxOutput: 8192 },    // Reduced from 16K - 8K is enough for HTML
  qaDepartment: { maxInput: 50000, maxOutput: 2048 },
  feedbackApplier: { maxInput: 50000, maxOutput: 8192 },
  brandGuardian: { maxInput: 50000, maxOutput: 1024 },  // Simple scoring - use Haiku
  templateDecider: { maxInput: 20000, maxOutput: 512 }, // Very simple - use Haiku
  default: { maxInput: 50000, maxOutput: 4096 },
};

/**
 * Extended response with cost tracking
 */
export interface AICompletionResponseWithCost extends AICompletionResponse {
  /** Estimated cost in USD */
  estimatedCostUsd: number;
  /** Whether fallback was used */
  usedFallback: boolean;
  /** Original provider if fallback was used */
  originalProvider?: AIProviderType;
}
