/**
 * LearnWorlds Webhook Handler
 * Spec: 001-learnworlds-auth-bridge
 *
 * Processes incoming webhooks from LearnWorlds
 */

import crypto from 'crypto';
import { getLearnWorldsConfig } from '../../config/learnworlds';

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
 * Learnworlds-Webhook-Signature: v1=<hex-encoded-hmac>
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string | undefined
): boolean {
  const config = getLearnWorldsConfig();

  if (!config.webhookSecret) {
    console.warn('[LearnWorlds Webhook] No webhook secret configured - allowing request');
    // Allow if no secret configured (for testing)
    return true;
  }

  if (!signature) {
    console.warn('[LearnWorlds Webhook] No signature provided');
    // For LearnWorlds "Send dummy data" testing, signature might not be present
    // Check if this looks like a test request
    console.log('[LearnWorlds Webhook] Payload preview:', payload.substring(0, 100));
    return false;
  }

  // Extract the hash from "v1=<hash>" format
  const signatureMatch = signature.match(/^v1=(.+)$/);
  if (!signatureMatch) {
    console.warn('[LearnWorlds Webhook] Invalid signature format:', signature);
    return false;
  }

  const providedHash = signatureMatch[1];

  // Compute expected HMAC
  const expectedHash = crypto
    .createHmac('sha256', config.webhookSecret)
    .update(payload)
    .digest('hex');

  console.log(`[LearnWorlds Webhook] Signature check - provided: ${providedHash.substring(0, 16)}... expected: ${expectedHash.substring(0, 16)}...`);

  // Constant-time comparison to prevent timing attacks
  try {
    const isMatch = crypto.timingSafeEqual(
      Buffer.from(providedHash, 'hex'),
      Buffer.from(expectedHash, 'hex')
    );
    console.log(`[LearnWorlds Webhook] Signature ${isMatch ? 'VALID' : 'INVALID'}`);
    return isMatch;
  } catch (err) {
    // If buffers are different lengths, they don't match
    console.warn('[LearnWorlds Webhook] Signature comparison failed:', err);
    return false;
  }
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
  const { id, email, tags } = data;

  console.log(`[LearnWorlds Webhook] Tags added to user ${email}: ${tags?.join(', ')}`);

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
