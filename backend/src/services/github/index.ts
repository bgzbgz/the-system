/**
 * GitHub Deploy Service
 * Spec: 022-github-deploy-service
 *
 * Main entry point for GitHub deployment operations
 * Orchestrates US1 (deploy), US2 (trigger workflow), US3 (full pipeline), US4 (status check)
 */

import {
  GitHubConfig,
  DeployResult,
  WorkflowTriggerResult,
  WorkflowStatus,
  FullDeployResult
} from './types';
import { getGitHubConfig, isGitHubConfigured, logOperation } from './client';
import { deployTool, waitForPagesLive } from './deploy';
import { triggerMongoSetup, generateCollectionName, getWorkflowRun } from './workflows';

// Import job services (Supabase)
import { jobService, jobArtifactService, toolDefaultService } from '../../db/supabase';
import { JobStatus, Job } from '../../models/job';

// ========== DEFAULTS BUILDER (Feature 021) ==========

/**
 * Build defaults input from job data after successful deploy
 * Per research.md RT-004: Construct defaults from job data during fullDeploy
 *
 * Uses job.analysis_result (persisted ContentAnalysisResult) as the source
 * for course_context and tool_config, since pipeline-only fields like
 * _courseContext and toolSpec are NOT persisted to the database.
 *
 * @param job - Job with tool data
 * @param deployResult - Successful deploy result
 * @returns ToolDefaultInsert for Supabase
 */
export function buildDefaultsFromJob(
  job: Job,
  deployResult: DeployResult
): {
  tool_slug: string;
  tool_name: string;
  github_url: string;
  deployed_at: string;
  tool_config: Record<string, unknown>;
  course_context: Record<string, unknown>;
  sprint_number?: number;
  module_number?: number;
  canonical_slug?: string;
} {
  const slug = job.slug || '';
  const toolName = job.tool_name || 'Unnamed Tool';
  const githubUrl = deployResult.pagesUrl || deployResult.repoUrl || '';

  const courseContext: Record<string, unknown> = {};
  const toolConfig: Record<string, unknown> = {};

  // Build from analysis_result (persisted to DB from AI-first analysis flow)
  const analysis = job.analysis_result;
  if (analysis) {
    // Map terminology
    if (analysis.terminology && analysis.terminology.length > 0) {
      courseContext.terminology = analysis.terminology.map(t => ({
        term: t.term,
        definition: t.definition
      }));
    }

    // Map framework
    if (analysis.framework) {
      courseContext.frameworks = [{
        name: analysis.framework.name,
        items: analysis.framework.items,
        description: `Framework with ${analysis.framework.items?.length || 0} items`
      }];
    }

    // Map expert quotes
    if (analysis.expertQuotes && analysis.expertQuotes.length > 0) {
      courseContext.expertQuotes = analysis.expertQuotes.map(q => ({
        quote: q.quote,
        source: q.source
      }));
    }

    // Map verdict criteria
    if (analysis.goCondition || analysis.noGoCondition) {
      courseContext.verdictCriteria = {
        go: analysis.goCondition,
        noGo: analysis.noGoCondition
      };
    }

    // Build tool_config from suggested inputs
    if (analysis.suggestedInputs && analysis.suggestedInputs.length > 0) {
      toolConfig.inputs = analysis.suggestedInputs;
    }

    // Store decision info
    if (analysis.decisionType) {
      toolConfig.decisionType = analysis.decisionType;
    }
    if (analysis.suggestedToolName) {
      toolConfig.suggestedToolName = analysis.suggestedToolName;
    }
  }

  // Extract sprint metadata from job if available
  // These come from the course analysis or job metadata
  const jobMeta = job as any; // Access extended fields that may exist
  const sprintNumber = jobMeta.sprint_number || (toolConfig as any).sprint_number || undefined;
  const moduleNumber = jobMeta.module_number || (toolConfig as any).module_number || undefined;
  const canonicalSlug = jobMeta.canonical_slug || (toolConfig as any).canonical_slug || undefined;

  const result: any = {
    tool_slug: slug,
    tool_name: toolName,
    github_url: githubUrl,
    deployed_at: new Date().toISOString(),
    tool_config: toolConfig,
    course_context: courseContext,
  };

  if (sprintNumber != null) result.sprint_number = sprintNumber;
  if (moduleNumber != null) result.module_number = moduleNumber;
  if (canonicalSlug) result.canonical_slug = canonicalSlug;

  return result;
}

