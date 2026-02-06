/**
 * Job Service (Supabase)
 *
 * Replaces the in-memory jobStore with Supabase persistence.
 * Handles jobs and job_artifacts tables.
 */

import { getSupabase, getTenantId } from '../client';
import {
  Job,
  JobInsert,
  JobUpdate,
  JobRow,
  JobStatus,
  ArtifactInsert,
  ArtifactRow
} from '../types';

/**
 * Map Supabase row (id) to Job model (job_id)
 */
function mapRowToJob(row: any): any {
  if (!row) return row;
  const { id, ...rest } = row;
  return { ...rest, job_id: id, id };
}

// ========== JOBS ==========

/**
 * Create a new job
 * Maps job_id to id for Supabase compatibility
 */
export async function createJob(job: JobInsert | any): Promise<Job> {
  const supabase = getSupabase();
  const tenantId = getTenantId();

  // Map job_id to id if present (for compatibility with Job model)
  const { job_id, ...rest } = job;
  const insertData = {
    ...rest,
    tenant_id: tenantId,
    ...(job_id && { id: job_id })  // Map job_id to id
  };

  const { data, error } = await supabase
    .from('jobs')
    .insert(insertData)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create job: ${error.message}`);
  }

  return mapRowToJob(data);
}

/**
 * Get job by ID
 */
export async function getJob(jobId: string): Promise<Job | null> {
  const supabase = getSupabase();
  const tenantId = getTenantId();

  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', jobId)
    .eq('tenant_id', tenantId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw new Error(`Failed to get job: ${error.message}`);
  }

  return mapRowToJob(data);
}

/**
 * Get job by slug
 */
export async function getJobBySlug(slug: string): Promise<Job | null> {
  const supabase = getSupabase();
  const tenantId = getTenantId();

  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('slug', slug)
    .eq('tenant_id', tenantId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to get job by slug: ${error.message}`);
  }

  return mapRowToJob(data);
}

/**
 * Update a job
 */
export async function updateJob(jobId: string, updates: JobUpdate): Promise<Job> {
  const supabase = getSupabase();
  const tenantId = getTenantId();

  const { data, error } = await supabase
    .from('jobs')
    .update(updates)
    .eq('id', jobId)
    .eq('tenant_id', tenantId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update job: ${error.message}`);
  }

  return mapRowToJob(data);
}

/**
 * List jobs with optional filtering
 */
export async function listJobs(options?: {
  status?: JobStatus;
  limit?: number;
  offset?: number;
}): Promise<{ jobs: Job[]; total: number }> {
  const supabase = getSupabase();
  const tenantId = getTenantId();
  const { status, limit = 50, offset = 0 } = options || {};

  let query = supabase
    .from('jobs')
    .select('*', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error, count } = await query;

  if (error) {
    throw new Error(`Failed to list jobs: ${error.message}`);
  }

  return {
    jobs: (data || []).map(mapRowToJob),
    total: count || 0
  };
}

/**
 * Get jobs ready for review (inbox)
 */
export async function getInboxJobs(): Promise<Job[]> {
  const { jobs } = await listJobs({ status: 'READY_FOR_REVIEW' });
  return jobs;
}

/**
 * Delete a job (soft delete by setting status to REJECTED)
 */
export async function deleteJob(jobId: string): Promise<void> {
  await updateJob(jobId, { status: 'REJECTED' });
}

/**
 * Get all jobs with a specific status
 * Used by stale job monitor to find stuck jobs
 */
export async function getJobsByStatus(status: JobStatus): Promise<Job[]> {
  const supabase = getSupabase();
  const tenantId = getTenantId();

  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('status', status)
    .eq('tenant_id', tenantId)
    .order('updated_at', { ascending: true }); // Oldest first

  if (error) {
    throw new Error(`Failed to get jobs by status: ${error.message}`);
  }

  return (data || []).map(mapRowToJob);
}

// ========== JOB ARTIFACTS ==========

/**
 * Save job artifact (tool_html, etc.)
 */
export async function saveArtifact(
  jobId: string,
  artifactType: string,
  content: string,
  metadata?: Record<string, unknown>
): Promise<ArtifactRow> {
  const supabase = getSupabase();
  const tenantId = getTenantId();

  // Upsert - replace if exists
  const { data, error } = await supabase
    .from('job_artifacts')
    .upsert({
      job_id: jobId,
      tenant_id: tenantId,
      artifact_type: artifactType,
      content,
      metadata: metadata || {}
    }, {
      onConflict: 'job_id,artifact_type'
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to save artifact: ${error.message}`);
  }

  return data;
}

/**
 * Get job artifact
 */
export async function getArtifact(
  jobId: string,
  artifactType: string
): Promise<string | null> {
  const supabase = getSupabase();
  const tenantId = getTenantId();

  const { data, error } = await supabase
    .from('job_artifacts')
    .select('content')
    .eq('job_id', jobId)
    .eq('tenant_id', tenantId)
    .eq('artifact_type', artifactType)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to get artifact: ${error.message}`);
  }

  return data.content;
}

/**
 * Get tool HTML for a job
 */
export async function getToolHtml(jobId: string): Promise<string | null> {
  return getArtifact(jobId, 'tool_html');
}

/**
 * Save tool HTML for a job
 */
export async function saveToolHtml(jobId: string, html: string): Promise<void> {
  await saveArtifact(jobId, 'tool_html', html);
}

// ========== JOB WITH HTML (convenience) ==========

/**
 * Get job with tool HTML included
 */
export async function getJobWithHtml(jobId: string): Promise<(Job & { tool_html?: string }) | null> {
  const job = await getJob(jobId);
  if (!job) return null;

  const html = await getToolHtml(jobId);

  return {
    ...job,
    tool_html: html || undefined
  };
}

/**
 * Create job and save HTML in one operation
 */
export async function createJobWithHtml(
  job: JobInsert,
  toolHtml?: string
): Promise<Job> {
  const createdJob = await createJob(job);

  if (toolHtml) {
    await saveToolHtml(createdJob.id, toolHtml);
  }

  return createdJob;
}

/**
 * Update job and save HTML in one operation
 */
export async function updateJobWithHtml(
  jobId: string,
  updates: JobUpdate,
  toolHtml?: string
): Promise<Job> {
  const updatedJob = await updateJob(jobId, updates);

  if (toolHtml !== undefined) {
    await saveToolHtml(jobId, toolHtml);
  }

  return updatedJob;
}
