// Logs API Client
// Feature: 025-frontend-logs-view

import { api } from './client.ts';
import type { LogsApiResponse, FactoryLog } from '../types/logs.ts';

// Backend response format (may not include success field)
interface BackendLogsResponse {
  data?: {
    logs: FactoryLog[];
    count: number;
  };
  success?: boolean;
  error?: string;
}

/**
 * Fetch logs for a specific job
 * @param jobId - The job ID to fetch logs for
 * @returns Promise with logs response
 */
export async function getLogs(jobId: string, stage?: string): Promise<{ logs: FactoryLog[]; count: number }> {
  const endpoint = stage ? `/jobs/${jobId}/logs?stage=${stage}` : `/jobs/${jobId}/logs`;
  const response = await api.get<BackendLogsResponse>(endpoint);

  if (response.data && response.data.logs) {
    return response.data;
  }

  return { logs: [], count: 0 };
}

export async function fetchLogs(jobId: string): Promise<LogsApiResponse> {
  try {
    const response = await api.get<BackendLogsResponse>(`/jobs/${jobId}/logs`);

    // Backend returns { data: { logs, count } } without success field
    // Transform to expected format
    if (response.data && response.data.logs) {
      return {
        success: true,
        data: response.data
      };
    }

    // Handle case where response has success field
    if (response.success !== undefined) {
      return response as LogsApiResponse;
    }

    return {
      success: false,
      error: 'Invalid response format'
    };
  } catch (error) {
    // Handle specific error cases
    if (error instanceof Error && 'status' in error) {
      const apiError = error as { status: number; message: string };
      if (apiError.status === 404) {
        return {
          success: false,
          error: 'Job not found'
        };
      }
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch logs'
    };
  }
}
