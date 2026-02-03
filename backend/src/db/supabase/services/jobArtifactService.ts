/**
 * Job Artifact Service (Supabase)
 *
 * Handles job artifact storage (tool_html, preview_html, source_file).
 * Artifacts are large content stored separately from the main jobs table.
 */

import { getSupabase, getTenantId } from '../client';
import { JobArtifact, Database } from '../types';

type ArtifactInsert = Database['public']['Tables']['job_artifacts']['Insert'];
type ArtifactUpdate = Database['public']['Tables']['job_artifacts']['Update'];

/**
 * Get specific artifact for a job
 */
export async function getArtifact(
  jobId: string,
  artifactType: string
): Promise<JobArtifact | null> {
  const supabase = getSupabase();
  const tenantId = getTenantId();

  const { data, error } = await supabase
    .from('job_artifacts')
    .select('*')
    .eq('job_id', jobId)
    .eq('tenant_id', tenantId)
    .eq('artifact_type', artifactType)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw new Error(`Failed to get artifact: ${error.message}`);
  }

  return data;
}

/**
 * Get all artifacts for a job
 */
export async function getArtifactsByJob(jobId: string): Promise<JobArtifact[]> {
  const supabase = getSupabase();
  const tenantId = getTenantId();

  const { data, error } = await supabase
    .from('job_artifacts')
    .select('*')
    .eq('job_id', jobId)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to get artifacts by job: ${error.message}`);
  }

  return data || [];
}

/**
 * Create a new artifact (or update if exists)
 */
export async function createArtifact(
  jobId: string,
  artifactType: string,
  content: string,
  metadata?: Record<string, unknown>
): Promise<JobArtifact> {
  const supabase = getSupabase();
  const tenantId = getTenantId();

  // Upsert - replace if exists
  const { data, error } = await supabase
    .from('job_artifacts')
    .upsert(
      {
        job_id: jobId,
        tenant_id: tenantId,
        artifact_type: artifactType,
        content,
        metadata: metadata || {}
      },
      {
        onConflict: 'job_id,artifact_type'
      }
    )
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create artifact: ${error.message}`);
  }

  return data;
}

/**
 * Update artifact content
 */
export async function updateArtifact(
  jobId: string,
  artifactType: string,
  content: string
): Promise<JobArtifact> {
  const supabase = getSupabase();
  const tenantId = getTenantId();

  const { data, error } = await supabase
    .from('job_artifacts')
    .update({ content })
    .eq('job_id', jobId)
    .eq('tenant_id', tenantId)
    .eq('artifact_type', artifactType)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update artifact: ${error.message}`);
  }

  return data;
}

/**
 * Delete artifact
 */
export async function deleteArtifact(
  jobId: string,
  artifactType: string
): Promise<void> {
  const supabase = getSupabase();
  const tenantId = getTenantId();

  const { error } = await supabase
    .from('job_artifacts')
    .delete()
    .eq('job_id', jobId)
    .eq('tenant_id', tenantId)
    .eq('artifact_type', artifactType);

  if (error) {
    throw new Error(`Failed to delete artifact: ${error.message}`);
  }
}

// ========== CONVENIENCE METHODS ==========

/**
 * Get tool HTML artifact
 */
export async function getToolHtml(jobId: string): Promise<string | null> {
  const artifact = await getArtifact(jobId, 'tool_html');
  return artifact?.content || null;
}

/**
 * Save tool HTML artifact
 */
export async function saveToolHtml(jobId: string, html: string): Promise<JobArtifact> {
  return createArtifact(jobId, 'tool_html', html);
}

/**
 * Get preview HTML artifact
 */
export async function getPreviewHtml(jobId: string): Promise<string | null> {
  const artifact = await getArtifact(jobId, 'preview_html');
  return artifact?.content || null;
}

/**
 * Save preview HTML artifact
 */
export async function savePreviewHtml(jobId: string, html: string): Promise<JobArtifact> {
  return createArtifact(jobId, 'preview_html', html);
}

/**
 * Get source file artifact
 */
export async function getSourceFile(jobId: string): Promise<string | null> {
  const artifact = await getArtifact(jobId, 'source_file');
  return artifact?.content || null;
}

/**
 * Save source file artifact
 */
export async function saveSourceFile(jobId: string, content: string): Promise<JobArtifact> {
  return createArtifact(jobId, 'source_file', content);
}
