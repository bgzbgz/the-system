// Quality Metrics Dashboard View
// Feature: Boss Office Redesign

import { getDashboard, getTrends } from '../api/quality.ts';
import { renderMetricGrid } from '../components/metric-card.ts';
import { renderTrendChart, renderBarChart } from '../components/trend-chart.ts';
import type { QualityDashboard, QualityTrends } from '../types/index.ts';

// View state
let metricsState: {
  dashboard: QualityDashboard | null;
  trends: QualityTrends | null;
  loading: boolean;
  error: string | null;
  selectedPeriod: number;
} = {
  dashboard: null,
  trends: null,
  loading: true,
  error: null,
  selectedPeriod: 30,
};

let currentContainer: HTMLElement | null = null;

/**
 * Render the Metrics view
 */
export async function renderMetricsView(container: HTMLElement): Promise<void> {
  currentContainer = container;
  metricsState.loading = true;

  renderMetrics(container);

  try {
    const [dashboard, trends] = await Promise.all([
      getDashboard(metricsState.selectedPeriod),
      getTrends(metricsState.selectedPeriod),
    ]);

    metricsState.dashboard = dashboard;
    metricsState.trends = trends;
    metricsState.loading = false;
    metricsState.error = null;
  } catch (error) {
    metricsState.loading = false;
    metricsState.error = error instanceof Error ? error.message : 'Failed to load metrics';
    // Don't show error toast - might not have quality data yet
    console.log('Quality metrics not available:', metricsState.error);
  }

  renderMetrics(container);
}

/**
 * Render metrics content
 */
function renderMetrics(container: HTMLElement): void {
  const { dashboard, trends, loading, error, selectedPeriod } = metricsState;

  container.innerHTML = `
    <div class="view view--metrics">
      <div class="metrics">
        <!-- Header -->
        <div class="metrics__header">
          <div class="metrics__header-left">
            <h1 class="metrics__title">QUALITY METRICS</h1>
            <p class="metrics__subtitle">Tool factory performance analysis</p>
          </div>
          <div class="metrics__header-right">
            <select class="form-select metrics__period-select" id="period-select">
              <option value="7" ${selectedPeriod === 7 ? 'selected' : ''}>Last 7 days</option>
              <option value="30" ${selectedPeriod === 30 ? 'selected' : ''}>Last 30 days</option>
              <option value="90" ${selectedPeriod === 90 ? 'selected' : ''}>Last 90 days</option>
            </select>
          </div>
        </div>

        ${loading ? renderLoading() : error ? renderError(error) : dashboard ? renderDashboardContent(dashboard, trends) : renderNoData()}
      </div>
    </div>
  `;

  // Attach listeners
  attachMetricsListeners(container);
}

/**
 * Render loading state
 */
function renderLoading(): string {
  return `
    <div class="metrics__loading">
      <div class="spinner spinner--large"></div>
      <p>Loading quality metrics...</p>
    </div>
  `;
}

/**
 * Render error state
 */
function renderError(error: string): string {
  return `
    <div class="metrics__error">
      <span class="metrics__error-icon">!</span>
      <p>${escapeHtml(error)}</p>
      <button class="btn btn--secondary metrics__retry-btn">RETRY</button>
    </div>
  `;
}

/**
 * Render no data state
 */
function renderNoData(): string {
  return `
    <div class="metrics__empty">
      <div class="metrics__empty-icon">📊</div>
      <h2>No Quality Data Available</h2>
      <p>Quality metrics will appear here once tools have been generated and evaluated.</p>
      <a href="#/create" class="btn btn--primary">CREATE YOUR FIRST TOOL</a>
    </div>
  `;
}

/**
 * Render dashboard content
 */
