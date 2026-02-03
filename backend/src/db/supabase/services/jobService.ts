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

// ========== JOBS ==========

/**
 * Create a new job
 */
export async function createJob(job: JobInsert): Promise<Job> {
  const supabase = getSupabase();
  const tenantId = getTenantId();

  const { data, error } = await supabase
    .from('jobs')
    .insert({ ...job, tenant_id: tenantId })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create job: ${error.message}`);
  }

  return data;
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

  return data;
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

  return data;
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

  return data;
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
    jobs: data || [],
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
