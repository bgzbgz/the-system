/**
 * Fast Track - Job Model
 * Spec: 016-backend-api
 * Per data-model.md and contracts/jobs.yaml
 */

// ========== ENUMS ==========

/**
 * Category types for questionnaire (T005)
 */
export enum CategoryType {
  B2B_PRODUCT = 'B2B_PRODUCT',
  B2B_SERVICE = 'B2B_SERVICE',
  B2C_PRODUCT = 'B2C_PRODUCT',
  B2C_SERVICE = 'B2C_SERVICE'
}

/**
 * Job lifecycle states (T006)
 * Spec: 016-backend-api - 10 statuses aligned with spec
 */
export enum JobStatus {
  DRAFT = 'DRAFT',                         // Not yet submitted
  FAILED_SEND = 'FAILED_SEND',             // Failed to send to workflow
  SENT = 'SENT',                           // Initial: submitted to workflow
  PROCESSING = 'PROCESSING',               // Workflow is building tool
  FACTORY_FAILED = 'FACTORY_FAILED',       // Factory processing failed
  QA_FAILED = 'QA_FAILED',                 // Failed automated QA checks
  ESCALATED = 'ESCALATED',                 // Requires manual intervention
  READY_FOR_REVIEW = 'READY_FOR_REVIEW',   // Ready for Boss review
  REVISION_REQUESTED = 'REVISION_REQUESTED', // Boss requested changes
  DEPLOY_REQUESTED = 'DEPLOY_REQUESTED',   // Deployment requested
  DEPLOYING = 'DEPLOYING',                 // Deployment in progress
  DEPLOYED = 'DEPLOYED',                   // Successfully deployed
  DEPLOY_FAILED = 'DEPLOY_FAILED',         // Deployment failed
  REJECTED = 'REJECTED'                    // Boss rejected
}

/**
 * Supported file types (legacy - kept for backward compatibility)
 */
export enum FileType {
  PDF = 'PDF',
  DOCX = 'DOCX',
  TXT = 'TXT',
  MD = 'MD'
}

/**
 * QA Report from Factory callback
 */
export interface QAReport {
  score: number;
  max_score: number;
  passed: boolean;
  findings?: QAFinding[];
}

export interface QAFinding {
  check: string;
  passed: boolean;
  message?: string;
}

/**
 * Revision history entry - tracks QA revision attempts
 */
export interface RevisionHistoryEntry {
  attempt: number;
  score: number;
  passed: boolean;
  failed_checks: string[];
  recommendations?: string[];
}

// ========== INTERFACES ==========

/**
 * Job entity - represents a tool creation request (T007, T008, T009, T010)
 */
export interface Job {
  // Identity
  job_id: string;
  slug: string;                          // URL-safe identifier (auto-generated)

  // Input data (T008 - questionnaire-based, not file upload)
  file_name: string;                     // Original file name, max 255
  file_content: string;                  // Extracted text content, max 500,000

  // Questionnaire fields (T007)
  category: CategoryType;
  decision: string;                      // Max 200 chars
  teaching_point: string;                // Max 500 chars
  inputs: string;                        // Max 500 chars
  verdict_criteria: string;              // Max 500 chars

  // Status and timestamps
  status: JobStatus;
  created_at: Date;
  updated_at: Date;

  // Factory results (populated by callback)
  tool_name?: string;
  tool_html?: string;                    // Generated tool, max 10MB
  template_type?: string;
  qa_report?: QAReport;

  // Deployment (populated after approval)
  deployed_url?: string;
  deployed_at?: Date;
  deploy_error?: string;                 // Error from failed deployment

  // Revision (populated when revision requested)
  revision_notes?: string;               // Boss's notes, max 2000
  revision_count?: number;
  revision_history?: RevisionHistoryEntry[];
  revision_applied?: string;             // Description of applied revision

  // Error tracking (T009)
  workflow_error?: string;               // Error from n8n trigger failure

  // Legacy fields (kept for backward compatibility)
  original_filename?: string;            // Alias for file_name
  file_type?: FileType;
  file_size_bytes?: number;
  file_storage_key?: string;
  submitted_at?: Date;
  last_attempt_at?: Date;
  failure_reason?: string;
  tool_id?: string;
  qa_status?: 'PASS' | 'FAIL';
  callback_received_at?: Date;
}

/**
 * Job submission input (questionnaire-based)
 */
export interface JobSubmissionInput {
  file_name: string;
  file_content: string;
  category: CategoryType;
  decision: string;
  teaching_point: string;
  inputs: string;
  verdict_criteria: string;
}

/**
 * Job creation input (legacy - file upload based)
 */
