/**
 * Job Store Service
 * Spec: 017-mongodb-schema
 *
 * Per contracts/database.yaml operations.jobs
 * CRUD operations for jobs collection with status transition validation
 */

import { Collection, ObjectId } from 'mongodb';
import { getDB, COLLECTIONS } from '../connection';
import { generateUUID } from '../utils/uuid';
import {
  Job,
  CreateJobInput,
  createJobDocument,
  QAReport,
  Revision,
  jobToListItem,
  JobListItem
} from '../models/job';
import { CreateQAReportInput, createQAReport } from '../models/qaReport';
import { CreateRevisionInput, createRevision } from '../models/revision';
import { JobStatus, canTransition, getTransitionError } from '../types/status';
import * as auditService from './auditService';

// Helper to convert MongoDB document to typed Job
function toJob(doc: unknown): Job | null {
  if (!doc) return null;
  const d = doc as Record<string, unknown>;
  if (d._id instanceof ObjectId) {
    return { ...d, _id: d._id.toString() } as unknown as Job;
  }
  return d as unknown as Job;
}

function toJobs(docs: unknown[]): Job[] {
  return docs.map(doc => {
    const d = doc as Record<string, unknown>;
    if (d._id instanceof ObjectId) {
      return { ...d, _id: d._id.toString() } as unknown as Job;
    }
    return d as unknown as Job;
  });
}

// ========== COLLECTION ACCESS ==========

/**
 * Get jobs collection
 */
function getJobsCollection(): Collection {
  return getDB().collection(COLLECTIONS.JOBS);
}

// ========== CREATE ==========

/**
 * Create a new job
 * Per contracts/database.yaml operations.jobs.create
 *
 * @param input - Job input data
 * @param logAudit - Whether to create audit log entry (default: true)
 * @returns Created job with generated job_id
 */
export async function createJob(input: CreateJobInput, logAudit: boolean = true): Promise<Job> {
  const collection = getJobsCollection();
  const jobId = generateUUID();
  const jobDoc = createJobDocument(jobId, input);

  await collection.insertOne(jobDoc);

  const job = { ...jobDoc, job_id: jobId } as Job;

  // Log job.created audit event (T021)
  if (logAudit) {
    await auditService.logJobCreated(
      jobId,
      input.file_name,
      input.questionnaire.category
    );
  }

  return job;
}

// ========== READ ==========

/**
 * Find a job by job_id
 *
 * @param jobId - Job UUID
 * @returns Job or null if not found
 */
export async function findByJobId(jobId: string): Promise<Job | null> {
  const collection = getJobsCollection();
  const job = await collection.findOne({ job_id: jobId });
  return toJob(job);
}

/**
 * Find jobs by status
 *
 * @param status - Job status to filter by
 * @returns Array of jobs
 */
export async function findByStatus(status: JobStatus): Promise<Job[]> {
  const collection = getJobsCollection();
  const jobs = await collection.find({ status }).sort({ created_at: -1 }).toArray();
  return toJobs(jobs);
}

/**
 * Find jobs by status as list items (excludes large fields)
 *
 * @param status - Job status to filter by
 * @returns Array of job list items
 */
export async function findByStatusAsListItems(status: JobStatus): Promise<JobListItem[]> {
  const jobs = await findByStatus(status);
  return jobs.map(jobToListItem);
}

/**
 * Find all jobs with pagination
 *
 * @param options - Pagination options
 * @returns Paginated jobs
 */
export async function findAll(options: {
  limit?: number;
  offset?: number;
  status?: JobStatus;
}): Promise<{ jobs: Job[]; total: number }> {
  const collection = getJobsCollection();
  const { limit = 50, offset = 0, status } = options;

  const filter = status ? { status } : {};

  const [rawJobs, total] = await Promise.all([
    collection.find(filter)
      .sort({ created_at: -1 })
      .skip(offset)
      .limit(limit)
      .toArray(),
    collection.countDocuments(filter)
  ]);

  return { jobs: toJobs(rawJobs), total };
}

// ========== UPDATE STATUS ==========

/**
 * Update result
 */
export interface UpdateResult {
  success: boolean;
  job?: Job;
  error?: string;
}

/**
 * Update job status with transition validation
 * Per contracts/database.yaml operations.jobs.update_status
 *
 * @param jobId - Job UUID
 * @param newStatus - Target status
 * @param logAudit - Whether to create audit log entry (default: true)
 * @returns Update result
 */
export async function updateStatus(
  jobId: string,
  newStatus: JobStatus,
  logAudit: boolean = true
): Promise<UpdateResult> {
  const collection = getJobsCollection();

  // Get current job
  const job = await findByJobId(jobId);
  if (!job) {
    return { success: false, error: `Job not found: ${jobId}` };
  }

  const previousStatus = job.status;

  // Validate transition
  if (!canTransition(previousStatus, newStatus)) {
    return {
      success: false,
      error: getTransitionError(previousStatus, newStatus)
    };
  }

  // Update status
  const result = await collection.findOneAndUpdate(
    { job_id: jobId },
    {
      $set: {
        status: newStatus,
        updated_at: new Date()
      }
    },
    { returnDocument: 'after' }
  );

  if (!result) {
    return { success: false, error: 'Update failed' };
  }

  // Log status.changed audit event (T020)
  if (logAudit) {
    await auditService.logStatusChanged(jobId, previousStatus, newStatus);
  }

  return { success: true, job: toJob(result) as Job };
}

