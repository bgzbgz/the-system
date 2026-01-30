/**
 * Revision Model
 * Spec: 017-mongodb-schema
 *
 * Per data-model.md Revision interface
 * Embedded in Job document as revisions array
 */

// Re-export from job.ts for convenience
export { Revision } from './job';

/**
 * Input for creating a revision request
 */
export interface CreateRevisionInput {
  notes: string;
}

/**
 * Create a revision entry
 *
 * @param input - Revision input
 * @returns Revision ready for insertion
 */
export function createRevision(input: CreateRevisionInput): {
  notes: string;
  requested_at: Date;
  completed_at?: Date;
} {
  return {
    notes: input.notes,
    requested_at: new Date()
  };
}

/**
 * Mark a revision as completed
 *
 * @param revision - Revision to complete
 * @returns Updated revision
 */
export function completeRevision(revision: { notes: string; requested_at: Date; completed_at?: Date }): {
  notes: string;
  requested_at: Date;
  completed_at: Date;
} {
  return {
    ...revision,
    completed_at: new Date()
  };
}

/**
 * Validate revision input
 *
 * @param input - Input to validate
 * @returns Validation result
 */
export function validateRevisionInput(input: unknown): { valid: boolean; error?: string } {
  if (!input || typeof input !== 'object') {
    return { valid: false, error: 'Revision must be an object' };
  }

  const revision = input as Record<string, unknown>;

  if (typeof revision.notes !== 'string') {
    return { valid: false, error: 'notes must be a string' };
  }

  if (!revision.notes.trim()) {
    return { valid: false, error: 'notes cannot be empty' };
  }

  if (revision.notes.length > 2000) {
    return { valid: false, error: 'notes cannot exceed 2000 characters' };
  }

  return { valid: true };
}