export interface CreateJobInput {
  original_filename: string;
  file_type: FileType;
  file_size_bytes: number;
  file_storage_key: string;
}

/**
 * Job list item response (excludes large fields)
 */
export interface JobListItem {
  job_id: string;
  file_name: string;
  slug: string;
  category: string;
  status: string;
  created_at: string;
  updated_at: string;
  tool_name?: string;
  deployed_url?: string;
  workflow_error?: string;
}

/**
 * Job detail response (includes all fields)
 */
export interface JobDetail extends JobListItem {
  file_content: string;
  decision: string;
  teaching_point: string;
  inputs: string;
  verdict_criteria: string;
  tool_html?: string;
  template_type?: string;
  qa_report?: QAReport;
  deployed_url?: string;
  deployed_at?: string;
  revision_notes?: string;
  workflow_error?: string;
}

/**
 * Job API response (legacy format - kept for backward compatibility)
 */
export interface JobResponse {
  job_id: string;
  original_filename?: string;
  file_name?: string;
  file_type?: string;
  file_size_bytes?: number;
  created_at: string;
  status: string;
  slug?: string;
  category?: string;
  submitted_at?: string;
  last_attempt_at?: string;
  failure_reason?: string;
  tool_id?: string;
  tool_name?: string;
  qa_status?: 'PASS' | 'FAIL';
  callback_received_at?: string;
  workflow_triggered?: boolean;
  workflow_error?: string;
}

/**
 * Job created response
 */
export interface JobCreatedResponse {
  job_id: string;
  slug: string;
  status: string;
  created_at: string;
  workflow_triggered: boolean;
  workflow_error?: string;
}

// ========== MONGOOSE SCHEMA ==========

/**
 * MongoDB schema definition for Job collection
 * Collection: fast_track_tools.jobs
 */
export const JobSchema = {
  job_id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  file_name: {
    type: String,
    required: true,
    maxlength: 255
  },
  file_content: {
    type: String,
    required: true,
    maxlength: 500000
  },
  category: {
    type: String,
    required: true,
    enum: Object.values(CategoryType)
  },
  decision: {
    type: String,
    required: true,
    maxlength: 200
  },
  teaching_point: {
    type: String,
    required: true,
    maxlength: 500
  },
  inputs: {
    type: String,
    required: true,
    maxlength: 500
  },
  verdict_criteria: {
    type: String,
    required: true,
    maxlength: 500
  },
  status: {
    type: String,
    required: true,
    enum: Object.values(JobStatus),
    default: JobStatus.SENT,
    index: true
  },
  created_at: {
    type: Date,
    required: true,
    default: Date.now,
    index: true
  },
  updated_at: {
    type: Date,
    required: true,
    default: Date.now
  },
  tool_name: {
    type: String,
    required: false,
    default: null
  },
  tool_html: {
    type: String,
    required: false,
    default: null,
    maxlength: 10 * 1024 * 1024
  },
  template_type: {
    type: String,
    required: false,
    default: null
  },
  qa_report: {
    type: Object,
    required: false,
    default: null
  },
  deployed_url: {
    type: String,
    required: false,
    default: null
  },
  deployed_at: {
    type: Date,
    required: false,
    default: null
  },
  revision_notes: {
    type: String,
    required: false,
    default: null,
    maxlength: 2000
  },
  revision_count: {
    type: Number,
    required: false,
    default: 0
  },
  revision_history: {
    type: Array,
    required: false,
    default: []
  },
  workflow_error: {
    type: String,
    required: false,
    default: null
  },
  // Legacy fields
  file_type: {
    type: String,
    required: false,
    enum: [...Object.values(FileType), null],
    default: null
  },
  file_size_bytes: {
    type: Number,
    required: false,
    default: null
  },
  file_storage_key: {
    type: String,
    required: false,
    default: null
  }
};

// ========== VALIDATION ==========

/**
 * Validate file type string
 */
export function isValidFileType(type: string): type is FileType {
  return Object.values(FileType).includes(type as FileType);
}

/**
 * Validate category type string
 */
export function isValidCategoryType(type: string): type is CategoryType {
  return Object.values(CategoryType).includes(type as CategoryType);
}

/**
 * Validate job status string
 */
export function isValidJobStatus(status: string): status is JobStatus {
  return Object.values(JobStatus).includes(status as JobStatus);
}

// ========== HELPER FUNCTIONS ==========

/**
 * Safely convert a date value to ISO string
 * Handles both Date objects and string values (from Supabase)
 */
function toISOString(value: Date | string | undefined | null): string {
  if (!value) return new Date().toISOString();
  if (typeof value === 'string') return value;
  return value.toISOString();
}

