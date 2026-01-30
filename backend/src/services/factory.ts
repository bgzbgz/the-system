/**
 * Fast Track Factory Integration - Factory Service
 * Spec: 007-factory-integration, 012-config-secrets
 * Per contracts/webhook.yaml
 *
 * Sends jobs to the canonical Factory webhook
 * Enhanced with configuration safety per spec 012-config-secrets
 */

import { Job } from '../models/job';
import { retrieveFile } from './storage';
import { getFactoryWebhookUrl, isConfigurationValid } from '../config/config';
import { ConfigError, ConfigErrorCode } from '../config/errors';

// ========== CONFIGURATION ==========

/**
 * Get Factory webhook URL from configuration
 * Per spec 012-config-secrets: URL comes from environment, not hardcoded
 *
 * LOCKED VALUE (reference): https://n8n-edge.fasttrack-diagnostic.com/webhook/tool-factory
 * Per spec 007: "If this webhook ever changes, it is a spec change, not a config tweak"
 */
function getFactoryUrl(): string {
  const url = getFactoryWebhookUrl();
  if (!url) {
    throw new ConfigError(
      ConfigErrorCode.FACTORY_WEBHOOK_NOT_CONFIGURED,
      'FACTORY_WEBHOOK_URL'
    );
  }
  return url;
}

/**
 * @deprecated Use getFactoryUrl() instead - reads from environment
 * Kept for backward compatibility but will throw if config not set
 */
export const FACTORY_WEBHOOK_URL = process.env.FACTORY_WEBHOOK_URL || '';

/**
 * Request timeout in milliseconds
 * Set to 360s (6 min) to accommodate multiple agents and QA revision loop
 */
const SUBMIT_TIMEOUT_MS = 360000;

// ========== INTERFACES ==========

/**
 * Payload sent to Factory webhook
 * Matches n8n "Parse & Normalize Input" expected format
 */
export interface FactoryWebhookRequest {
  job_id: string;
  source: {
    text: string;        // n8n preferred format: source.text
  };
  callback_url: string;  // Where n8n should send the result
  metadata: {
    original_filename: string;
    file_type: string;
    file_size_bytes: number;
    submitted_at: string;
  };
}

/**
 * QA Report from QA Agent validation
 */
export interface QAReport {
  score: number;
  passed_checks: string[];
  failed_checks: string[];
  recommendations?: string[];
  notes?: string;
}

/**
 * Revision history entry from QA loop
 */
export interface RevisionHistoryEntry {
  attempt: number;
  score: number;
  passed: boolean;
  failed_checks: string[];
  recommendations?: string[];
}

/**
 * Factory response with generated tool
 */
export interface FactoryResponse {
  status?: string;           // 'success' or 'failed_qa'
  success?: boolean;         // Legacy field
  job_id: string;
  tool_name?: string;
  tool_description?: string;
  tool_html_base64?: string;
  qa_report?: QAReport;
  // NEW: QA Revision Loop fields
  revision_count?: number;
  revision_history?: RevisionHistoryEntry[];
  message?: string;          // Status message (e.g., "Tool failed QA after 3 attempts")
  error?: string;
}

/**
 * Result of submission attempt
 */
export type SubmitResult =
  | { success: true; submitted_at: Date; factoryResponse?: FactoryResponse }
  | { success: false; error_code: SubmitErrorCode; failure_reason: string };

/**
 * Error codes for submission failures
 */
export type SubmitErrorCode =
  | 'FACTORY_ERROR'
  | 'FACTORY_NOT_CONFIGURED'
  | 'TIMEOUT'
  | 'INVALID_RESPONSE'
  | 'FILE_NOT_FOUND'
  | 'NETWORK_ERROR';

// ========== ERROR MESSAGES (Fast Track DNA) ==========

const ERROR_MESSAGES: Record<SubmitErrorCode, string> = {
  FACTORY_ERROR: 'Factory rejected the job. Try again.',
  FACTORY_NOT_CONFIGURED: 'Factory webhook URL not configured',
  TIMEOUT: 'Unable to reach Factory. Check your connection.',
  INVALID_RESPONSE: 'Factory response invalid. Try again.',
  FILE_NOT_FOUND: 'File not found. Re-upload the document.',
  NETWORK_ERROR: 'Unable to reach Factory. Check your connection.'
};

// ========== FUNCTIONS ==========

/**
 * Build the webhook payload from a Job
 * Uses n8n preferred format: source.text
 *
 * @param job - The job to submit
 * @param fileContentBase64 - Base64-encoded file content
 * @returns The webhook payload
 */
