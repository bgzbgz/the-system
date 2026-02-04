/**
 * Prompt Loader Service
 *
 * Loads AI agent prompts from external GitHub repository with caching and fallback.
 * Enables version control and independent deployment of prompts.
 */

interface PromptLoaderConfig {
  repoOwner: string;
  repoName: string;
  branch?: string;
  cacheTTL?: number; // milliseconds
}

interface PromptCache {
  content: string;
  version: string;
  expiresAt: number;
}

interface ActiveVersions {
  [agentName: string]: string;
}

export class PromptLoader {
  private config: Required<PromptLoaderConfig>;
  private cache: Map<string, PromptCache> = new Map();
  private activeVersionsCache: { data: ActiveVersions | null; expiresAt: number } = {
    data: null,
    expiresAt: 0
  };

  constructor(config: PromptLoaderConfig) {
    this.config = {
      repoOwner: config.repoOwner,
      repoName: config.repoName,
      branch: config.branch || 'main',
      cacheTTL: config.cacheTTL || 5 * 60 * 1000 // 5 minutes default
    };
  }

  /**
   * Fetch active version configuration from GitHub
   */
  private async fetchActiveVersions(): Promise<ActiveVersions> {
    // Check cache first
    const now = Date.now();
    if (this.activeVersionsCache.data && now < this.activeVersionsCache.expiresAt) {
      return this.activeVersionsCache.data;
    }

    const url = `https://raw.githubusercontent.com/${this.config.repoOwner}/${this.config.repoName}/${this.config.branch}/config/active-versions.json`;

    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to fetch active versions: ${response.statusText}`);
      }

      const data = await response.json() as ActiveVersions;

      // Cache the result
      this.activeVersionsCache = {
        data,
        expiresAt: now + this.config.cacheTTL
      };

      return data;
    } catch (error) {
      console.error('[PromptLoader] Failed to fetch active versions:', error);

      // Return cached data even if expired, or throw
      if (this.activeVersionsCache.data) {
        console.warn('[PromptLoader] Using expired active versions cache');
        return this.activeVersionsCache.data;
      }

      throw error;
    }
  }

  /**
   * Fetch a specific prompt from GitHub
   *
   * @param agentName - Name of the agent (e.g., 'courseAnalyst')
   * @param version - Optional specific version (e.g., 'v1.2.0'). If not provided, uses active version.
   */
  async fetchPrompt(agentName: string, version?: string): Promise<string> {
    // Determine version to use
    let targetVersion = version;
    if (!targetVersion) {
      const activeVersions = await this.fetchActiveVersions();
      targetVersion = activeVersions[agentName];

      if (!targetVersion) {
        throw new Error(`No active version found for agent: ${agentName}`);
      }
    }

    // Check cache
    const cacheKey = `${agentName}:${targetVersion}`;
    const cached = this.cache.get(cacheKey);
    const now = Date.now();

    if (cached && now < cached.expiresAt) {
      console.log(`[PromptLoader] Cache hit for ${cacheKey}`);
      return cached.content;
    }

    // Fetch from GitHub
    const url = `https://raw.githubusercontent.com/${this.config.repoOwner}/${this.config.repoName}/${this.config.branch}/prompts/${agentName}/${targetVersion}.md`;

    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to fetch prompt: ${response.statusText}`);
      }

      const content = await response.text();

      // Cache the result
      this.cache.set(cacheKey, {
        content,
        version: targetVersion,
        expiresAt: now + this.config.cacheTTL
      });

      console.log(`[PromptLoader] Fetched ${cacheKey} from GitHub`);
      return content;
    } catch (error) {
      console.error(`[PromptLoader] Failed to fetch prompt ${cacheKey}:`, error);

      // Try to return stale cached data
      if (cached) {
        console.warn(`[PromptLoader] Using expired cache for ${cacheKey}`);
        return cached.content;
      }

      throw error;
    }
  }

  /**
   * Preload prompts for all agents
   * Useful for warming up the cache on application startup
   */
  async preloadAllPrompts(): Promise<void> {
    try {
      const activeVersions = await this.fetchActiveVersions();
      const agentNames = Object.keys(activeVersions);

      console.log(`[PromptLoader] Preloading ${agentNames.length} prompts...`);

      // Load all prompts in parallel
      await Promise.all(
        agentNames.map(agentName =>
          this.fetchPrompt(agentName).catch(err => {
            console.error(`[PromptLoader] Failed to preload ${agentName}:`, err);
          })
        )
      );

      console.log('[PromptLoader] Preload complete');
    } catch (error) {
      console.error('[PromptLoader] Preload failed:', error);
    }
  }

  /**
   * Get currently active version for an agent
   */
  async getActiveVersion(agentName: string): Promise<string> {
    const activeVersions = await this.fetchActiveVersions();
    const version = activeVersions[agentName];

    if (!version) {
      throw new Error(`No active version found for agent: ${agentName}`);
    }

    return version;
  }

  /**
   * Clear the cache (useful for testing or forcing refresh)
   */
  clearCache(): void {
    this.cache.clear();
    this.activeVersionsCache = { data: null, expiresAt: 0 };
    console.log('[PromptLoader] Cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    keys: string[];
    activeVersionsCached: boolean;
  } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
      activeVersionsCached: this.activeVersionsCache.data !== null
    };
  }
}

// Singleton instance
let promptLoaderInstance: PromptLoader | null = null;

/**
 * Initialize the prompt loader (call on app startup)
 */
export function initializePromptLoader(config: PromptLoaderConfig): PromptLoader {
  promptLoaderInstance = new PromptLoader(config);
  return promptLoaderInstance;
}

/**
 * Get the prompt loader instance
 */
export function getPromptLoader(): PromptLoader {
  if (!promptLoaderInstance) {
    throw new Error('PromptLoader not initialized. Call initializePromptLoader() first.');
  }
  return promptLoaderInstance;
}

/**
 * Check if prompt loader is configured
 */
export function isPromptLoaderConfigured(): boolean {
  return promptLoaderInstance !== null;
}
