/**
 * UUID Generation Utility
 * Spec: 017-mongodb-schema
 *
 * Uses Node.js built-in crypto.randomUUID() for RFC 4122 v4 UUIDs
 * Per research.md: No external dependencies needed
 */

import { randomUUID } from 'crypto';

/**
 * Generate a new UUID v4
 * @returns A new RFC 4122 compliant UUID string
 */
export function generateUUID(): string {
  return randomUUID();
}

/**
 * Validate UUID format
 * @param uuid - String to validate
 * @returns true if valid UUID v4 format
 */
export function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}
