/**
 * Zod Job Schemas
 * Spec: 016-backend-api (FR-002, FR-003)
 *
 * Validation schemas for job submission with field limits per spec
 */

import { z } from 'zod';

// ========== ENUMS ==========

export const CategoryTypeSchema = z.enum([
  'B2B_PRODUCT',
  'B2B_SERVICE',
  'B2C_PRODUCT',
  'B2C_SERVICE'
]);

export const JobStatusSchema = z.enum([
  'DRAFT',
  'FAILED_SEND',
  'SENT',
  'PROCESSING',
  'FACTORY_FAILED',
  'QA_FAILED',
  'ESCALATED',
  'READY_FOR_REVIEW',
  'REVISION_REQUESTED',
  'DEPLOY_REQUESTED',
  'DEPLOYING',
  'DEPLOYED',
  'DEPLOY_FAILED',
  'REJECTED'
]);

// ========== JOB SUBMISSION ==========

/**
 * Job submission schema (FR-002, FR-003)
 * All field validations per spec max lengths
 */
export const jobSubmissionSchema = z.object({
  file_name: z
    .string()
    .min(1, 'File name is required')
    .max(255, 'File name must be at most 255 characters'),

  file_content: z
    .string()
    .min(1, 'File content is required')
    .max(2000000, 'File content must be at most 2,000,000 characters'),

  category: CategoryTypeSchema,

  decision: z
    .string()
    .min(1, 'Decision is required')
    .max(200, 'Decision must be at most 200 characters'),

  teaching_point: z
    .string()
    .min(1, 'Teaching point is required')
    .max(500, 'Teaching point must be at most 500 characters'),

  inputs: z
    .string()
    .min(1, 'Inputs description is required')
    .max(500, 'Inputs must be at most 500 characters'),

  verdict_criteria: z
    .string()
    .min(1, 'Verdict criteria is required')
    .max(500, 'Verdict criteria must be at most 500 characters')
});

export type JobSubmissionInput = z.infer<typeof jobSubmissionSchema>;

// ========== QUERY PARAMETERS ==========

/**
 * Job list query parameters schema (FR-004)
 */
export const jobListQuerySchema = z.object({
  status: JobStatusSchema.optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0)
});

export type JobListQuery = z.infer<typeof jobListQuerySchema>;

// ========== JOB ID PARAMETER ==========

/**
 * Job ID path parameter schema
 */
export const jobIdParamSchema = z.object({
  jobId: z.string().uuid('Invalid job ID format')
});

export type JobIdParam = z.infer<typeof jobIdParamSchema>;

// ========== REJECT REQUEST ==========

/**
 * Reject job request schema (FR-007)
 */
export const rejectJobSchema = z.object({
  reason: z
    .string()
    .min(1, 'Rejection reason is required')
    .max(1000, 'Rejection reason must be at most 1000 characters')
});

export type RejectJobInput = z.infer<typeof rejectJobSchema>;
