import { api } from './client.ts';
import type { QualityDashboard, QualityTrends, QualityScore } from '../types/index.ts';

// Backend response for dashboard
interface BackendDashboardResponse {
  period: {
    start_date: string;
    end_date: string;
    days: number;
  };
  total_tools: number;
  average_score: number;
  pass_rate: number;
  score_trend: 'up' | 'down' | 'stable';
  criterion_pass_rates: Record<string, number>;
  daily_scores: Array<{
    date: string;
    average_score: number;
    total_tools: number;
  }>;
}

// Backend response for trends
interface BackendTrendsResponse {
  daily: Array<{
    date: string;
    average_score: number;
    total_tools: number;
  }>;
  criterion_trends: Record<string, Array<{ date: string; pass_rate: number }>>;
}

// Backend response for single score
interface BackendScoreResponse {
  job_id: string;
  overall_score: number;
  passed: boolean;
  criteria: Array<{
    id: string;
    name: string;
    passed: boolean;
    score: number;
    feedback: string | null;
  }>;
  created_at: string;
}

// Wrapper type for backend responses
interface BackendWrapper<T> {
  success: boolean;
  data: T;
  error?: string;
}

/**
 * Get quality dashboard summary
 */
export async function getDashboard(days: number = 30): Promise<QualityDashboard> {
  const wrapper = await api.get<BackendWrapper<BackendDashboardResponse>>(`/quality/dashboard?days=${days}`);
  const response = wrapper.data;

  return {
    period: {
      startDate: response.period.start_date,
      endDate: response.period.end_date,
      days: response.period.days,
    },
    totalTools: response.total_tools,
    averageScore: response.average_score,
    passRate: response.pass_rate,
    scoreTrend: response.score_trend,
    criterionPassRates: response.criterion_pass_rates,
    dailyScores: response.daily_scores.map((d) => ({
      date: d.date,
      averageScore: d.average_score,
      totalTools: d.total_tools,
      passRate: 0, // Calculated from average_score
    })),
  };
}

/**
 * Get quality trends
 */
export async function getTrends(days: number = 30): Promise<QualityTrends> {
  const wrapper = await api.get<BackendWrapper<BackendTrendsResponse>>(`/quality/trends?days=${days}`);
  const response = wrapper.data;

  // Transform criterion_trends to camelCase
  const criterionTrends: Record<string, { date: string; passRate: number }[]> = {};
  for (const [key, values] of Object.entries(response.criterion_trends || {})) {
    criterionTrends[key] = values.map((v) => ({
      date: v.date,
      passRate: v.pass_rate,
    }));
  }

  return {
    daily: (response.daily || []).map((d) => ({
      date: d.date,
      averageScore: d.average_score,
      totalTools: d.total_tools,
      passRate: 0,
    })),
    criterionTrends,
  };
}

/**
 * Get quality score for a specific job
 */
export async function getScoreByJobId(jobId: string): Promise<QualityScore | null> {
  try {
    const wrapper = await api.get<BackendWrapper<BackendScoreResponse>>(`/quality/scores/${jobId}`);
    const response = wrapper.data;

    return {
      jobId: response.job_id,
      overallScore: response.overall_score,
      passed: response.passed,
      criteria: (response.criteria || []).map((c) => ({
        id: c.id,
        name: c.name,
        passed: c.passed,
        score: c.score,
        feedback: c.feedback,
      })),
      createdAt: response.created_at,
    };
  } catch {
    return null;
  }
}

// Export all functions
export const qualityApi = {
  getDashboard,
  getTrends,
  getScoreByJobId,
};
