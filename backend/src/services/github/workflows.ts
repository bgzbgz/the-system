/**
 * GitHub Deploy Service - Workflow Triggers
 * Spec: 022-github-deploy-service (US2, FR-003, FR-007)
 * Per contracts/workflow-trigger.yaml
 *
 * Handles triggering GitHub Actions workflows for MongoDB collection setup
 */

import { WorkflowTriggerResult, WorkflowStatus, GitHubErrorType } from './types';
import { getOctokit, getGitHubConfig, withRetry, logOperation, classifyError } from './client';

// ========== COLLECTION NAMING ==========

/**
 * Generate MongoDB collection name from tool slug
 * Per US2 acceptance criteria: tool_{slug}_responses
 *
 * @param slug - Tool identifier
 * @returns Collection name
 */
export function generateCollectionName(slug: string): string {
  return `tool_${slug}_responses`;
}

// ========== WORKFLOW DISPATCH ==========

/**
 * Trigger a GitHub Actions workflow via workflow_dispatch
 * Per research.md RT-004: Fire-and-forget pattern
 *
 * @param workflowFile - Workflow filename (e.g., create-tool-collection.yml)
 * @param inputs - Workflow inputs
 */
async function triggerWorkflowDispatch(
  workflowFile: string,
  inputs: Record<string, string>
): Promise<void> {
  const octokit = getOctokit();
  const config = getGitHubConfig();

  if (!octokit || !config) {
    throw new Error('GitHub not configured');
  }

  await octokit.actions.createWorkflowDispatch({
    owner: config.owner,
    repo: config.repo,
    workflow_id: workflowFile,
    ref: config.branch,
    inputs
  });
}

// ========== TRIGGER MONGO SETUP ==========

/**
 * Trigger MongoDB collection creation workflow
 * Per US2 acceptance criteria and contracts/workflow-trigger.yaml
 *
 * @param slug - Tool identifier
 * @param jobId - Job ID for tracking
 * @returns WorkflowTriggerResult
 */
export async function triggerMongoSetup(
  slug: string,
  jobId: string
): Promise<WorkflowTriggerResult> {
  const config = getGitHubConfig();
  const workflowFile = config?.workflowFile || 'create-tool-collection.yml';

  // Validation
  if (!slug || slug.trim() === '') {
    logOperation('triggerMongoSetup', null, false, 'slug is required');
    return {
      success: false,
      workflowFile,
      error: 'Tool slug is required'
    };
  }

  if (!jobId || jobId.trim() === '') {
    logOperation('triggerMongoSetup', null, false, 'jobId is required');
    return {
      success: false,
      workflowFile,
      error: 'Job ID is required'
    };
  }

  if (!config) {
    logOperation('triggerMongoSetup', null, false, 'GitHub not configured');
    return {
      success: false,
      workflowFile,
      error: 'GitHub not configured. Set GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO environment variables.'
    };
  }

  const collectionName = generateCollectionName(slug);

  try {
    // Fire-and-forget: trigger workflow and return immediately
    await withRetry(
      () => triggerWorkflowDispatch(workflowFile, {
        tool_slug: slug,
        job_id: jobId
      }),
      'triggerWorkflowDispatch'
    );

    logOperation('triggerMongoSetup', workflowFile, true, `collection=${collectionName}`);

    return {
      success: true,
      workflowFile,
      collectionName,
      message: 'Workflow triggered successfully'
    };
  } catch (error) {
    const classified = classifyError(error);
    logOperation('triggerMongoSetup', workflowFile, false, classified.message);

    // EC-003: Workflow file missing
    let errorMessage = classified.message;
    if (classified.type === GitHubErrorType.NOT_FOUND) {
      errorMessage = `Workflow file not found. Create .github/workflows/${workflowFile} with workflow_dispatch trigger and inputs: tool_slug, job_id`;
    } else if (classified.type === GitHubErrorType.AUTH_ERROR) {
      errorMessage = 'GitHub token missing workflow permission. Ensure token has "workflow" scope.';
    } else if (classified.type === GitHubErrorType.RATE_LIMIT) {
      errorMessage = 'GitHub API rate limit exceeded. Retry after 60 seconds.';
    }

    return {
      success: false,
      workflowFile,
      error: errorMessage
    };
  }
}

// ========== CHECK WORKFLOW STATUS ==========

/**
 * Get the status of a workflow run
 * Per US4 and contracts/workflow-status.yaml
 *
 * @param runId - GitHub workflow run ID
 * @returns WorkflowStatus or null on error
 */
export async function getWorkflowRun(runId: number): Promise<WorkflowStatus | null> {
  const octokit = getOctokit();
  const config = getGitHubConfig();

  if (!octokit || !config) {
    return null;
  }

  try {
    const response = await withRetry(
      () => octokit.actions.getWorkflowRun({
        owner: config.owner,
        repo: config.repo,
        run_id: runId
      }),
      'getWorkflowRun'
    );

    const run = response.data;

    // Map GitHub status to our enum
    let status: WorkflowStatus['status'] = 'queued';
    if (run.status === 'in_progress') {
      status = 'in_progress';
    } else if (run.status === 'completed') {
      status = 'completed';
    }

    // Map conclusion
    let conclusion: WorkflowStatus['conclusion'] = null;
    if (run.conclusion === 'success') {
      conclusion = 'success';
    } else if (run.conclusion === 'failure') {
      conclusion = 'failure';
    } else if (run.conclusion === 'cancelled') {
      conclusion = 'cancelled';
    }

    logOperation('getWorkflowRun', String(runId), true, `status=${status}`);

    return {
      runId,
      status,
      conclusion,
      startedAt: run.run_started_at || undefined,
      completedAt: run.updated_at || undefined,
      url: run.html_url
    };
  } catch (error) {
    const classified = classifyError(error);
    logOperation('getWorkflowRun', String(runId), false, classified.message);
    return null;
  }
}