function renderDashboardContent(dashboard: QualityDashboard, _trends: QualityTrends | null): string {
  const trendDisplay = dashboard.scoreTrend === 'up' ? '+' : dashboard.scoreTrend === 'down' ? '-' : '';

  return `
    <!-- Key Metrics -->
    <div class="metrics__section">
      <h2 class="metrics__section-title">OVERVIEW</h2>
      ${renderMetricGrid([
        {
          label: 'AVERAGE SCORE',
          value: Math.round(dashboard.averageScore),
          subtitle: 'out of 100',
          trend: dashboard.scoreTrend,
          variant: dashboard.averageScore >= 80 ? 'success' : dashboard.averageScore >= 60 ? 'warning' : 'error',
        },
        {
          label: 'PASS RATE',
          value: `${Math.round(dashboard.passRate)}%`,
          subtitle: 'of tools pass QA',
          variant: dashboard.passRate >= 80 ? 'success' : dashboard.passRate >= 60 ? 'warning' : 'error',
        },
        {
          label: 'TOTAL TOOLS',
          value: dashboard.totalTools,
          subtitle: `in ${dashboard.period.days} days`,
          variant: 'default',
        },
        {
          label: 'TREND',
          value: trendDisplay + (dashboard.scoreTrend === 'stable' ? '—' : ''),
          subtitle: dashboard.scoreTrend === 'up' ? 'Improving' : dashboard.scoreTrend === 'down' ? 'Declining' : 'Stable',
          trend: dashboard.scoreTrend,
          variant: dashboard.scoreTrend === 'up' ? 'success' : dashboard.scoreTrend === 'down' ? 'error' : 'default',
        },
      ])}
    </div>

    <!-- Score Trend Chart -->
    ${dashboard.dailyScores.length > 0 ? `
      <div class="metrics__section">
        <h2 class="metrics__section-title">SCORE TREND</h2>
        <div class="metrics__chart" id="score-chart">
          ${renderTrendChart({
            data: dashboard.dailyScores.map((d) => ({
              date: d.date,
              value: d.averageScore,
            })),
            height: 200,
            showLabels: true,
            showGrid: true,
          })}
        </div>
      </div>
    ` : ''}

    <!-- Criterion Pass Rates -->
    ${Object.keys(dashboard.criterionPassRates).length > 0 ? `
      <div class="metrics__section">
        <h2 class="metrics__section-title">PASS RATES BY CRITERION</h2>
        <div class="criterion-grid">
          ${Object.entries(dashboard.criterionPassRates)
            .sort((a, b) => a[1] - b[1]) // Sort by pass rate (lowest first to highlight problem areas)
            .map(([criterion, rate]) => renderCriterionCard(criterion, rate))
            .join('')}
        </div>
      </div>
    ` : ''}

    <!-- Volume Chart -->
    ${dashboard.dailyScores.length > 0 ? `
      <div class="metrics__section">
        <h2 class="metrics__section-title">TOOLS GENERATED</h2>
        <div class="metrics__chart" id="volume-chart">
          ${renderBarChart({
            data: dashboard.dailyScores.slice(-14).map((d) => ({
              date: d.date,
              value: d.totalTools,
            })),
            height: 150,
          })}
        </div>
      </div>
    ` : ''}

    <!-- Insights -->
    <div class="metrics__section">
      <h2 class="metrics__section-title">INSIGHTS</h2>
      <div class="insights-list">
        ${generateInsights(dashboard)}
      </div>
    </div>
  `;
}

/**
 * Render criterion card
 */
function renderCriterionCard(criterion: string, rate: number): string {
  const displayName = formatCriterionName(criterion);
  const variant = rate >= 80 ? 'success' : rate >= 60 ? 'warning' : 'error';
  const icon = rate >= 80 ? '✓' : rate >= 60 ? '!' : '✗';

  return `
    <div class="criterion-card criterion-card--${variant}">
      <div class="criterion-card__header">
        <span class="criterion-card__icon">${icon}</span>
        <span class="criterion-card__name">${displayName}</span>
      </div>
      <div class="criterion-card__rate">
        <span class="criterion-card__value">${Math.round(rate)}%</span>
        <span class="criterion-card__label">pass rate</span>
      </div>
      <div class="criterion-card__bar">
        <div class="criterion-card__bar-fill" style="width: ${rate}%"></div>
      </div>
    </div>
  `;
}

