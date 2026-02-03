/**
 * Report Generator
 * Feature: 020-self-improving-factory
 *
 * Generates weekly quality pattern reports.
 */

import {
  WeeklyPatternReport,
  QualityPattern,
  CriterionId,
  PatternTrend,
} from '../qualityScoring/types';
import * as qualityStore from '../../db/services/qualityStore';
import { detectPatterns } from './index';

/**
 * Generate weekly pattern report (T044)
 *
 * @returns Weekly report with top 3 issues and summary stats
 */
export async function generateWeeklyReport(): Promise<WeeklyPatternReport> {
  const weekEnd = new Date();
  const weekStart = new Date(weekEnd.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Get all scores from the week
  const scores = await qualityStore.getScoresInWindow(weekStart, weekEnd);

  // Calculate average score
  const averageScore = scores.length > 0
    ? scores.reduce((sum, s) => sum + s.overall_score, 0) / scores.length
    : 0;

  // Detect current patterns
  const patterns = await detectPatterns();

  // Get top 3 issues by failure rate
  const topIssues = patterns
    .sort((a, b) => b.failure_rate - a.failure_rate)
    .slice(0, 3)
    .map(p => ({
      criterion_id: p.criterion_id,
      failure_rate: p.failure_rate,
      trend: p.trend,
    }));

  // If fewer than 3 patterns, fill with criteria that have lower failure rates
  if (topIssues.length < 3 && scores.length > 0) {
    const existingCriteria = new Set(topIssues.map(i => i.criterion_id));
    const allCriteria: CriterionId[] = [
      'decision', 'zero_questions', 'easy_steps', 'feedback',
      'gamification', 'results', 'commitment', 'brand'
    ];

    for (const criterionId of allCriteria) {
      if (existingCriteria.has(criterionId)) continue;
      if (topIssues.length >= 3) break;

      const failCount = scores.filter(s =>
        !s.criteria.find(c => c.criterion_id === criterionId)?.passed
      ).length;
      const failureRate = Math.round((failCount / scores.length) * 100);

      if (failureRate > 0) {
        topIssues.push({
          criterion_id: criterionId,
          failure_rate: failureRate,
          trend: 'stable' as PatternTrend,
        });
      }
    }
  }

  return {
    week_start: weekStart,
    week_end: weekEnd,
    top_issues: topIssues,
    total_tools: scores.length,
    average_score: Math.round(averageScore * 10) / 10,
  };
}

/**
 * Format weekly report for display
 */
export function formatWeeklyReport(report: WeeklyPatternReport): string {
  const lines: string[] = [
    `Weekly Quality Report`,
    `Period: ${report.week_start.toDateString()} - ${report.week_end.toDateString()}`,
    ``,
    `Summary:`,
    `- Total tools analyzed: ${report.total_tools}`,
    `- Average quality score: ${report.average_score}/100`,
    ``,
  ];

  if (report.top_issues.length > 0) {
    lines.push(`Top Quality Issues:`);
    for (let i = 0; i < report.top_issues.length; i++) {
      const issue = report.top_issues[i];
      const trendIcon = issue.trend === 'improving' ? '↑' :
                        issue.trend === 'worsening' ? '↓' : '→';
      lines.push(`${i + 1}. ${formatCriterionName(issue.criterion_id)}: ${issue.failure_rate}% failure rate ${trendIcon}`);
    }
  } else {
    lines.push(`No significant quality issues detected.`);
  }

  return lines.join('\n');
}

/**
 * Format criterion ID to human-readable name
 */
function formatCriterionName(criterionId: CriterionId): string {
  const names: Record<CriterionId, string> = {
    decision: 'GO/NO-GO Decision',
    zero_questions: 'Zero Questions (Placeholders)',
    easy_steps: 'Easy First Steps',
    feedback: 'Instant Feedback',
    gamification: 'Progress Indicators',
    results: 'Clear Results',
    commitment: 'WWW Commitment',
    brand: 'Brand Compliance',
  };
  return names[criterionId] || criterionId;
}
