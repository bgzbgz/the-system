/**
 * Live Logs API Client
 * For the Factory Floor real-time view
 */

import { apiRequest } from './client.ts';

// ========== TYPES ==========

export type LogLevel = 'info' | 'warn' | 'error' | 'success';
export type LogCategory = 'job' | 'pipeline' | 'ai' | 'deploy' | 'system' | 'monitor';

export interface LiveLogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  category: LogCategory;
  message: string;
  jobId?: string;
  jobName?: string;
  stage?: string;
  details?: Record<string, unknown>;
}

export interface ActiveJob {
  jobId: string;
  jobName: string;
  lastStage?: string;
  lastActivity: string;
  status: 'processing' | 'complete' | 'error';
}

export interface FactoryStats {
  totalLogs: number;
  recentActivity: number;
  activeJobs: number;
  byCategory: Record<LogCategory, number>;
  byLevel: Record<LogLevel, number>;
}

// ========== API FUNCTIONS ==========

/**
 * Get recent activity logs
 */
export async function getLiveLogs(options?: {
  limit?: number;
  since?: string;
  category?: LogCategory;
  jobId?: string;
}): Promise<{ logs: LiveLogEntry[]; count: number }> {
  const params = new URLSearchParams();
  if (options?.limit) params.set('limit', options.limit.toString());
  if (options?.since) params.set('since', options.since);
  if (options?.category) params.set('category', options.category);
  if (options?.jobId) params.set('jobId', options.jobId);

  const query = params.toString();
  const url = query ? `/live/logs?${query}` : '/live/logs';

  return apiRequest<{ logs: LiveLogEntry[]; count: number }>(url);
}

/**
 * Get active jobs for conveyor belt
 */
export async function getActiveJobs(): Promise<{ jobs: ActiveJob[]; count: number }> {
  return apiRequest<{ jobs: ActiveJob[]; count: number }>('/live/active-jobs');
}

/**
 * Get factory statistics
 */
export async function getFactoryStats(): Promise<{ stats: FactoryStats }> {
  return apiRequest<{ stats: FactoryStats }>('/live/stats');
}
