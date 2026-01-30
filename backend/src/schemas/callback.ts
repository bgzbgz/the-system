/**
 * Zod Callback Schemas
 * Spec: 016-backend-api (FR-011, FR-012, FR-013)
 *
 * Validation schemas for n8n workflow callbacks
 */

import { z } from 'zod';

// ========== QA REPORT ==========

/**
 * QA Finding schema
 */
export const qaFindingSchema = z.object({
  check: z.string(),
  passed: z.boolean(),
  message: z.string().optional()
});

/**
 * QA Report schema
 */
export const qaReportSchema = z.object({
  score: z.number().min(0).max(100),
  max_score: z.number().default(100),
  passed: z.boolean(),
  findings: z.array(qaFindingSchema).optional()
});

export type QAReport = z.infer<typeof qaReportSchema>;

// ========== FACTORY CALLBACK ==========

/**
 * Factory callback status enum
 */
export const factoryCallbackStatusSchema = z.enum([
  'success',
  'qa_failed',
  'escalated'
]).default('success');

/**
 * Factory callback schema (FR-011)
 * Receives tool build results from n8n factory workflow
 */
export const factoryCallbackSchema = z.object({
  job_id: z.string().uuid('Invalid job ID format'),
  tool_name: z.string().min(1, 'Tool name is required'),
  slug: z.string().min(1, 'Slug is required'),
  tool_html: z.string().min(1, 'Tool HTML is required'),
  template_type: z.string().min(1, 'Template type is required'),
  qa_report: qaReportSchema,
  status: factoryCallbackStatusSchema.optional()
});

export type FactoryCallbackInput = z.infer<typeof factoryCallbackSchema>;

// ========== DEPLOY CALLBACK ==========

/**
 * Deploy callback schema (FR-012)
 * Receives deployment results from n8n deploy workflow
 */
export const deployCallbackSchema = z.object({
  job_id: z.string().uuid('Invalid job ID format'),
  success: z.boolean(),
  deployed_url: z.string().url('Invalid URL format').optional(),
  error: z.string().optional()
}).refine(
  data => {
    // If success, deployed_url is required
    if (data.success && !data.deployed_url) {
      return false;
    }
    // If not success, error is required
    if (!data.success && !data.error) {
      return false;
    }
    return true;
  },
  {
    message: 'deployed_url is required when success=true, error is required when success=false'
  }
);

export type DeployCallbackInput = z.infer<typeof deployCallbackSchema>;

// ========== REVISION CALLBACK ==========

/**
 * Revision started callback schema
 * When n8n starts processing a revision request
 */
export const revisionStartedCallbackSchema = z.object({
  job_id: z.string().uuid('Invalid job ID format')
});

export type RevisionStartedCallbackInput = z.infer<typeof revisionStartedCallbackSchema>;