/**
 * Format criterion name for display
 */
function formatCriterionName(criterion: string): string {
  const names: Record<string, string> = {
    decision: 'Decision Quality',
    zero_questions: 'Zero Questions',
    easy_steps: 'Easy Steps',
    feedback: 'Feedback',
    gamification: 'Gamification',
    results: 'Results Display',
    commitment: 'Commitment',
    brand: 'Brand Compliance',
  };
  return names[criterion] || criterion.replace(/_/g, ' ').toUpperCase();
}

/**
 * Generate insights based on data
 */
function generateInsights(dashboard: QualityDashboard): string {
  const insights: string[] = [];

  // Overall performance
  if (dashboard.averageScore >= 80) {
    insights.push(`<div class="insight insight--positive">
      <span class="insight__icon">✓</span>
      <span class="insight__text">Strong overall quality with ${Math.round(dashboard.averageScore)}/100 average score</span>
    </div>`);
  } else if (dashboard.averageScore < 60) {
    insights.push(`<div class="insight insight--negative">
      <span class="insight__icon">!</span>
      <span class="insight__text">Quality needs improvement - average score is ${Math.round(dashboard.averageScore)}/100</span>
    </div>`);
  }

  // Trend insight
  if (dashboard.scoreTrend === 'up') {
    insights.push(`<div class="insight insight--positive">
      <span class="insight__icon">↑</span>
      <span class="insight__text">Quality is trending upward - keep up the good work!</span>
    </div>`);
  } else if (dashboard.scoreTrend === 'down') {
    insights.push(`<div class="insight insight--negative">
      <span class="insight__icon">↓</span>
      <span class="insight__text">Quality is declining - review recent tool specifications</span>
    </div>`);
  }

  // Lowest performing criterion
  const criterionEntries = Object.entries(dashboard.criterionPassRates);
  if (criterionEntries.length > 0) {
    const [lowestCriterion, lowestRate] = criterionEntries.sort((a, b) => a[1] - b[1])[0];
    if (lowestRate < 70) {
      insights.push(`<div class="insight insight--warning">
        <span class="insight__icon">⚠</span>
        <span class="insight__text">"${formatCriterionName(lowestCriterion)}" has the lowest pass rate at ${Math.round(lowestRate)}%</span>
      </div>`);
    }
  }

  // Volume insight
  if (dashboard.totalTools === 0) {
    insights.push(`<div class="insight insight--info">
      <span class="insight__icon">ℹ</span>
      <span class="insight__text">No tools generated in this period</span>
    </div>`);
  } else {
    const avgPerDay = dashboard.totalTools / dashboard.period.days;
    insights.push(`<div class="insight insight--info">
      <span class="insight__icon">📊</span>
      <span class="insight__text">${dashboard.totalTools} tools generated (${avgPerDay.toFixed(1)} per day average)</span>
    </div>`);
  }

  return insights.length > 0 ? insights.join('') : `
    <div class="insight insight--info">
      <span class="insight__icon">ℹ</span>
      <span class="insight__text">Not enough data to generate insights yet</span>
    </div>
  `;
}

/**
 * Attach event listeners
 */
function attachMetricsListeners(container: HTMLElement): void {
  // Period selector
  const periodSelect = container.querySelector<HTMLSelectElement>('#period-select');
  periodSelect?.addEventListener('change', () => {
    metricsState.selectedPeriod = parseInt(periodSelect.value, 10);
    if (currentContainer) {
      renderMetricsView(currentContainer);
    }
  });

  // Retry button
  const retryBtn = container.querySelector<HTMLButtonElement>('.metrics__retry-btn');
  retryBtn?.addEventListener('click', () => {
    if (currentContainer) {
      renderMetricsView(currentContainer);
    }
  });
}

/**
 * Escape HTML
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
