/**
 * GitHub Deploy Service - Octokit Client Wrapper
 * Spec: 022-github-deploy-service
 * Per research.md RT-001, RT-003, RT-006
 *
 * Provides Octokit client with retry logic and error classification
 * SECURITY: Token is never logged (NFR-003)
 */

import { Octokit } from '@octokit/rest';
import { GitHubConfig, GitHubError, GitHubErrorType } from './types';

// ========== CONSTANTS ==========

const DEFAULT_BRANCH = 'main';
const DEFAULT_WORKFLOW_FILE = 'create-tool-collection.yml';
const MAX_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 10000;

// ========== CONFIGURATION ==========

/**
 * Get GitHub configuration from environment
 * Per quickstart.md: GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO, GITHUB_BRANCH
 *
 * @returns GitHubConfig or null if required values missing
 */
export function getGitHubConfig(): GitHubConfig | null {
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;

  if (!token || !owner || !repo) {
    return null;
  }

  return {
    token,
    owner,
    repo,
    branch: process.env.GITHUB_BRANCH || DEFAULT_BRANCH,
    workflowFile: DEFAULT_WORKFLOW_FILE
  };
}

/**
 * Check if GitHub service is configured
 */
export function isGitHubConfigured(): boolean {
  return getGitHubConfig() !== null;
}

// ========== OCTOKIT CLIENT ==========

let octokitInstance: Octokit | null = null;

/**
 * Get or create Octokit client instance
 * SECURITY: Token is used for auth but never logged
 *
 * @returns Octokit instance or null if not configured
 */
export function getOctokit(): Octokit | null {
  const config = getGitHubConfig();
  if (!config) {
    return null;
  }

  if (!octokitInstance) {
    octokitInstance = new Octokit({
      auth: config.token
    });
  }

  return octokitInstance;
}

/**
 * Reset Octokit instance (for testing or config changes)
 */
export function resetOctokit(): void {
  octokitInstance = null;
}

// ========== ERROR CLASSIFICATION ==========

/**
 * Classify a GitHub API error
 * Per research.md RT-006: Error Classification
 *
 * @param error - The caught error
 * @returns Classified GitHubError
 */
export function classifyError(error: unknown): GitHubError {
  const message = error instanceof Error ? error.message : String(error);

  // Check for Octokit errors with status
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status: number }).status;

    switch (status) {
      case 401:
        return {
          type: GitHubErrorType.AUTH_ERROR,
          message: 'GitHub authentication failed. Check GITHUB_TOKEN configuration.',
          status,
          retryable: false
        };

      case 403:
        // Could be rate limit or permission denied
        if (message.toLowerCase().includes('rate limit')) {
          return {
            type: GitHubErrorType.RATE_LIMIT,
            message: 'GitHub API rate limit exceeded.',
            status,
            retryable: true
          };
        }
        return {
          type: GitHubErrorType.AUTH_ERROR,
          message: 'GitHub permission denied. Check token scopes.',
          status,
          retryable: false
        };

      case 404:
        return {
          type: GitHubErrorType.NOT_FOUND,
          message: message || 'Resource not found.',
          status,
          retryable: false
        };

      case 422:
        return {
          type: GitHubErrorType.VALIDATION_ERROR,
          message: message || 'Validation failed.',
          status,
          retryable: false
        };

      case 429:
        return {
          type: GitHubErrorType.RATE_LIMIT,
          message: 'GitHub API rate limit exceeded.',
          status,
          retryable: true
        };

      default:
        if (status >= 500) {
          return {
            type: GitHubErrorType.SERVER_ERROR,
            message: 'GitHub server error.',
            status,
            retryable: true
          };
        }
    }
  }

  // Check for network errors
  if (
    message.toLowerCase().includes('network') ||
    message.toLowerCase().includes('timeout') ||
    message.toLowerCase().includes('econnreset') ||
    message.toLowerCase().includes('enotfound')
  ) {
    return {
      type: GitHubErrorType.NETWORK_ERROR,
      message: 'Network error connecting to GitHub.',
      retryable: true
    };
  }

  return {
    type: GitHubErrorType.UNKNOWN,
    message,
    retryable: false
  };
}

/**
 * Check if an error is retryable
 *
 * @param error - The caught error
 * @returns true if the operation should be retried
 */
export function isRetryableError(error: unknown): boolean {
  return classifyError(error).retryable;
}

// ========== RETRY LOGIC ==========

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Execute a function with exponential backoff retry
 * Per NFR-004: Max 3 attempts, exponential backoff (1s, 2s, 4s)
 *
 * @param fn - Async function to execute
 * @param operationName - Name for logging
 * @returns Result of the function
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  operationName: string
): Promise<T> {
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const classified = classifyError(error);

      // Don't retry non-retryable errors
      if (!classified.retryable) {
        throw error;
      }

      // Don't retry on last attempt
      if (attempt < MAX_RETRIES) {
        const delay = Math.min(
          BASE_RETRY_DELAY_MS * Math.pow(2, attempt - 1),
          MAX_RETRY_DELAY_MS
        );
        console.log(`[GitHub] ${operationName} failed (attempt ${attempt}/${MAX_RETRIES}), retrying in ${delay}ms...`);
        await sleep(delay);
      }
    }
  }

  throw lastError;
}

// ========== LOGGING ==========

/**
 * Log a GitHub operation result
 * SECURITY: Never logs token values (NFR-003)
 *
 * @param operation - Operation type
 * @param path - Target path (if applicable)
 * @param success - Whether operation succeeded
 * @param details - Additional details (optional)
 */
export function logOperation(
  operation: string,
  path: string | null,
  success: boolean,
  details?: string
): void {
  const pathStr = path ? ` path=${path}` : '';
  const detailsStr = details ? ` (${details})` : '';
  const status = success ? 'SUCCESS' : 'FAILED';

  console.log(`[GitHub] ${operation}${pathStr} ${status}${detailsStr}`);
}