// ========== GITHUB SERVICE CLASS ==========

/**
 * GitHub Deploy Service
 * Orchestrates deployment operations for approved tools
 */
export class GitHubService {
  /**
   * Check if GitHub service is configured
   */
  isConfigured(): boolean {
    return isGitHubConfigured();
  }

  /**
   * Get current GitHub configuration (excluding token)
   * For logging/debugging only
   */
  getConfigInfo(): { owner: string; repo: string; branch: string } | null {
    const config = getGitHubConfig();
    if (!config) return null;

    return {
      owner: config.owner,
      repo: config.repo,
      branch: config.branch
    };
  }

  // ========== US1: DEPLOY TOOL ==========

  /**
   * Deploy tool HTML to GitHub repository
   * Per US1 and contracts/deploy.yaml
   *
   * @param slug - Tool identifier (URL-safe)
   * @param html - Complete HTML content
   * @returns DeployResult
   */
  async deployTool(slug: string, html: string): Promise<DeployResult> {
    return deployTool(slug, html);
  }

  // ========== US2: TRIGGER WORKFLOW ==========

  /**
   * Trigger MongoDB collection creation workflow
   * Per US2 and contracts/workflow-trigger.yaml
   *
   * @param slug - Tool identifier
   * @param jobId - Job ID for tracking
   * @returns WorkflowTriggerResult
   */
  async triggerMongoSetup(slug: string, jobId: string): Promise<WorkflowTriggerResult> {
    return triggerMongoSetup(slug, jobId);
  }

  // ========== US3: FULL DEPLOY ==========

