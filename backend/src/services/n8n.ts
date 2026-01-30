/**
 * n8n Webhook Service
 * Spec: 016-backend-api (FR-005a, FR-006, FR-008)
 *
 * Integration with n8n workflows for factory, deploy, and revision triggers
 * Supports manual retry (no automatic retries per spec clarification)
 */

import { getFactoryWebhookUrl, getDeployWebhookUrl } from '../config/config';
import logger from '../utils/logger';

// ========== TYPES ==========

/**
 * Webhook result with retry support (FR-005a)
 */
export interface WebhookResult {
  success: boolean;
  triggeredAt?: Date;
  failureReason?: string;
  canRetry: boolean;  // FR-005a: Manual retry indicator
}

/**
 * Factory webhook payload
 */
export interface FactoryPayload {
  job_id: string;
  file_name: string;
  file_content: string;
  category: string;
  decision: string;
  teaching_point: string;
  inputs: string;
  verdict_criteria: string;
  callback_url: string;
}

/**
 * Deploy webhook payload
 */
export interface DeployPayload {
  job_id: string;
  tool_name: string;
  slug: string;
  tool_html: string;
  callback_url: string;
}

/**
 * Revision webhook payload
 */
export interface RevisionPayload {
  job_id: string;
  revision_notes: string;
  file_name: string;
  file_content: string;
  category: string;
  decision: string;
  teaching_point: string;
  inputs: string;
  verdict_criteria: string;
  callback_url: string;
}

// ========== CONFIGURATION ==========

/**
 * Default webhook timeout in milliseconds
 */
const WEBHOOK_TIMEOUT_MS = 10000; // 10 seconds

/**
 * Get callback URL from environment
 */
function getCallbackUrl(): string {
  return process.env.CALLBACK_URL || `http://localhost:${process.env.PORT || 3000}/api/factory/callback`;
}

/**
 * Get deploy callback URL
 */
function getDeployCallbackUrl(): string {
  return process.env.DEPLOY_CALLBACK_URL || `http://localhost:${process.env.PORT || 3000}/api/factory/deploy-callback`;
}

/**
 * Get revision webhook URL
 */
function getRevisionWebhookUrl(): string {
  return process.env.REVISION_WEBHOOK_URL || '';
}

// ========== WEBHOOK FUNCTIONS ==========

/**
 * Trigger factory workflow to build a tool
 * FR-005a: Returns canRetry flag for manual retry support
 *
 * @param payload - Factory webhook payload
 * @returns WebhookResult with success/failure and retry indicator
 */
export async function triggerFactory(payload: FactoryPayload): Promise<WebhookResult> {
  const webhookUrl = getFactoryWebhookUrl();

  if (!webhookUrl) {
    logger.warn('Factory webhook URL not configured');
    return {
      success: false,
      failureReason: 'Factory webhook URL not configured',
      canRetry: true
    };
  }

  try {
    logger.logOperation({
      operation: 'TRIGGER_FACTORY',
      job_id: payload.job_id,
      details: {
        webhook_url: webhookUrl.substring(0, 50) + '...',
        file_name: payload.file_name
      }
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ...payload,
        callback_url: getCallbackUrl()
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      logger.warn('Factory webhook returned error', {
        job_id: payload.job_id,
        status: response.status,
        error: errorText.substring(0, 200)
      });
      return {
        success: false,
        failureReason: `HTTP ${response.status}: ${errorText.substring(0, 200)}`,
        canRetry: true
      };
    }

    logger.info('Factory webhook triggered successfully', {
      job_id: payload.job_id
    });

    return {
      success: true,
      triggeredAt: new Date(),
      canRetry: false
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logger.logError('Factory webhook failed', error as Error, {
      job_id: payload.job_id
    });

    return {
      success: false,
      failureReason: errorMessage,
      canRetry: true
    };
  }
}

/**
 * Trigger deploy workflow to deploy a tool (FR-006)
 *
 * @param payload - Deploy webhook payload
 * @returns WebhookResult with success/failure
 */
export async function triggerDeploy(payload: DeployPayload): Promise<WebhookResult> {
  const webhookUrl = getDeployWebhookUrl();

  if (!webhookUrl) {
    logger.warn('Deploy webhook URL not configured');
    return {
      success: false,
      failureReason: 'Deploy webhook URL not configured',
      canRetry: true
    };
  }

  try {
    logger.logOperation({
      operation: 'TRIGGER_DEPLOY',
      job_id: payload.job_id,
      details: {
        tool_name: payload.tool_name,
        slug: payload.slug
      }
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ...payload,
        callback_url: getDeployCallbackUrl()
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      logger.warn('Deploy webhook returned error', {
        job_id: payload.job_id,
        status: response.status
      });
      return {
        success: false,
        failureReason: `HTTP ${response.status}: ${errorText.substring(0, 200)}`,
        canRetry: true
      };
    }

    logger.info('Deploy webhook triggered successfully', {
      job_id: payload.job_id
    });

    return {
      success: true,
      triggeredAt: new Date(),
      canRetry: false
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logger.logError('Deploy webhook failed', error as Error, {
      job_id: payload.job_id
    });

    return {
      success: false,
      failureReason: errorMessage,
      canRetry: true
    };
  }
}

/**
 * Trigger revision workflow for tool changes (FR-008)
 *
 * @param payload - Revision webhook payload
 * @returns WebhookResult with success/failure
 */
export async function triggerRevision(payload: RevisionPayload): Promise<WebhookResult> {
  const webhookUrl = getRevisionWebhookUrl();

  if (!webhookUrl) {
    logger.warn('Revision webhook URL not configured');
    return {
      success: false,
      failureReason: 'Revision webhook URL not configured',
      canRetry: true
    };
  }

  try {
    logger.logOperation({
      operation: 'TRIGGER_REVISION',
      job_id: payload.job_id,
      details: {
        file_name: payload.file_name,
        revision_notes_length: payload.revision_notes.length
      }
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ...payload,
        callback_url: getCallbackUrl()
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      logger.warn('Revision webhook returned error', {
        job_id: payload.job_id,
        status: response.status
      });
      return {
        success: false,
        failureReason: `HTTP ${response.status}: ${errorText.substring(0, 200)}`,
        canRetry: true
      };
    }

    logger.info('Revision webhook triggered successfully', {
      job_id: payload.job_id
    });

    return {
      success: true,
      triggeredAt: new Date(),
      canRetry: false
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logger.logError('Revision webhook failed', error as Error, {
      job_id: payload.job_id
    });

    return {
      success: false,
      failureReason: errorMessage,
      canRetry: true
    };
  }
}

// ========== EXPORTS ==========

export default {
  triggerFactory,
  triggerDeploy,
  triggerRevision
};