// ========== FACTORY FUNCTIONS ==========

/**
 * Create a new Job entity from questionnaire submission
 */
export function createJobFromSubmission(
  input: JobSubmissionInput,
  jobId: string,
  slug: string
): Job {
  const now = new Date();
  return {
    job_id: jobId,
    slug,
    file_name: input.file_name,
    file_content: input.file_content,
    category: input.category,
    decision: input.decision,
    teaching_point: input.teaching_point,
    inputs: input.inputs,
    verdict_criteria: input.verdict_criteria,
    status: JobStatus.SENT,
    created_at: now,
    updated_at: now
  };
}

/**
 * Create a new Job entity (legacy - file upload based)
 */
export function createJob(input: CreateJobInput, jobId: string): Job {
  const now = new Date();
  return {
    job_id: jobId,
    slug: jobId, // Use job_id as slug for legacy jobs
    file_name: input.original_filename,
    file_content: '', // Empty for legacy jobs
    category: CategoryType.B2B_PRODUCT, // Default
    decision: '',
    teaching_point: '',
    inputs: '',
    verdict_criteria: '',
    status: JobStatus.SENT,
    created_at: now,
    updated_at: now,
    file_type: input.file_type,
    file_size_bytes: input.file_size_bytes,
    file_storage_key: input.file_storage_key
  };
}

/**
 * Convert Job to list item format (excludes tool_html)
 */
export function jobToListItem(job: Job): JobListItem {
  return {
    job_id: job.job_id,
    file_name: job.file_name,
    slug: job.slug,
    category: job.category,
    status: job.status,
    created_at: toISOString(job.created_at),
    updated_at: toISOString(job.updated_at),
    ...(job.tool_name && { tool_name: job.tool_name }),
    ...(job.deployed_url && { deployed_url: job.deployed_url }),
    ...(job.workflow_error && { workflow_error: job.workflow_error })
  };
}

/**
 * Convert Job to detail format (includes all fields)
 */
export function jobToDetail(job: Job): JobDetail {
  return {
    job_id: job.job_id,
    file_name: job.file_name,
    slug: job.slug,
    category: job.category,
    status: job.status,
    created_at: toISOString(job.created_at),
    updated_at: toISOString(job.updated_at),
    file_content: job.file_content,
    decision: job.decision,
    teaching_point: job.teaching_point,
    inputs: job.inputs,
    verdict_criteria: job.verdict_criteria,
    ...(job.tool_name && { tool_name: job.tool_name }),
    ...(job.tool_html && { tool_html: job.tool_html }),
    ...(job.template_type && { template_type: job.template_type }),
    ...(job.qa_report && { qa_report: job.qa_report }),
    ...(job.deployed_url && { deployed_url: job.deployed_url }),
    ...(job.deployed_at && { deployed_at: toISOString(job.deployed_at) }),
    ...(job.revision_notes && { revision_notes: job.revision_notes }),
    ...(job.workflow_error && { workflow_error: job.workflow_error })
  };
}

/**
 * Convert Job to API response format (legacy)
 */
export function jobToResponse(job: Job): JobResponse {
  const response: JobResponse = {
    job_id: job.job_id,
    file_name: job.file_name,
    original_filename: job.file_name,
    created_at: toISOString(job.created_at),
    status: job.status,
    slug: job.slug,
    category: job.category
  };

  if (job.file_type) {
    response.file_type = job.file_type;
  }
  if (job.file_size_bytes) {
    response.file_size_bytes = job.file_size_bytes;
  }
  if (job.submitted_at) {
    response.submitted_at = toISOString(job.submitted_at);
  }
  if (job.last_attempt_at) {
    response.last_attempt_at = toISOString(job.last_attempt_at);
  }
  if (job.failure_reason) {
    response.failure_reason = job.failure_reason;
  }
  if (job.tool_id) {
    response.tool_id = job.tool_id;
  }
  if (job.tool_name) {
    response.tool_name = job.tool_name;
  }
  if (job.qa_status) {
    response.qa_status = job.qa_status;
  }
  if (job.callback_received_at) {
    response.callback_received_at = toISOString(job.callback_received_at);
  }
  if (job.workflow_error) {
    response.workflow_error = job.workflow_error;
  }

  return response;
}

/**
 * Convert Job to created response format
 */
export function jobToCreatedResponse(
  job: Job,
  workflowTriggered: boolean,
  workflowError?: string
): JobCreatedResponse {
  return {
    job_id: job.job_id,
    slug: job.slug,
    status: job.status,
    created_at: toISOString(job.created_at),
    workflow_triggered: workflowTriggered,
    ...(workflowError && { workflow_error: workflowError })
  };
}
