/**
 * LearnWorlds Automation Webhook
 *
 * Receives custom webhooks from LearnWorlds automations
 * These contain user data with variables like {{user.id}}, {{user.email}}
 *
 * Used for instant tool access - when user reaches a lesson,
 * automation sends webhook, we create pending access,
 * user clicks tool button and gets instant verification.
 */

import { Router, Request, Response } from 'express';
import { createPendingAccess } from '../services/learnworlds';
import { getLearnWorldsConfig } from '../config/learnworlds';

const router = Router();

interface AutomationPayload {
  user: {
    id: string;
    email: string;
    username?: string;
  };
  course?: {
    id: string;
    title: string;
  };
  tool_slug?: string;  // Can be passed in the webhook JSON
  school?: {
    name: string;
  };
}

/**
 * POST /api/automation/tool-access
 *
 * Receives webhook when user should get access to a tool
 * Creates pending access for instant verification
 *
 * Expected JSON body (from LearnWorlds automation):
 * {
 *   "user": {
 *     "id": "{{user.id}}",
 *     "email": "{{user.email}}",
 *     "username": "{{user.username}}"
 *   },
 *   "course": {
 *     "id": "{{course.id}}",
 *     "title": "{{course.title}}"
 *   },
 *   "tool_slug": "leadership-quiz"
 * }
 */
router.post('/tool-access', async (req: Request, res: Response) => {
  const config = getLearnWorldsConfig();

  // Verify webhook signature if configured
  const signature = req.headers['learnworlds-webhook-signature'] as string;
  if (config.webhookSecret && signature) {
    const expectedSignature = `v1=${config.webhookSecret}`;
    if (signature !== expectedSignature) {
      console.warn('[Automation Webhook] Invalid signature');
      return res.status(401).json({ success: false, error: 'Invalid signature' });
    }
  }

  const payload = req.body as AutomationPayload;

  // Validate required fields
  if (!payload.user?.id || !payload.user?.email) {
    console.warn('[Automation Webhook] Missing user data');
    return res.status(400).json({
      success: false,
      error: 'Missing user.id or user.email'
    });
  }

  // Get tool slug from payload or derive from course
  let toolSlug = payload.tool_slug;

  if (!toolSlug && payload.course?.id) {
    // Use course ID as tool slug if not specified
    toolSlug = payload.course.id;
  }

  if (!toolSlug) {
    console.warn('[Automation Webhook] Missing tool_slug');
    return res.status(400).json({
      success: false,
      error: 'Missing tool_slug or course.id'
    });
  }

  console.log(`[Automation Webhook] Received: ${payload.user.email} → ${toolSlug}`);

  try {
    // Create pending access
    await createPendingAccess(
      payload.user.id,
      payload.user.email,
      toolSlug,
      {
        name: payload.user.username,
        company: undefined,
        tags: []
      }
    );

    console.log(`[Automation Webhook] ✓ Pending access created: ${payload.user.email} → ${toolSlug}`);

    res.json({
      success: true,
      message: 'Pending access created',
      user_email: payload.user.email,
      tool_slug: toolSlug,
      expires_in_seconds: 60
    });

  } catch (error) {
    console.error('[Automation Webhook] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create pending access'
    });
  }
});

/**
 * POST /api/automation/tool-access/:toolSlug
 *
 * Alternative endpoint with tool slug in URL
 * Simpler JSON body needed:
 * {
 *   "user": {
 *     "id": "{{user.id}}",
 *     "email": "{{user.email}}"
 *   }
 * }
 */
router.post('/tool-access/:toolSlug', async (req: Request, res: Response) => {
  const { toolSlug } = req.params;
  const payload = req.body as AutomationPayload;

  if (!payload.user?.id || !payload.user?.email) {
    return res.status(400).json({
      success: false,
      error: 'Missing user.id or user.email'
    });
  }

  console.log(`[Automation Webhook] Received: ${payload.user.email} → ${toolSlug}`);

  try {
    await createPendingAccess(
      payload.user.id,
      payload.user.email,
      toolSlug,
      { name: payload.user.username }
    );

    console.log(`[Automation Webhook] ✓ Pending access created: ${payload.user.email} → ${toolSlug}`);

    res.json({
      success: true,
      message: 'Pending access created',
      user_email: payload.user.email,
      tool_slug: toolSlug,
      expires_in_seconds: 60
    });

  } catch (error) {
    console.error('[Automation Webhook] Error:', error);
    res.status(500).json({ success: false, error: 'Failed to create pending access' });
  }
});

export default router;
