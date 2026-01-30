/**
 * Zod Revision Schemas
 * Spec: 016-backend-api (FR-008, FR-009)
 *
 * Validation schemas for revision request with 10-2000 char validation
 */

import { z } from 'zod';

// ========== REVISION REQUEST ==========

/**
 * Revision request schema (FR-008, FR-009)
 * Boss requests changes with notes between 10-2000 characters
 */
export const revisionRequestSchema = z.object({
  revision_notes: z
    .string()
    .min(10, 'Revision notes must be at least 10 characters')
    .max(2000, 'Revision notes must be at most 2000 characters')
});

export type RevisionRequestInput = z.infer<typeof revisionRequestSchema>;

// ========== REVISION NOTE VALIDATION ==========

/**
 * Validate revision notes length standalone
 * Useful for partial validation before submission
 */
export const revisionNotesSchema = z
  .string()
  .min(10, 'Revision notes must be at least 10 characters')
  .max(2000, 'Revision notes must be at most 2000 characters');