  /**
   * Execute full deployment pipeline
   * Per US3 and contracts/full-deploy.yaml
   *
   * Fire-and-forget: Returns immediately after workflow trigger
   *
   * @param jobId - Job UUID
   * @returns FullDeployResult
   */
  async fullDeploy(jobId: string): Promise<FullDeployResult> {
    logOperation('fullDeploy', jobId, true, 'starting');

    // Step 1: Get and validate job from Supabase
    const job = await jobService.getJob(jobId);

    if (!job) {
      logOperation('fullDeploy', jobId, false, 'Job not found');
      return {
        success: false,
        error: `Job not found: ${jobId}`
      };
    }

    if (!job.slug) {
      logOperation('fullDeploy', jobId, false, 'Job missing slug');
      return {
        success: false,
        error: 'Job missing slug - cannot deploy'
      };
    }

    // Get tool HTML from artifacts table
    const toolHtml = await jobArtifactService.getToolHtml(jobId);

    if (!toolHtml) {
      logOperation('fullDeploy', jobId, false, 'Job missing tool_html');
      return {
        success: false,
        error: 'Job missing tool_html - cannot deploy'
      };
    }

    const slug = job.slug;
    const html = toolHtml;

    try {
      // Step 2: Deploy tool HTML (US1)
      const deployResult = await this.deployTool(slug, html);

      if (!deployResult.success) {
        // Deployment failed - update status back
        await jobService.updateJob(jobId, { status: JobStatus.READY_FOR_REVIEW });
        logOperation('fullDeploy', jobId, false, `deploy failed: ${deployResult.error}`);
        return {
          success: false,
          error: deployResult.error
        };
      }

      // Step 3: Feature 021 - Save defaults to Supabase tool_defaults table
      try {
        const defaultsInput = buildDefaultsFromJob(job, deployResult);
        await toolDefaultService.createToolDefault(defaultsInput);
        logOperation('fullDeploy', jobId, true, `defaults saved to Supabase tool_defaults`);
      } catch (e) {
        // Log but don't fail deployment - defaults can be created later
        console.warn(`[GitHub] Failed to save defaults for ${jobId}:`, e);
        logOperation('fullDeploy', jobId, false, `defaults save failed: ${e}`);
      }

      // Step 4: Trigger MongoDB workflow (US2) - fire-and-forget (optional, legacy)
      let workflowResult: WorkflowTriggerResult = { success: false, workflowFile: 'create-tool-collection.yml' };
      try {
        workflowResult = await this.triggerMongoSetup(slug, jobId);
        if (!workflowResult.success) {
          console.warn(`[GitHub] Workflow trigger failed for ${jobId}: ${workflowResult.error}`);
        }
      } catch (e) {
        console.warn(`[GitHub] Workflow trigger error for ${jobId}:`, e);
      }

      // Step 5: Wait for GitHub Pages to be live before returning URL
      let verifiedPagesUrl: string | null = null;
      if (deployResult.pagesUrl) {
        logOperation('fullDeploy', jobId, true, 'waiting for GitHub Pages to propagate...');
        verifiedPagesUrl = await waitForPagesLive(deployResult.pagesUrl);

        if (!verifiedPagesUrl) {
          // Pages not live yet - still mark as deployed but warn
          logOperation('fullDeploy', jobId, false, 'GitHub Pages not live after timeout - check Pages settings');
          console.log(`[GitHub] WARNING: GitHub Pages not responding at ${deployResult.pagesUrl}`);
          console.log(`[GitHub] Ensure GitHub Pages is enabled:`);
          console.log(`[GitHub]   1. Go to repo Settings → Pages`);
          console.log(`[GitHub]   2. Set Source: "Deploy from a branch" → main → / (root)`);
        }
      }

      // Step 6: Update job with deployment info and status
      // Only set deployed_url if the page is actually live
      const deployedUrl = verifiedPagesUrl || '';
      await jobService.updateJob(jobId, {
        status: JobStatus.DEPLOYED,
        deployed_url: deployedUrl
      });

      if (verifiedPagesUrl) {
        logOperation('fullDeploy', jobId, true, `deployed and verified live at ${verifiedPagesUrl}`);
      } else {
        logOperation('fullDeploy', jobId, true, `deployed to GitHub but Pages URL not yet accessible`);
      }

      return {
        success: true,
        repoUrl: deployResult.repoUrl,
        pagesUrl: verifiedPagesUrl || undefined, // Only return if verified
        commitSha: deployResult.commitSha,
        collectionName: workflowResult.collectionName
      };
    } catch (error) {
      // Unexpected error - transition back to READY_FOR_REVIEW
      await jobService.updateJob(jobId, { status: JobStatus.READY_FOR_REVIEW });

      const message = error instanceof Error ? error.message : String(error);
      logOperation('fullDeploy', jobId, false, message);

      return {
        success: false,
        error: message
      };
    }
  }

  // ========== US4: CHECK WORKFLOW STATUS ==========

  /**
   * Check workflow run status
   * Per US4 and contracts/workflow-status.yaml
   *
   * @param runId - GitHub workflow run ID
   * @returns WorkflowStatus or null
   */
  async checkWorkflowStatus(runId: number): Promise<WorkflowStatus | null> {
    return getWorkflowRun(runId);
  }
}

// ========== SINGLETON EXPORT ==========

export const githubService = new GitHubService();

// Re-export types
export * from './types';

// Re-export individual functions for direct use
export { deployTool, waitForPagesLive } from './deploy';
export { triggerMongoSetup, generateCollectionName, getWorkflowRun } from './workflows';
export { isGitHubConfigured, getGitHubConfig } from './client';