export function buildWebhookPayload(
  job: Job,
  fileContentBase64: string
): FactoryWebhookRequest {
  // For text-based files, decode to get the instruction text
  let instructionText = '';
  const textTypes = ['MD', 'TXT'];

  if (textTypes.includes(job.file_type.toUpperCase())) {
    // Decode base64 to get the actual text content
    instructionText = Buffer.from(fileContentBase64, 'base64').toString('utf-8');
  } else {
    // For binary files (PDF, DOCX), use filename as instruction
    // n8n will need to extract text from the base64 content
    instructionText = `Process file: ${job.original_filename}`;
  }

  // Get callback URL from environment (ngrok URL + callback path)
  const callbackUrl = process.env.CALLBACK_URL || 'http://localhost:3000/api/factory/callback';

  // Use n8n preferred format: source.text
  return {
    job_id: job.job_id,
    source: {
      text: instructionText
    },
    callback_url: callbackUrl,
    metadata: {
      original_filename: job.original_filename,
      file_type: job.file_type,
      file_size_bytes: job.file_size_bytes,
      submitted_at: new Date().toISOString()
    }
  };
}

/**
 * Submit a job to the Factory webhook
 * Per spec 012-config-secrets: Blocks if FACTORY_WEBHOOK_URL not configured
 *
 * @param job - The job to submit (must have file_storage_key)
 * @returns SubmitResult indicating success or failure
 */
export async function submitJobToFactory(job: Job): Promise<SubmitResult> {
  const submittedAt = new Date();
  console.log(`[Factory] Starting submission for job ${job.job_id}...`);

  // Step 0: Configuration check per spec 012-config-secrets
  // Block submission if Factory webhook is not configured
  let factoryUrl: string;
  try {
    factoryUrl = getFactoryUrl();
    console.log(`[Factory] Using webhook URL (length: ${factoryUrl.length})`);
  } catch (error) {
    // Log configuration error (field name only, not value)
    console.log('[Factory] Submission blocked: FACTORY_WEBHOOK_URL not configured');
    return {
      success: false,
      error_code: 'FACTORY_NOT_CONFIGURED',
      failure_reason: 'Factory webhook URL not configured'
    };
  }

  // Step 1: Retrieve file content
  let fileBuffer: Buffer;
  try {
    fileBuffer = await retrieveFile(job.file_storage_key);
  } catch (error) {
    return {
      success: false,
      error_code: 'FILE_NOT_FOUND',
      failure_reason: 'Stored file not found'
    };
  }

  // Step 2: Build payload with base64-encoded file
  const fileContentBase64 = fileBuffer.toString('base64');
  const payload = buildWebhookPayload(job, fileContentBase64);
  console.log(`[Factory] Payload built - job_id: ${payload.job_id}, source.text length: ${payload.source.text.length}`);

  // Step 3: Send to Factory with timeout
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SUBMIT_TIMEOUT_MS);

  try {
    console.log(`[Factory] Sending request to webhook (timeout: ${SUBMIT_TIMEOUT_MS}ms)...`);
    const startTime = Date.now();

    const response = await fetch(factoryUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeout);
    const elapsed = Date.now() - startTime;
    console.log(`[Factory] Response received in ${elapsed}ms - status: ${response.status}`);

    // Step 4: Handle response
    if (response.ok) {
      // 200 OK = success - parse the response body
      let factoryResponse: FactoryResponse | undefined;
      try {
        const responseText = await response.text();
        console.log(`[Factory] Response body length: ${responseText.length}`);
        factoryResponse = JSON.parse(responseText) as FactoryResponse;
        console.log(`[Factory] Received tool: ${factoryResponse.tool_name || 'unnamed'}, has HTML: ${!!factoryResponse.tool_html_base64}`);
      } catch (e) {
        console.log(`[Factory] Could not parse response body: ${e}`);
      }

      return {
        success: true,
        submitted_at: submittedAt,
        factoryResponse
      };
    } else {
      // Non-200 = Factory rejected
      // Per spec 012-config-secrets: Include specific status code in error message
      const statusCode = response.status;
      const errorText = await response.text();
      console.log(`[Factory] Submission failed: Factory webhook returned ${statusCode}: ${errorText}`);
      return {
        success: false,
        error_code: 'FACTORY_ERROR',
        failure_reason: `Factory webhook returned ${statusCode}`
      };
    }

  } catch (error) {
    clearTimeout(timeout);
    console.log(`[Factory] Request error: ${error}`);

    // Handle different error types
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        // Timeout
        const timeoutSec = Math.round(SUBMIT_TIMEOUT_MS / 1000);
        console.log(`[Factory] Request timed out after ${timeoutSec}s`);
        return {
          success: false,
          error_code: 'TIMEOUT',
          failure_reason: `Request timeout after ${timeoutSec}s`
        };
      }

      // Network error
      console.log(`[Factory] Network error: ${error.message}`);
      return {
        success: false,
        error_code: 'NETWORK_ERROR',
        failure_reason: `Network error: ${error.message}`
      };
    }

    // Unknown error
    console.log('[Factory] Unknown error occurred');
    return {
      success: false,
      error_code: 'NETWORK_ERROR',
      failure_reason: 'Unknown error occurred'
    };
  }
}

/**
 * Get user-friendly error message for an error code
 */
export function getErrorMessage(code: SubmitErrorCode): string {
  return ERROR_MESSAGES[code];
}