// ========== QA REPORTS ==========

/**
 * Append a QA report to a job
 * Per contracts/database.yaml operations.jobs.append_qa_report
 *
 * @param jobId - Job UUID
 * @param input - QA report input
 * @returns Update result
 */
export async function appendQAReport(jobId: string, input: CreateQAReportInput): Promise<UpdateResult> {
  const collection = getJobsCollection();

  // Get current job to determine attempt number
  const job = await findByJobId(jobId);
  if (!job) {
    return { success: false, error: `Job not found: ${jobId}` };
  }

  const attempt = job.qa_attempts + 1;
  const report = createQAReport(attempt, input);

  // Push report and increment attempts
  const result = await collection.findOneAndUpdate(
    { job_id: jobId },
    {
      $push: { qa_reports: report as unknown },
      $inc: { qa_attempts: 1 },
      $set: { updated_at: new Date() }
    } as Record<string, unknown>,
    { returnDocument: 'after' }
  );

  if (!result) {
    return { success: false, error: 'Update failed' };
  }

  return { success: true, job: toJob(result) as Job };
}

// ========== REVISIONS ==========

/**
 * Append a revision to a job
 * Per contracts/database.yaml operations.jobs.append_revision
 *
 * @param jobId - Job UUID
 * @param input - Revision input
 * @returns Update result
 */
export async function appendRevision(jobId: string, input: CreateRevisionInput): Promise<UpdateResult> {
  const collection = getJobsCollection();

  const job = await findByJobId(jobId);
  if (!job) {
    return { success: false, error: `Job not found: ${jobId}` };
  }

  const revision = createRevision(input);

  const result = await collection.findOneAndUpdate(
    { job_id: jobId },
    {
      $push: { revisions: revision as unknown },
      $set: { updated_at: new Date() }
    } as Record<string, unknown>,
    { returnDocument: 'after' }
  );

  if (!result) {
    return { success: false, error: 'Update failed' };
  }

  return { success: true, job: toJob(result) as Job };
}

/**
 * Mark the latest revision as completed
 *
 * @param jobId - Job UUID
 * @returns Update result
 */
export async function completeLatestRevision(jobId: string): Promise<UpdateResult> {
  const collection = getJobsCollection();

  const job = await findByJobId(jobId);
  if (!job) {
    return { success: false, error: `Job not found: ${jobId}` };
  }

  if (job.revisions.length === 0) {
    return { success: false, error: 'No revisions to complete' };
  }

  // Update the last revision's completed_at
  const lastIndex = job.revisions.length - 1;

  const result = await collection.findOneAndUpdate(
    { job_id: jobId },
    {
      $set: {
        [`revisions.${lastIndex}.completed_at`]: new Date(),
        updated_at: new Date()
      }
    },
    { returnDocument: 'after' }
  );

  if (!result) {
    return { success: false, error: 'Update failed' };
  }

  return { success: true, job: toJob(result) as Job };
}

// ========== DEPLOYMENT ==========

/**
 * Update job deployment information
 *
 * @param jobId - Job UUID
 * @param deployedUrl - Deployed URL
 * @returns Update result
 */
export async function updateDeployment(jobId: string, deployedUrl: string): Promise<UpdateResult> {
  const collection = getJobsCollection();

  const job = await findByJobId(jobId);
  if (!job) {
    return { success: false, error: `Job not found: ${jobId}` };
  }

  const result = await collection.findOneAndUpdate(
    { job_id: jobId },
    {
      $set: {
        deployed_url: deployedUrl,
        deployed_at: new Date(),
        updated_at: new Date()
      }
    },
    { returnDocument: 'after' }
  );

  if (!result) {
    return { success: false, error: 'Update failed' };
  }

  return { success: true, job: toJob(result) as Job };
}

// ========== FACTORY OUTPUT ==========

/**
 * Update job with factory output
 *
 * @param jobId - Job UUID
 * @param output - Factory output
 * @returns Update result
 */
export async function updateFactoryOutput(
  jobId: string,
  output: {
    tool_name: string;
    tool_slug: string;
    tool_html: string;
    template_used?: string;
  }
): Promise<UpdateResult> {
  const collection = getJobsCollection();

  const job = await findByJobId(jobId);
  if (!job) {
    return { success: false, error: `Job not found: ${jobId}` };
  }

  const result = await collection.findOneAndUpdate(
    { job_id: jobId },
    {
      $set: {
        tool_name: output.tool_name,
        tool_slug: output.tool_slug,
        tool_html: output.tool_html,
        template_used: output.template_used,
        updated_at: new Date()
      }
    },
    { returnDocument: 'after' }
  );

  if (!result) {
    return { success: false, error: 'Update failed' };
  }

  return { success: true, job: toJob(result) as Job };
}

// ========== ERROR HANDLING ==========

/**
 * MongoDB duplicate key error code
 */
export const DUPLICATE_KEY_ERROR_CODE = 11000;

/**
 * Check if error is a duplicate key error
 */
export function isDuplicateKeyError(error: unknown): boolean {
  return (error as { code?: number })?.code === DUPLICATE_KEY_ERROR_CODE;
}
