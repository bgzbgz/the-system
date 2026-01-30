/**
 * GitHub Deploy Service - Type Definitions
 * Spec: 022-github-deploy-service
 * Per data-model.md and contracts/
 */

// ========== CONFIGURATION ==========

/**
 * GitHub service configuration from environment
 * Per data-model.md: GitHubConfig
 */
export interface GitHubConfig {
  /** GitHub Personal Access Token (repo + workflow scopes) */
  token: string;
  /** Repository owner (user or organization) */
  owner: string;
  /** Repository name */
  repo: string;
  /** Target branch (default: main) */
  branch: string;
  /** Workflow file for MongoDB setup */
  workflowFile: string;
}

// ========== DEPLOY RESULT ==========

/**
 * Result of deploying a tool HTML file to GitHub
 * Per contracts/deploy.yaml
 */
export interface DeployResult {
  /** Whether deployment succeeded */
  success: boolean;
  /** Path in repo (e.g., tools/energy-score/index.html) */
  filePath: string;
  /** Git commit SHA (on success) */
  commitSha?: string;
  /** GitHub blob URL (on success) */
  repoUrl?: string;
  /** Raw content URL (on success) */
  rawUrl?: string;
  /** GitHub Pages URL (on success) */
  pagesUrl?: string;
  /** Error message (on failure) */
  error?: string;
}

// ========== WORKFLOW TRIGGER RESULT ==========

/**
 * Result of triggering the MongoDB collection creation workflow
 * Per contracts/workflow-trigger.yaml
 */
export interface WorkflowTriggerResult {
  /** Whether trigger succeeded */
  success: boolean;
  /** Workflow filename that was triggered */
  workflowFile: string;
  /** Generated collection name (on success) */
  collectionName?: string;
  /** Success message (on success) */
  message?: string;
  /** Error message (on failure) */
  error?: string;
}

// ========== WORKFLOW STATUS ==========

/**
 * Status of a GitHub Actions workflow run
 * Per contracts/workflow-status.yaml
 */
export interface WorkflowStatus {
  /** GitHub workflow run ID */
  runId: number;
  /** Current status */
  status: 'queued' | 'in_progress' | 'completed';
  /** Final result (null if not completed) */
  conclusion: 'success' | 'failure' | 'cancelled' | null;
  /** When run started (ISO 8601) */
  startedAt?: string;
  /** When run completed (ISO 8601) */
  completedAt?: string;
  /** URL to view workflow run in GitHub */
  url: string;
}

// ========== FULL DEPLOY RESULT ==========

/**
 * Combined result of the full deployment pipeline
 * Per data-model.md: FullDeployResult
 */
export interface FullDeployResult {
  /** Whether full deployment succeeded */
  success: boolean;
  /** GitHub blob URL (on success) */
  repoUrl?: string;
  /** GitHub Pages URL (on success) */
  pagesUrl?: string;
  /** Git commit SHA (on success) */
  commitSha?: string;
  /** MongoDB collection name (on success) */
  collectionName?: string;
  /** Error message (on failure) */
  error?: string;
}

// ========== ERROR TYPES ==========

/**
 * GitHub error classification
 * Per research.md RT-006: Error Classification
 */
export enum GitHubErrorType {
  /** 401 - Invalid or expired token */
  AUTH_ERROR = 'AUTH_ERROR',
  /** 404 - Repository or resource not found */
  NOT_FOUND = 'NOT_FOUND',
  /** 403/429 - Rate limit exceeded */
  RATE_LIMIT = 'RATE_LIMIT',
  /** Network timeout or connection error */
  NETWORK_ERROR = 'NETWORK_ERROR',
  /** 422 - Validation error (bad SHA, invalid content) */
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  /** 5xx - GitHub server error */
  SERVER_ERROR = 'SERVER_ERROR',
  /** Unknown error */
  UNKNOWN = 'UNKNOWN'
}

/**
 * Classified GitHub error with context
 */
export interface GitHubError {
  /** Error type classification */
  type: GitHubErrorType;
  /** Original error message */
  message: string;
  /** HTTP status code (if applicable) */
  status?: number;
  /** Whether this error is retryable */
  retryable: boolean;
}
