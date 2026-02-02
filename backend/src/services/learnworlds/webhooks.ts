/**
 * LearnWorlds Webhook Handler
 * Spec: 001-learnworlds-auth-bridge
 *
 * Processes incoming webhooks from LearnWorlds
 */

import crypto from 'crypto';
import { getLearnWorldsConfig } from '../../config/learnworlds';
import { createPendingAccess } from './pendingAccess';

// Webhook event types from LearnWorlds
export type WebhookEventType =
  | 'userUpdated'
  | 'productBought'
  | 'enrolledFreeCourse'
  | 'leadCreated'
  | 'awardedCertificate'
  | 'courseCompleted'
  | 'learningProgramCompleted'
  | 'subscriptionPaymentPlanBought'
  | 'subscriptionPaymentPlanCanceled'
  | 'subscriptionTrialStarted'
  | 'subscriptionTrialWillEnd'
  | 'previewedFree'
  | 'subscriptionUpdated'
  | 'userUnenrolledFromProduct'
  | 'userTagAdded'
  | 'userTagDeleted'
  | 'paymentCreated';

export interface WebhookPayload {
  version: number;
  type: WebhookEventType;
  trigger: string;
  school_id: string;
  data: Record<string, any>;
}

export interface WebhookProcessResult {
  success: boolean;
  eventType: string;
  message: string;
  userId?: string;
}

/**
 * Verify webhook signature from LearnWorlds
 *
 * LearnWorlds sends signature in header:
 * Learnworlds-Webhook-Signature: v1=<webhook-secret>
 *
 * Note: LearnWorlds uses a simple shared secret approach, NOT HMAC.
 * The signature is just the webhook secret itself.
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string | undefined
): boolean {
  const config = getLearnWorldsConfig();

  if (!config.webhookSecret) {
    console.warn('[LearnWorlds Webhook] No webhook secret configured - allowing request');
    return true;
  }

  if (!signature) {
    console.warn('[LearnWorlds Webhook] No signature provided');
    return false;
  }

  // Extract the secret from "v1=<secret>" format
  const signatureMatch = signature.match(/^v1=(.+)$/);
  if (!signatureMatch) {
    console.warn('[LearnWorlds Webhook] Invalid signature format:', signature);
    return false;
  }

  const providedSecret = signatureMatch[1];

  // LearnWorlds sends the webhook secret directly as the signature
  // Use constant-time comparison to prevent timing attacks
  const isMatch = providedSecret.length === config.webhookSecret.length &&
    crypto.timingSafeEqual(
      Buffer.from(providedSecret, 'utf8'),
      Buffer.from(config.webhookSecret, 'utf8')
    );

  console.log(`[LearnWorlds Webhook] Signature ${isMatch ? 'VALID ✓' : 'INVALID ✗'}`);

  return isMatch;
}

/**
 * Process incoming webhook event
 */
