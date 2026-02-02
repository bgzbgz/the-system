/**
 * LearnWorlds API Routes
 * Spec: 001-learnworlds-auth-bridge
 *
 * Endpoints for LearnWorlds integration:
 * - Webhook receiver
 * - Health/status check
 */

import { Router, Request, Response } from 'express';
import { isLearnWorldsConfigured, logLearnWorldsConfigStatus } from '../config/learnworlds';
import {
  getTokenStatus,
  verifyWebhookSignature,
  processWebhook,
  WebhookPayload
} from '../services/learnworlds';

const router = Router();

/**
 * GET /api/learnworlds/health
 * Check LearnWorlds integration status
 */
router.get('/health', (req: Request, res: Response) => {
  const isConfigured = isLearnWorldsConfigured();
  const tokenStatus = getTokenStatus();

  res.json({
    configured: isConfigured,
    token: {
      hasToken: tokenStatus.hasToken,
      isExpired: tokenStatus.isExpired,
      expiresAt: tokenStatus.expiresAt
    },
    webhookEndpoint: '/api/learnworlds/webhooks',
    status: isConfigured ? (tokenStatus.hasToken && !tokenStatus.isExpired ? 'healthy' : 'degraded') : 'not_configured'
  });
});

/**
 * POST /api/learnworlds/webhooks
 * Receive webhooks from LearnWorlds
 *
 * LearnWorlds sends a signature in the header:
 * Learnworlds-Webhook-Signature: v1=<hmac-sha256>
 */
router.post('/webhooks', async (req: Request, res: Response) => {
  // Get raw body as string for signature verification
  const rawBody = JSON.stringify(req.body);
  const signature = req.headers['learnworlds-webhook-signature'] as string | undefined;

  // Log incoming webhook (without full payload for security)
  console.log(`[LearnWorlds Webhook] Received: ${req.body?.type || 'unknown'} from ${req.ip}`);

  // Verify signature
  const isValid = verifyWebhookSignature(rawBody, signature);

  if (!isValid) {
    console.warn('[LearnWorlds Webhook] Invalid signature - rejecting');
    return res.status(401).json({
      success: false,
      error: 'Invalid webhook signature'
    });
  }

  // Parse and validate payload
  const payload = req.body as WebhookPayload;

  if (!payload.type || !payload.version) {
    console.warn('[LearnWorlds Webhook] Invalid payload structure');
    return res.status(400).json({
      success: false,
      error: 'Invalid webhook payload'
    });
  }

  // Process the webhook
  const result = await processWebhook(payload);

  // Always return 200 to acknowledge receipt (even if processing failed)
  // This prevents LearnWorlds from retrying indefinitely
  res.json({
    success: true,
    received: true,
    processed: result.success,
    eventType: result.eventType,
    message: result.message
  });
});

/**
 * GET /api/learnworlds/webhooks
 * Simple endpoint for webhook URL validation
 * LearnWorlds might send a GET request to verify the URL exists
 */
router.get('/webhooks', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'LearnWorlds webhook endpoint is active',
    accepts: 'POST',
    expectedHeader: 'Learnworlds-Webhook-Signature'
  });
});

export default router;
