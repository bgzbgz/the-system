/**
 * GitHub Deploy Service - Tool Deployment
 * Spec: 022-github-deploy-service (US1, FR-001, FR-002, FR-006)
 * Per contracts/deploy.yaml
 *
 * Handles deploying tool HTML files to GitHub repository
 */

import { DeployResult, GitHubConfig, GitHubErrorType } from './types';
import { getOctokit, getGitHubConfig, withRetry, logOperation, classifyError } from './client';

// ========== URL GENERATION ==========

/**
 * Generate GitHub blob URL for a file
 * Per research.md RT-005: repoUrl pattern
 *
 * @param config - GitHub configuration
 * @param filePath - Path to file in repo
 * @returns GitHub blob URL
 */
export function generateRepoUrl(config: GitHubConfig, filePath: string): string {
  return `https://github.com/${config.owner}/${config.repo}/blob/${config.branch}/${filePath}`;
}

/**
 * Generate raw content URL for a file
 * Per research.md RT-005: rawUrl pattern
 *
 * @param config - GitHub configuration
 * @param filePath - Path to file in repo
 * @returns Raw content URL
 */
export function generateRawUrl(config: GitHubConfig, filePath: string): string {
  return `https://raw.githubusercontent.com/${config.owner}/${config.repo}/${config.branch}/${filePath}`;
}

/**
 * Generate GitHub Pages URL for a file
 * Per research.md RT-005: pagesUrl pattern
 *
 * @param config - GitHub configuration
 * @param filePath - Path to file in repo
 * @returns GitHub Pages URL
 */
export function generatePagesUrl(config: GitHubConfig, filePath: string): string {
  return `https://${config.owner}.github.io/${config.repo}/${filePath}`;
}

// ========== FILE OPERATIONS ==========

/**
 * Get the SHA of an existing file (for updates)
 * Per research.md RT-002: Must provide SHA for updates
 *
 * @param slug - Tool slug
 * @returns File SHA or null if file doesn't exist
 */
async function getFileSha(slug: string): Promise<string | null> {
  const octokit = getOctokit();
  const config = getGitHubConfig();

  if (!octokit || !config) {
    return null;
  }

  const filePath = `tools/${slug}/index.html`;

  try {
    const response = await octokit.repos.getContent({
      owner: config.owner,
      repo: config.repo,
      path: filePath,
      ref: config.branch
    });

    // getContent returns file data with sha
    if (!Array.isArray(response.data) && 'sha' in response.data) {
      return response.data.sha;
    }

    return null;
  } catch (error) {
    const classified = classifyError(error);
    // 404 means file doesn't exist - that's OK for new files
    if (classified.type === GitHubErrorType.NOT_FOUND) {
      return null;
    }
    throw error;
  }
}

/**
 * Create or update a file in the repository
 * Per FR-006: Support both create and update
 *
 * @param filePath - Path for the file
 * @param content - File content (will be base64 encoded)
 * @param sha - Existing file SHA (null for new files)
 * @param slug - Tool slug for commit message
 * @returns Commit SHA
 */
async function createOrUpdateFile(
  filePath: string,
  content: string,
  sha: string | null,
  slug: string
): Promise<string> {
  const octokit = getOctokit();
  const config = getGitHubConfig();

  if (!octokit || !config) {
    throw new Error('GitHub not configured');
  }

  // Base64 encode the content
  const contentBase64 = Buffer.from(content, 'utf-8').toString('base64');

  // Commit message based on create vs update
  const message = sha ? `Update tool: ${slug}` : `Deploy tool: ${slug}`;

  const params: {
    owner: string;
    repo: string;
    path: string;
    message: string;
    content: string;
    branch: string;
    sha?: string;
  } = {
    owner: config.owner,
    repo: config.repo,
    path: filePath,
    message,
    content: contentBase64,
    branch: config.branch
  };

  // Include SHA for updates
  if (sha) {
    params.sha = sha;
  }

  const response = await octokit.repos.createOrUpdateFileContents(params);

  return response.data.commit.sha;
}

// ========== DEPLOY TOOL ==========

/**
 * Deploy tool HTML to GitHub repository
 * Per US1 acceptance criteria and contracts/deploy.yaml
 *
 * @param slug - Tool identifier (URL-safe)
 * @param html - Complete HTML content of the tool
 * @returns DeployResult with URLs and commit SHA
 */
export async function deployTool(slug: string, html: string): Promise<DeployResult> {
  const config = getGitHubConfig();
  const filePath = `tools/${slug}/index.html`;

  // Validation
  if (!slug || slug.trim() === '') {
    logOperation('deployTool', null, false, 'slug is required');
    return {
      success: false,
      filePath,
      error: 'Tool slug is required'
    };
  }

  if (!html || html.trim() === '') {
    logOperation('deployTool', filePath, false, 'html is required');
    return {
      success: false,
      filePath,
      error: 'HTML content is required'
    };
  }

  if (!config) {
    logOperation('deployTool', filePath, false, 'GitHub not configured');
    return {
      success: false,
      filePath,
      error: 'GitHub not configured. Set GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO environment variables.'
    };
  }

  try {
    // Step 1: Check if file exists (get SHA)
    const existingSha = await withRetry(
      () => getFileSha(slug),
      'getFileSha'
    );

    const isUpdate = existingSha !== null;
    logOperation('deployTool', filePath, true, isUpdate ? 'updating existing file' : 'creating new file');

    // Step 2: Create or update file
    const commitSha = await withRetry(
      () => createOrUpdateFile(filePath, html, existingSha, slug),
      'createOrUpdateFile'
    );

    // Step 3: Generate URLs
    const repoUrl = generateRepoUrl(config, filePath);
    const rawUrl = generateRawUrl(config, filePath);
    const pagesUrl = generatePagesUrl(config, filePath);

    logOperation('deployTool', filePath, true, `commit=${commitSha.substring(0, 7)}`);

    return {
      success: true,
      filePath,
      commitSha,
      repoUrl,
      rawUrl,
      pagesUrl
    };
  } catch (error) {
    const classified = classifyError(error);
    logOperation('deployTool', filePath, false, classified.message);

    // Format error message based on type
    let errorMessage = classified.message;

    if (classified.type === GitHubErrorType.AUTH_ERROR) {
      errorMessage = 'GitHub authentication failed. Check GITHUB_TOKEN configuration.';
    } else if (classified.type === GitHubErrorType.NOT_FOUND) {
      errorMessage = `Repository not found: ${config.owner}/${config.repo}. Verify GITHUB_OWNER and GITHUB_REPO.`;
    } else if (classified.type === GitHubErrorType.RATE_LIMIT) {
      errorMessage = 'GitHub API rate limit exceeded. Retry after 60 seconds.';
    }

    return {
      success: false,
      filePath,
      error: errorMessage
    };
  }
}
