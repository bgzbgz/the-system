/**
 * Fast Track Deployment Service
 * Spec: 012-config-secrets
 * Per contracts/errors.yaml
 *
 * Handles deployment webhook calls for publishing approved tools
 * Enhanced with configuration safety per spec 012-config-secrets
 */

import { Job, JobStatus } from '../models/job';
import { getDeployWebhookUrl, isConfigurationValid } from '../config/config';
import { ConfigError, ConfigErrorCode, RuntimeErrorCode, RUNTIME_ERROR_MESSAGES } from '../config/errors';

// ========== CONFIGURATION ==========

/**
 * Get Deployment webhook URL from configuration
 * Per spec 012-config-secrets: URL comes from environment
 *
 * LOCKED VALUE (reference): https://n8n-edge.fasttrack-diagnostic.com/webhook/tool-deploy
 */
function getDeployUrl(): string {
  const url = getDeployWebhookUrl();
  if (!url) {
    throw new ConfigError(
      ConfigErrorCode.DEPLOY_WEBHOOK_NOT_CONFIGURED,
      'DEPLOY_WEBHOOK_URL'
    );
  }
  return url;
}

/**
 * Request timeout in milliseconds (30 seconds)
 */
const DEPLOY_TIMEOUT_MS = 30000;

// ========== INTERFACES ==========

/**
 * Payload sent to Deployment webhook
 */
export interface DeployWebhookRequest {
  job_id: string;
  tool_id: string;
  tool_html: string;
  deployed_at: string;  // ISO 8601
}

/**
 * Result of deployment attempt
 */
export type DeployResult =
  | { success: true; deployed_at: Date }
  | { success: false; error_code: DeployErrorCode; failure_reason: string; retryable: boolean };

/**
 * Error codes for deployment failures
 */
export type DeployErrorCode =
  | 'DEPLOY_ERROR'
  | 'DEPLOY_NOT_CONFIGURED'
  | 'TIMEOUT'
  | 'NETWORK_ERROR';

// ========== ERROR MESSAGES ==========

const ERROR_MESSAGES: Record<DeployErrorCode, string> = {
  DEPLOY_ERROR: 'Deployment webhook returned {status}',
  DEPLOY_NOT_CONFIGURED: 'Deployment webhook URL not configured',
  TIMEOUT: 'Unable to reach Deployment service. Check your connection.',
  NETWORK_ERROR: 'Unable to reach Deployment service. Check your connection.'
};

// ========== FUNCTIONS ==========

/**
 * Build the deployment webhook payload from a Job
 *
 * @param job - The job to deploy (must have tool_id and tool_html)
 * @returns The webhook payload
 */
export function buildDeployPayload(job: Job): DeployWebhookRequest {
  if (!job.tool_id || !job.tool_html) {
    throw new Error('Job missing tool_id or tool_html for deployment');
  }

  return {
    job_id: job.job_id,
    tool_id: job.tool_id,
    tool_html: job.tool_html,
    deployed_at: new Date().toISOString()
  };
}

/**
 * Deploy an approved tool via the Deployment webhook
 * Per spec 012-config-secrets: Blocks if DEPLOY_WEBHOOK_URL not configured
 *
 * @param job - The job to deploy (must be in DEPLOY_REQUESTED status)
 * @returns DeployResult indicating success or failure
 */
export async function deployTool(job: Job): Promise<DeployResult> {
  const deployedAt = new Date();

  // Step 0: Configuration check per spec 012-config-secrets
  // Block deployment if Deployment webhook is not configured
  let deployUrl: string;
  try {
    deployUrl = getDeployUrl();
  } catch (error) {
    // Log configuration error (field name only, not value)
    console.log('[Deploy] Deployment blocked: DEPLOY_WEBHOOK_URL not configured');
    return {
      success: false,
      error_code: 'DEPLOY_NOT_CONFIGURED',
      failure_reason: 'Deployment webhook URL not configured',
      retryable: false  // Config errors are not retryable
    };
  }

  // Step 1: Validate job state
  if (job.status !== JobStatus.DEPLOY_REQUESTED) {
    console.log(`[Deploy] Invalid job status for deployment: ${job.status}`);
    return {
      success: false,
      error_code: 'DEPLOY_ERROR',
      failure_reason: `Job not in DEPLOY_REQUESTED status (current: ${job.status})`,
      retryable: false
    };
  }

  // Step 2: Build payload
  let payload: DeployWebhookRequest;
  try {
    payload = buildDeployPayload(job);
  } catch (error) {
    console.log(`[Deploy] Failed to build payload: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return {
      success: false,
      error_code: 'DEPLOY_ERROR',
      failure_reason: error instanceof Error ? error.message : 'Failed to build deployment payload',
      retryable: false
    };
  }

  // Step 3: Send to Deployment webhook with timeout
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEPLOY_TIMEOUT_MS);

  try {
    const response = await fetch(deployUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeout);

    // Step 4: Handle response
    if (response.ok) {
      // 200 OK = success
      console.log(`[Deploy] Tool ${job.tool_id} deployed successfully`);
      return {
        success: true,
        deployed_at: deployedAt
      };
    } else {
      // Non-200 = Deployment failed
      // Per spec 012-config-secrets (FR-012): Keep status as DEPLOY_REQUESTED
      // Per spec 012-config-secrets: Include specific status code in error message
      const statusCode = response.status;
      console.log(`[Deploy] Deployment failed: Deployment webhook returned ${statusCode}`);
      return {
        success: false,
        error_code: 'DEPLOY_ERROR',
        failure_reason: `Deployment webhook returned ${statusCode}`,
        retryable: true  // Runtime errors are retryable per spec
      };
    }

  } catch (error) {
    clearTimeout(timeout);

    // Handle different error types
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        // Timeout
        console.log('[Deploy] Deployment failed: Request timeout after 30s');
        return {
          success: false,
          error_code: 'TIMEOUT',
          failure_reason: 'Unable to reach Deployment service. Check your connection.',
          retryable: true
        };
      }

      // Network error
      console.log(`[Deploy] Deployment failed: Network error - ${error.message}`);
      return {
        success: false,
        error_code: 'NETWORK_ERROR',
        failure_reason: 'Unable to reach Deployment service. Check your connection.',
        retryable: true
      };
    }

    // Unknown error
    console.log('[Deploy] Deployment failed: Unknown error');
    return {
      success: false,
      error_code: 'NETWORK_ERROR',
      failure_reason: 'Unknown error occurred during deployment',
      retryable: true
    };
  }
}

/**
 * Get user-friendly error message for an error code
 */
export function getDeployErrorMessage(code: DeployErrorCode, statusCode?: number): string {
  const message = ERROR_MESSAGES[code];
  if (statusCode && message.includes('{status}')) {
    return message.replace('{status}', statusCode.toString());
  }
  return message;
}

/**
 * Check if deployment is possible (config is valid)
 * Per spec 012-config-secrets: Returns false if DEPLOY_WEBHOOK_URL not configured
 *
 * @returns true if deployment can proceed
 */
export function canDeploy(): boolean {
  try {
    getDeployUrl();
    return true;
  } catch {
    return false;
  }
}
