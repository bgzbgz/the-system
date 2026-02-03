/**
 * AI Cost Tracking Service
 *
 * Tracks AI API costs per job for monitoring and billing.
 * Stores costs in-memory with periodic flush to database.
 */

import { TOKEN_COSTS } from './types';
import logger from '../../utils/logger';

// ========== TYPES ==========

export interface CostEntry {
  jobId: string;
  stage: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  timestamp: Date;
  usedFallback: boolean;
}

export interface JobCostSummary {
  jobId: string;
  totalCostUsd: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  stageBreakdown: Record<string, number>;
  providerBreakdown: Record<string, number>;
  entries: CostEntry[];
}

// ========== IN-MEMORY STORE ==========

const costEntries: Map<string, CostEntry[]> = new Map();

// ========== PUBLIC API ==========

/**
 * Track a cost entry for a job
 */
export function trackCost(entry: Omit<CostEntry, 'timestamp'>): void {
  const fullEntry: CostEntry = {
    ...entry,
    timestamp: new Date()
  };

  const jobEntries = costEntries.get(entry.jobId) || [];
  jobEntries.push(fullEntry);
  costEntries.set(entry.jobId, jobEntries);

  logger.info('Cost tracked', {
    jobId: entry.jobId,
    stage: entry.stage,
    costUsd: entry.costUsd.toFixed(6),
    provider: entry.provider
  });
}

/**
 * Get cost summary for a job
 */
export function getJobCostSummary(jobId: string): JobCostSummary | null {
  const entries = costEntries.get(jobId);
  if (!entries || entries.length === 0) return null;

  const stageBreakdown: Record<string, number> = {};
  const providerBreakdown: Record<string, number> = {};
  let totalCostUsd = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  for (const entry of entries) {
    totalCostUsd += entry.costUsd;
    totalInputTokens += entry.inputTokens;
    totalOutputTokens += entry.outputTokens;

    stageBreakdown[entry.stage] = (stageBreakdown[entry.stage] || 0) + entry.costUsd;
    providerBreakdown[entry.provider] = (providerBreakdown[entry.provider] || 0) + entry.costUsd;
  }

  return {
    jobId,
    totalCostUsd,
    totalInputTokens,
    totalOutputTokens,
    stageBreakdown,
    providerBreakdown,
    entries
  };
}

/**
 * Get total costs across all jobs in a time window
 */
export function getTotalCosts(since?: Date): {
  totalCostUsd: number;
  jobCount: number;
  providerBreakdown: Record<string, number>;
} {
  let totalCostUsd = 0;
  let jobCount = 0;
  const providerBreakdown: Record<string, number> = {};

  for (const [jobId, entries] of costEntries.entries()) {
    const relevantEntries = since
      ? entries.filter(e => e.timestamp >= since)
      : entries;

    if (relevantEntries.length > 0) {
      jobCount++;
      for (const entry of relevantEntries) {
        totalCostUsd += entry.costUsd;
        providerBreakdown[entry.provider] = (providerBreakdown[entry.provider] || 0) + entry.costUsd;
      }
    }
  }

  return { totalCostUsd, jobCount, providerBreakdown };
}

/**
 * Clear cost entries for a job (after persisting to DB)
 */
export function clearJobCosts(jobId: string): void {
  costEntries.delete(jobId);
}

/**
 * Get all job IDs with tracked costs
 */
export function getTrackedJobIds(): string[] {
  return Array.from(costEntries.keys());
}
