// Dashboard View - Factory Health, Active Jobs, Metrics
// Feature: Boss Office Redesign

import { setJobs, showError } from '../store/actions.ts';
import { listJobs } from '../api/jobs.ts';
import { getDashboard } from '../api/quality.ts';
import { navigate } from '../utils/router.ts';
import type { Job, JobStatus, QualityDashboard } from '../types/index.ts';

// Status groups for dashboard cards
const STATUS_GROUPS = {
  active: ['PROCESSING', 'QA_IN_PROGRESS', 'DEPLOYING'] as JobStatus[],
  review: ['READY_FOR_REVIEW', 'QA_FAILED', 'REVISION_REQUESTED'] as JobStatus[],
  deployed: ['DEPLOYED'] as JobStatus[],
};

// Dashboard state
let dashboardData: {
  jobs: Job[];
  quality: QualityDashboard | null;
  loading: boolean;
  error: string | null;
} = {
  jobs: [],
  quality: null,
  loading: true,
  error: null,
};

/**
 * Render the Dashboard view
 */
export async function renderDashboardView(container: HTMLElement): Promise<void> {
  // Initial render with loading state
  dashboardData.loading = true;
  renderDashboard(container);

  // Fetch data
  try {
    const [jobs, quality] = await Promise.all([
      listJobs(),
      getDashboard(30).catch(() => null), // Quality endpoint may not exist yet
    ]);

    dashboardData = {
      jobs,
      quality,
      loading: false,
      error: null,
    };

    // Update global store with jobs
    setJobs(jobs);
  } catch (error) {
    dashboardData.loading = false;
    dashboardData.error = error instanceof Error ? error.message : 'Failed to load dashboard';
    showError(dashboardData.error);
  }

  renderDashboard(container);
}

/**
 * Render dashboard content
 */
function renderDashboard(container: HTMLElement): void {
  const activeCounts = getStatusCounts(dashboardData.jobs);
  const recentJobs = getRecentJobs(dashboardData.jobs, 5);

  container.innerHTML = `
    <div class="view view--dashboard">
      <div class="dashboard">
        <!-- Header -->
        <div class="dashboard__header">
          <h1 class="dashboard__title">TOOL FACTORY</h1>
          <div class="dashboard__actions">
            <button class="btn btn--primary dashboard__create-btn">
              + CREATE TOOL
            </button>
          </div>
        </div>

        ${dashboardData.loading ? renderLoading() : dashboardData.error ? renderError(dashboardData.error) : `
          <!-- Status Cards -->
          <div class="dashboard__status-cards">
            <div class="status-card status-card--active" data-status="active">
              <div class="status-card__icon">
                <div class="status-card__spinner"></div>
              </div>
              <div class="status-card__content">
                <span class="status-card__count">${activeCounts.active}</span>
                <span class="status-card__label">ACTIVE</span>
              </div>
            </div>

            <div class="status-card status-card--review" data-status="review">
              <div class="status-card__icon">
                <span class="status-card__badge">!</span>
              </div>
              <div class="status-card__content">
                <span class="status-card__count">${activeCounts.review}</span>
                <span class="status-card__label">NEEDS REVIEW</span>
              </div>
            </div>

            <div class="status-card status-card--deployed" data-status="deployed">
              <div class="status-card__icon">✓</div>
              <div class="status-card__content">
                <span class="status-card__count">${activeCounts.deployed}</span>
                <span class="status-card__label">DEPLOYED</span>
              </div>
            </div>
          </div>

          <!-- Quality Metrics (if available) -->
          ${dashboardData.quality ? renderQualitySection(dashboardData.quality) : ''}

          <!-- Recent Jobs -->
          <div class="dashboard__section">
            <div class="dashboard__section-header">
              <h2 class="dashboard__section-title">RECENT ACTIVITY</h2>
              <a href="#/inbox" class="dashboard__section-link">VIEW ALL →</a>
            </div>

            ${recentJobs.length > 0 ? `
              <div class="dashboard__job-list">
                ${recentJobs.map(renderDashboardJobCard).join('')}
              </div>
            ` : `
              <div class="dashboard__empty">
                <p>No jobs yet. Create your first tool to get started.</p>
              </div>
            `}
          </div>

          <!-- Quick Actions -->
          <div class="dashboard__section">
            <h2 class="dashboard__section-title">QUICK ACTIONS</h2>
            <div class="dashboard__quick-actions">
              <button class="quick-action" data-action="create">
                <span class="quick-action__icon">📝</span>
                <span class="quick-action__label">CREATE TOOL</span>
              </button>
              <button class="quick-action" data-action="inbox">
                <span class="quick-action__icon">📥</span>
                <span class="quick-action__label">VIEW INBOX</span>
              </button>
              <button class="quick-action" data-action="metrics">
                <span class="quick-action__icon">📊</span>
                <span class="quick-action__label">QUALITY METRICS</span>
              </button>
            </div>
          </div>
        `}
      </div>
    </div>
  `;

  // Attach listeners
  attachDashboardListeners(container);
}

