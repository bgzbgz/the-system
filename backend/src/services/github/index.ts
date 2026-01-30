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
import { deployTool } from './deploy';
import { triggerMongoSetup, generateCollectionName, getWorkflowRun } from './workflows';

// Import job store for full deploy pipeline (use in-memory store that routes use)
import { getJob, updateJob } from '../jobStore';
import { JobStatus, Job } from '../../models/job';

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

    // Step 1: Get and validate job from in-memory store
    const job = getJob(jobId);

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

    if (!job.tool_html) {
      logOperation('fullDeploy', jobId, false, 'Job missing tool_html');
      return {
        success: false,
        error: 'Job missing tool_html - cannot deploy'
      };
    }

    const slug = job.slug;
    const html = job.tool_html;

    try {
      // Step 2: Deploy tool HTML (US1)
      const deployResult = await this.deployTool(slug, html);

      if (!deployResult.success) {
        // Deployment failed - update status back
        updateJob(jobId, { status: JobStatus.READY_FOR_REVIEW });
        logOperation('fullDeploy', jobId, false, `deploy failed: ${deployResult.error}`);
        return {
          success: false,
          error: deployResult.error
        };
      }

      // Step 3: Trigger MongoDB workflow (US2) - fire-and-forget (optional)
      let workflowResult: WorkflowTriggerResult = { success: false };
      try {
        workflowResult = await this.triggerMongoSetup(slug, jobId);
        if (!workflowResult.success) {
          console.warn(`[GitHub] Workflow trigger failed for ${jobId}: ${workflowResult.error}`);
        }
      } catch (e) {
        console.warn(`[GitHub] Workflow trigger error for ${jobId}:`, e);
      }

      // Step 4: Update job with deployment info and status
      const deployedUrl = deployResult.pagesUrl || deployResult.repoUrl || '';
      updateJob(jobId, {
        status: JobStatus.DEPLOYED,
        deployed_url: deployedUrl
      });

      logOperation('fullDeploy', jobId, true, `deployed to ${deployedUrl}`);

      return {
        success: true,
        repoUrl: deployResult.repoUrl,
        pagesUrl: deployResult.pagesUrl,
        commitSha: deployResult.commitSha,
        collectionName: workflowResult.collectionName
      };
    } catch (error) {
      // Unexpected error - transition back to READY_FOR_REVIEW
      updateJob(jobId, { status: JobStatus.READY_FOR_REVIEW });

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
export { deployTool } from './deploy';
export { triggerMongoSetup, generateCollectionName, getWorkflowRun } from './workflows';
export { isGitHubConfigured, getGitHubConfig } from './client';
