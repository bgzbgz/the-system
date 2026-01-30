/**
 * Job Model
 * Spec: 017-mongodb-schema
 *
 * Per data-model.md Jobs Collection schema
 * Tracks tool creation requests through their entire lifecycle
 */

import { ObjectId } from 'mongodb';
import { JobStatus } from '../types/status';

// ========== CATEGORY TYPES ==========

/**
 * Questionnaire category types
 * Per spec: 4 valid category values
 */
export type CategoryType = 'b2b-product' | 'b2b-service' | 'b2c-product' | 'b2c-service';

/**
 * All valid category values
 */
export const VALID_CATEGORIES: CategoryType[] = [
  'b2b-product',
  'b2b-service',
  'b2c-product',
  'b2c-service'
];

/**
 * Validate category type
 */
export function isValidCategory(category: string): category is CategoryType {
  return VALID_CATEGORIES.includes(category as CategoryType);
}

// ========== QUESTIONNAIRE ==========

/**
 * Questionnaire data embedded in job
 * Per data-model.md: Input from Boss
 */
export interface Questionnaire {
  category: CategoryType;
  decision: string;
  teaching_point: string;
  inputs: string;
  verdict_criteria: string;
}

// ========== QA REPORT ==========

/**
 * QA criterion detail
 */
export interface QACriterionDetail {
  criterion: string;
  passed: boolean;
  note?: string;
}

/**
 * QA Report from QA validation
 * Per data-model.md QAReport interface
 */
export interface QAReport {
  attempt: number;
  result: 'PASS' | 'FAIL';
  score: number;
  max_score: number;
  details: QACriterionDetail[];
  timestamp: Date;
}

// ========== REVISION ==========

/**
 * Revision history entry
 * Per data-model.md Revision interface
 */
export interface Revision {
  notes: string;
  requested_at: Date;
  completed_at?: Date;
}

// ========== JOB INTERFACE ==========

/**
 * Job document interface
 * Per data-model.md Job interface
 */
export interface Job {
  _id?: ObjectId;
  job_id: string;                   // UUID, unique

  // Status
  status: JobStatus;

  // Input (from Boss)
  file_name: string;
  file_content: string;
  questionnaire: Questionnaire;

  // Output (from Factory)
  tool_name?: string;
  tool_slug?: string;
  tool_html?: string;
  template_used?: string;

  // QA
  qa_attempts: number;
  qa_reports: QAReport[];

  // Revisions
  revisions: Revision[];

  // Deployment
  deployed_url?: string;
  deployed_at?: Date;

  // Meta
  created_at: Date;
  updated_at: Date;
}

// ========== CREATION INPUT ==========

/**
 * Input for creating a new job
 */
export interface CreateJobInput {
  file_name: string;
  file_content: string;
  questionnaire: Questionnaire;
}

/**
 * Create a new job document with defaults
 * Per contracts/database.yaml operations.jobs.create
 *
 * @param jobId - UUID for the job
 * @param input - Job input data
 * @returns Job document ready for insertion
 */
export function createJobDocument(jobId: string, input: CreateJobInput): Omit<Job, '_id'> {
  const now = new Date();

  return {
    job_id: jobId,
    status: JobStatus.DRAFT,
    file_name: input.file_name,
    file_content: input.file_content,
    questionnaire: input.questionnaire,
    qa_attempts: 0,
    qa_reports: [],
    revisions: [],
    created_at: now,
    updated_at: now
  };
}

// ========== RESPONSE TYPES ==========

/**
 * Job list item (excludes large fields like tool_html)
 */
export interface JobListItem {
  job_id: string;
  status: string;
  file_name: string;
  tool_name?: string;
  tool_slug?: string;
  category: string;
  qa_attempts: number;
  created_at: string;
  updated_at: string;
  deployed_url?: string;
}

/**
 * Convert job to list item format
 */
export function jobToListItem(job: Job): JobListItem {
  return {
    job_id: job.job_id,
    status: job.status,
    file_name: job.file_name,
    tool_name: job.tool_name,
    tool_slug: job.tool_slug,
    category: job.questionnaire.category,
    qa_attempts: job.qa_attempts,
    created_at: job.created_at.toISOString(),
    updated_at: job.updated_at.toISOString(),
    deployed_url: job.deployed_url
  };
}

/**
 * Job detail response (full data)
 */
export interface JobDetail extends JobListItem {
  file_content: string;
  questionnaire: Questionnaire;
  tool_html?: string;
  template_used?: string;
  qa_reports: QAReport[];
  revisions: Revision[];
  deployed_url?: string;
  deployed_at?: string;
}

/**
 * Convert job to detail format
 */
export function jobToDetail(job: Job): JobDetail {
  return {
    ...jobToListItem(job),
    file_content: job.file_content,
    questionnaire: job.questionnaire,
    tool_html: job.tool_html,
    template_used: job.template_used,
    qa_reports: job.qa_reports,
    revisions: job.revisions,
    deployed_url: job.deployed_url,
    deployed_at: job.deployed_at?.toISOString()
  };
}