/**
 * Render loading state
 */
function renderLoading(): string {
  return `
    <div class="dashboard__loading">
      <div class="spinner spinner--large"></div>
      <p>Loading dashboard...</p>
    </div>
  `;
}

/**
 * Render error state
 */
function renderError(error: string): string {
  return `
    <div class="dashboard__error">
      <span class="dashboard__error-icon">!</span>
      <p>${escapeHtml(error)}</p>
      <button class="btn btn--secondary dashboard__retry-btn">RETRY</button>
    </div>
  `;
}

/**
 * Render quality metrics section
 */
function renderQualitySection(quality: QualityDashboard): string {
  const trendIcon = quality.scoreTrend === 'up' ? '↑' : quality.scoreTrend === 'down' ? '↓' : '→';
  const trendClass = quality.scoreTrend === 'up' ? 'trend--up' : quality.scoreTrend === 'down' ? 'trend--down' : 'trend--stable';

  return `
    <div class="dashboard__section dashboard__section--quality">
      <div class="dashboard__section-header">
        <h2 class="dashboard__section-title">QUALITY TRENDS (${quality.period.days} DAYS)</h2>
        <a href="#/metrics" class="dashboard__section-link">DETAILS →</a>
      </div>

      <div class="quality-summary">
        <div class="quality-metric">
          <span class="quality-metric__value">${Math.round(quality.averageScore)}</span>
          <span class="quality-metric__label">AVG SCORE</span>
        </div>
        <div class="quality-metric">
          <span class="quality-metric__value">${Math.round(quality.passRate)}%</span>
          <span class="quality-metric__label">PASS RATE</span>
        </div>
        <div class="quality-metric">
          <span class="quality-metric__value quality-metric__trend ${trendClass}">${trendIcon}</span>
          <span class="quality-metric__label">TREND</span>
        </div>
        <div class="quality-metric">
          <span class="quality-metric__value">${quality.totalTools}</span>
          <span class="quality-metric__label">TOTAL TOOLS</span>
        </div>
      </div>

      <!-- Simple trend visualization -->
      ${quality.dailyScores.length > 0 ? renderMiniChart(quality.dailyScores) : ''}
    </div>
  `;
}

/**
 * Render mini trend chart
 */