export async function processWebhook(
  payload: WebhookPayload
): Promise<WebhookProcessResult> {
  const { type, trigger, data } = payload;

  console.log(`[LearnWorlds Webhook] Processing event: ${type} (trigger: ${trigger})`);

  try {
    switch (type) {
      case 'userUpdated':
        return await handleUserUpdated(data);

      case 'courseCompleted':
        return await handleCourseCompleted(data);

      case 'enrolledFreeCourse':
        return await handleEnrollment(data);

      case 'productBought':
        return await handlePurchase(data);

      case 'userTagAdded':
        return await handleTagAdded(data);

      case 'userTagDeleted':
        return await handleTagDeleted(data);

      case 'awardedCertificate':
        return await handleCertificate(data);

      default:
        // Log but don't fail for unknown event types
        console.log(`[LearnWorlds Webhook] Unhandled event type: ${type}`);
        return {
          success: true,
          eventType: type,
          message: `Event type ${type} received but not processed`
        };
    }
  } catch (error) {
    console.error(`[LearnWorlds Webhook] Error processing ${type}:`, error);
    return {
      success: false,
      eventType: type,
      message: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// ========== EVENT HANDLERS ==========

async function handleUserUpdated(data: Record<string, any>): Promise<WebhookProcessResult> {
  const user = data.user;
  if (!user) {
    return { success: false, eventType: 'userUpdated', message: 'No user data in payload' };
  }

  console.log(`[LearnWorlds Webhook] User updated: ${user.email} (${user.id})`);

  // TODO: Cache user data in learnworlds_users collection
  // For now, just log it

  return {
    success: true,
    eventType: 'userUpdated',
    message: `User ${user.email} updated`,
    userId: user.id
  };
}

async function handleCourseCompleted(data: Record<string, any>): Promise<WebhookProcessResult> {
  const { user, course, completed_at } = data;

  if (!user || !course) {
    return { success: false, eventType: 'courseCompleted', message: 'Missing user or course data' };
  }

  console.log(`[LearnWorlds Webhook] Course completed: ${user.email} finished "${course.title}"`);

  // TODO: Log to analytics collection

  return {
    success: true,
    eventType: 'courseCompleted',
    message: `User ${user.email} completed course ${course.id}`,
    userId: user.id
  };
}

async function handleEnrollment(data: Record<string, any>): Promise<WebhookProcessResult> {
  const { user, course } = data;

  if (!user || !course) {
    return { success: false, eventType: 'enrolledFreeCourse', message: 'Missing user or course data' };
  }

  console.log(`[LearnWorlds Webhook] User enrolled: ${user.email} in "${course.title}"`);

  // TODO: Cache enrollment in learnworlds_users collection

  return {
    success: true,
    eventType: 'enrolledFreeCourse',
    message: `User ${user.email} enrolled in course ${course.id}`,
    userId: user.id
  };
}

async function handlePurchase(data: Record<string, any>): Promise<WebhookProcessResult> {
  const { user, payment } = data;

  if (!user || !payment) {
    return { success: false, eventType: 'productBought', message: 'Missing user or payment data' };
  }

  const product = payment.product;
  console.log(`[LearnWorlds Webhook] Purchase: ${user.email} bought "${product?.name || 'Unknown'}"`);

  return {
    success: true,
    eventType: 'productBought',
    message: `User ${user.email} purchased ${product?.id || 'unknown product'}`,
    userId: user.id
  };
}

async function handleTagAdded(data: Record<string, any>): Promise<WebhookProcessResult> {
  const { id, email, tags, fields, username, first_name, last_name } = data;

  console.log(`[LearnWorlds Webhook] Tags added to user ${email}: ${tags?.join(', ')}`);

  // Check for tool-access tags (format: "tool-{tool-slug}")
  if (tags && Array.isArray(tags)) {
    for (const tag of tags) {
      if (tag.startsWith('tool-')) {
        const toolSlug = tag.substring(5); // Remove "tool-" prefix
        console.log(`[LearnWorlds Webhook] Tool access tag detected: ${email} → ${toolSlug}`);

        // Create pending access for instant verification
        await createPendingAccess(id, email, toolSlug, {
          name: [first_name, last_name].filter(Boolean).join(' ') || username,
          company: fields?.company,
          tags: tags
        });
      }
    }
  }

  return {
    success: true,
    eventType: 'userTagAdded',
    message: `Tags updated for user ${email}`,
    userId: id
  };
}

async function handleTagDeleted(data: Record<string, any>): Promise<WebhookProcessResult> {
  const { id, email, tags } = data;

  console.log(`[LearnWorlds Webhook] Tags on user ${email} now: ${tags?.join(', ')}`);

  return {
    success: true,
    eventType: 'userTagDeleted',
    message: `Tags updated for user ${email}`,
    userId: id
  };
}

async function handleCertificate(data: Record<string, any>): Promise<WebhookProcessResult> {
  const { user, certificate } = data;

  if (!user || !certificate) {
    return { success: false, eventType: 'awardedCertificate', message: 'Missing data' };
  }

  console.log(`[LearnWorlds Webhook] Certificate awarded: ${user.email} - "${certificate.title}"`);

  return {
    success: true,
    eventType: 'awardedCertificate',
    message: `Certificate "${certificate.title}" awarded to ${user.email}`,
    userId: user.id
  };
}