function renderMiniChart(dailyScores: { date: string; averageScore: number }[]): string {
  // Take last 14 days for mini chart
  const data = dailyScores.slice(-14);
  if (data.length < 2) return '';

  const maxScore = Math.max(...data.map((d) => d.averageScore), 100);
  const minScore = Math.min(...data.map((d) => d.averageScore), 0);
  const range = maxScore - minScore || 1;

  const width = 100;
  const height = 40;

  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((d.averageScore - minScore) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  return `
    <div class="mini-chart">
      <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
        <polyline
          points="${points}"
          fill="none"
          stroke="var(--color-yellow)"
          stroke-width="2"
        />
      </svg>
    </div>
  `;
}

/**
 * Render dashboard job card (compact)
 */
function renderDashboardJobCard(job: Job): string {
  const statusClass = getStatusClass(job.status);
  const timeAgo = formatTimeAgo(job.updatedAt);

  return `
    <div class="dashboard-job-card" data-job-id="${job._id}">
      <div class="dashboard-job-card__status">
        <span class="badge badge--${statusClass}">${formatStatus(job.status)}</span>
      </div>
      <div class="dashboard-job-card__info">
        <span class="dashboard-job-card__name">${escapeHtml(job.toolName || job.fileName)}</span>
        <span class="dashboard-job-card__time">${timeAgo}</span>
      </div>
      <div class="dashboard-job-card__action">
        <span class="dashboard-job-card__arrow">→</span>
      </div>
    </div>
  `;
}

/**
 * Get status counts by group
 */
function getStatusCounts(jobs: Job[]): { active: number; review: number; deployed: number } {
  return {
    active: jobs.filter((j) => STATUS_GROUPS.active.includes(j.status)).length,
    review: jobs.filter((j) => STATUS_GROUPS.review.includes(j.status)).length,
    deployed: jobs.filter((j) => STATUS_GROUPS.deployed.includes(j.status)).length,
  };
}

/**
 * Get recent jobs sorted by updated time
 */
function getRecentJobs(jobs: Job[], limit: number): Job[] {
  return [...jobs]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, limit);
}

/**
 * Get status CSS class
 */
function getStatusClass(status: JobStatus): string {
  const classes: Record<string, string> = {
    PROCESSING: 'processing',
    QA_IN_PROGRESS: 'processing',
    DEPLOYING: 'processing',
    READY_FOR_REVIEW: 'ready',
    QA_FAILED: 'error',
    REVISION_REQUESTED: 'warning',
    DEPLOYED: 'success',
    REJECTED: 'error',
    DEPLOY_FAILED: 'error',
  };
  return classes[status] || 'default';
}

/**
 * Format status for display
 */
function formatStatus(status: JobStatus): string {
  const labels: Record<string, string> = {
    PROCESSING: 'PROCESSING',
    QA_IN_PROGRESS: 'QA',
    DEPLOYING: 'DEPLOYING',
    READY_FOR_REVIEW: 'REVIEW',
    QA_FAILED: 'QA FAILED',
    REVISION_REQUESTED: 'REVISION',
    DEPLOYED: 'LIVE',
    REJECTED: 'REJECTED',
    DEPLOY_FAILED: 'FAILED',
  };
  return labels[status] || status;
}

/**
 * Format time ago
 */
function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

/**
 * Attach dashboard event listeners
 */
function attachDashboardListeners(container: HTMLElement): void {
  // Create button
  const createBtn = container.querySelector<HTMLButtonElement>('.dashboard__create-btn');
  createBtn?.addEventListener('click', () => navigate('/create'));

  // Status cards (click to filter inbox)
  const statusCards = container.querySelectorAll<HTMLElement>('.status-card');
  statusCards.forEach((card) => {
    card.addEventListener('click', () => {
      const status = card.dataset.status;
      if (status === 'review') {
        navigate('/inbox?filter=review');
      } else if (status === 'active') {
        navigate('/inbox?filter=active');
      } else {
        navigate('/inbox');
      }
    });
  });

  // Job cards
  const jobCards = container.querySelectorAll<HTMLElement>('.dashboard-job-card');
  jobCards.forEach((card) => {
    card.addEventListener('click', () => {
      const jobId = card.dataset.jobId;
      if (jobId) navigate(`/job/${jobId}`);
    });
  });

  // Quick actions
  const quickActions = container.querySelectorAll<HTMLElement>('.quick-action');
  quickActions.forEach((action) => {
    action.addEventListener('click', () => {
      const actionType = action.dataset.action;
      switch (actionType) {
        case 'create':
          navigate('/create');
          break;
        case 'inbox':
          navigate('/inbox');
          break;
        case 'metrics':
          navigate('/metrics');
          break;
      }
    });
  });

  // Retry button
  const retryBtn = container.querySelector<HTMLButtonElement>('.dashboard__retry-btn');
  retryBtn?.addEventListener('click', () => {
    renderDashboardView(container);
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
