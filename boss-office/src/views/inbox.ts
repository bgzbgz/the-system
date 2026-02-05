// Inbox View - Enhanced Job Queue
// Feature: Boss Office Redesign

import {
  store,
  setJobs,
  setJobsLoading,
  setJobsError,
  setPollingActive,
  updateLastPollTime,
  showError,
} from '../store/actions.ts';
import { listJobs } from '../api/jobs.ts';
import { navigate } from '../utils/router.ts';
import type { Job, JobStatus } from '../types/index.ts';

// Polling configuration
const POLL_INTERVAL_IDLE = 10000;
const POLL_INTERVAL_ACTIVE = 3000;
const MAX_BACKOFF = 30000;
let pollTimeout: ReturnType<typeof setTimeout> | null = null;
let currentBackoff = 1000;
let unsubscribers: Array<() => void> = [];

// Filter groups
const FILTER_GROUPS = {
  all: { label: 'All Jobs', statuses: null },
  active: { label: 'Active', statuses: ['PROCESSING', 'QA_IN_PROGRESS', 'DEPLOYING'] as JobStatus[] },
  review: { label: 'Needs Review', statuses: ['READY_FOR_REVIEW', 'QA_FAILED', 'REVISION_REQUESTED', 'ESCALATED'] as JobStatus[] },
  deployed: { label: 'Deployed', statuses: ['DEPLOYED'] as JobStatus[] },
  failed: { label: 'Failed', statuses: ['REJECTED', 'DEPLOY_FAILED', 'FACTORY_FAILED'] as JobStatus[] },
};

type FilterKey = keyof typeof FILTER_GROUPS;

// Current filter state
let currentFilter: FilterKey = 'all';

/**
 * Render the inbox view
 */
export function renderInboxView(container: HTMLElement): void {
  cleanupInboxView();

  // Check for filter in URL
  const urlParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
  const filterParam = urlParams.get('filter') as FilterKey | null;
  if (filterParam && filterParam in FILTER_GROUPS) {
    currentFilter = filterParam;
  }

  container.innerHTML = `
    <div class="view view--inbox">
      <div class="inbox">
        <!-- Header -->
        <div class="inbox__header">
          <div class="inbox__header-left">
            <h1 class="inbox__title">JOB QUEUE</h1>
            <p class="inbox__subtitle">Review and manage submitted tools</p>
          </div>
          <div class="inbox__header-right">
            <a href="#/create" class="btn btn--primary">+ CREATE TOOL</a>
          </div>
        </div>

        <!-- Filter Tabs -->
        <div class="inbox__filters">
          <div class="inbox__filter-tabs">
            ${Object.entries(FILTER_GROUPS).map(([key, group]) => `
              <button
                class="inbox__filter-tab ${currentFilter === key ? 'inbox__filter-tab--active' : ''}"
                data-filter="${key}"
              >
                ${group.label}
                <span class="inbox__filter-count" data-filter-count="${key}">0</span>
              </button>
            `).join('')}
          </div>

          <div class="inbox__actions">
            <span id="last-updated" class="inbox__last-updated"></span>
            <button id="refresh-btn" class="btn btn--secondary btn--small" title="Refresh">
              ↻ REFRESH
            </button>
          </div>
        </div>

        <!-- Job List -->
        <div id="job-list" class="inbox__list">
          <div class="inbox__loading">
            <div class="spinner spinner--large"></div>
            <p>Loading jobs...</p>
          </div>
        </div>
      </div>
    </div>
  `;

  attachInboxListeners(container);

  unsubscribers.push(
    store.subscribe((state, prevState) => {
      if (
        state.jobs !== prevState.jobs ||
        state.jobsLoading !== prevState.jobsLoading ||
        state.jobsError !== prevState.jobsError
      ) {
        renderJobList(container);
        updateFilterCounts(container, state.jobs);
      }
      if (state.lastPollTime !== prevState.lastPollTime) {
        updateLastUpdated(container);
      }
    })
  );

  loadJobs();
  startPolling();
  setupVisibilityHandler();
}

/**
 * Render the job list
 */
function renderJobList(container: HTMLElement): void {
  const { jobs, jobsLoading, jobsError } = store.getState();
  const listContainer = container.querySelector<HTMLElement>('#job-list');

  if (!listContainer) return;

  if (jobsLoading && jobs.length === 0) {
    listContainer.innerHTML = `
      <div class="inbox__loading">
        <div class="spinner spinner--large"></div>
        <p>Loading jobs...</p>
      </div>
    `;
    return;
  }

  if (jobsError) {
    listContainer.innerHTML = `
      <div class="inbox__error">
        <span class="inbox__error-icon">!</span>
        <h2>Failed to Load Jobs</h2>
        <p>${escapeHtml(jobsError)}</p>
        <button class="btn btn--secondary inbox__retry-btn">RETRY</button>
      </div>
    `;

    listContainer.querySelector('.inbox__retry-btn')?.addEventListener('click', loadJobs);
    return;
  }

  // Filter jobs
  const filterGroup = FILTER_GROUPS[currentFilter];
  const filteredJobs = filterGroup.statuses
    ? jobs.filter((job) => filterGroup.statuses!.includes(job.status))
    : jobs;

  if (filteredJobs.length === 0) {
    listContainer.innerHTML = `
      <div class="inbox__empty">
        <div class="inbox__empty-icon">${getEmptyIcon(currentFilter)}</div>
        <h2>${getEmptyTitle(currentFilter)}</h2>
        <p>${getEmptyMessage(currentFilter)}</p>
        ${currentFilter === 'all' ? '<a href="#/create" class="btn btn--primary">CREATE YOUR FIRST TOOL</a>' : ''}
      </div>
    `;
    return;
  }

  // Sort by updatedAt descending
  const sortedJobs = [...filteredJobs].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  listContainer.innerHTML = `
    <div class="inbox__job-grid">
      ${sortedJobs.map(renderEnhancedJobCard).join('')}
    </div>
  `;

  // Attach job card click handlers
  const jobCards = listContainer.querySelectorAll<HTMLElement>('.job-card');
  jobCards.forEach((card) => {
    card.addEventListener('click', (e) => {
      // Don't navigate if clicking on a link inside
      if ((e.target as HTMLElement).closest('a')) return;
      const jobId = card.dataset.jobId;
      if (jobId) navigate(`/job/${jobId}`);
    });
  });
}

/**
 * Render enhanced job card
 */
function renderEnhancedJobCard(job: Job): string {
  const statusInfo = getStatusInfo(job.status);
  const timeAgo = formatTimeAgo(job.updatedAt);
  const showProgress = ['PROCESSING', 'QA_IN_PROGRESS', 'DEPLOYING'].includes(job.status);

  return `
    <div class="job-card job-card--${statusInfo.variant}" data-job-id="${job._id}">
      <div class="job-card__header">
        <span class="badge badge--${statusInfo.variant}">${statusInfo.label}</span>
        <span class="job-card__time">${timeAgo}</span>
      </div>

      <div class="job-card__body">
        <h3 class="job-card__title">${escapeHtml(job.toolName || job.fileName)}</h3>
        <span class="job-card__category">${formatCategory(job.category)}</span>
      </div>

      ${showProgress ? `
        <div class="job-card__progress">
          <div class="job-card__progress-bar">
            <div class="job-card__progress-fill job-card__progress-fill--animated"></div>
          </div>
          <span class="job-card__progress-text">${statusInfo.progressText}</span>
        </div>
      ` : ''}

      ${job.workflowError ? `
        <div class="job-card__error">
          <span class="job-card__error-icon">!</span>
          <span class="job-card__error-text">${truncateText(job.workflowError, 50)}</span>
        </div>
      ` : ''}

      ${job.status === 'DEPLOYED' && job.deployedUrl ? `
        <div class="job-card__deployed">
          <a href="${job.deployedUrl}" target="_blank" rel="noopener noreferrer" class="job-card__deployed-link">
            VIEW LIVE →
          </a>
        </div>
      ` : ''}

      ${job.status === 'READY_FOR_REVIEW' || job.status === 'QA_FAILED' ? `
        <div class="job-card__actions">
          <span class="job-card__action-hint">Click to review</span>
        </div>
      ` : ''}

      <div class="job-card__footer">
        <span class="job-card__arrow">→</span>
      </div>
    </div>
  `;
}

/**
 * Get status display info
 */
function getStatusInfo(status: JobStatus): { label: string; variant: string; progressText: string } {
  const info: Record<string, { label: string; variant: string; progressText: string }> = {
    DRAFT: { label: 'DRAFT', variant: 'default', progressText: '' },
    SENT: { label: 'SENT', variant: 'processing', progressText: 'Starting...' },
    PROCESSING: { label: 'PROCESSING', variant: 'processing', progressText: 'Building tool...' },
    QA_IN_PROGRESS: { label: 'QA CHECK', variant: 'processing', progressText: 'Running QA...' },
    QA_FAILED: { label: 'QA FAILED', variant: 'error', progressText: '' },
    READY_FOR_REVIEW: { label: 'REVIEW', variant: 'ready', progressText: '' },
    REVISION_REQUESTED: { label: 'REVISION', variant: 'warning', progressText: '' },
    DEPLOYING: { label: 'DEPLOYING', variant: 'processing', progressText: 'Deploying...' },
    DEPLOYED: { label: 'LIVE', variant: 'success', progressText: '' },
    DEPLOY_FAILED: { label: 'DEPLOY FAILED', variant: 'error', progressText: '' },
    REJECTED: { label: 'REJECTED', variant: 'error', progressText: '' },
    ESCALATED: { label: 'ESCALATED', variant: 'warning', progressText: '' },
    FACTORY_FAILED: { label: 'FAILED', variant: 'error', progressText: '' },
    FAILED_SEND: { label: 'FAILED', variant: 'error', progressText: '' },
    DEPLOY_REQUESTED: { label: 'QUEUED', variant: 'processing', progressText: 'Waiting...' },
  };
  return info[status] || { label: status, variant: 'default', progressText: '' };
}

/**
 * Update filter counts
 */
function updateFilterCounts(container: HTMLElement, jobs: Job[]): void {
  Object.entries(FILTER_GROUPS).forEach(([key, group]) => {
    const countEl = container.querySelector<HTMLElement>(`[data-filter-count="${key}"]`);
    if (countEl) {
      const count = group.statuses
        ? jobs.filter((j) => group.statuses!.includes(j.status)).length
        : jobs.length;
      countEl.textContent = count.toString();
    }
  });
}

/**
 * Get empty state icon
 */
function getEmptyIcon(filter: FilterKey): string {
  const icons: Record<FilterKey, string> = {
    all: '📭',
    active: '⚡',
    review: '📋',
    deployed: '🚀',
    failed: '❌',
  };
  return icons[filter] || '📭';
}

/**
 * Get empty state title
 */
function getEmptyTitle(filter: FilterKey): string {
  const titles: Record<FilterKey, string> = {
    all: 'NO JOBS YET',
    active: 'NO ACTIVE JOBS',
    review: 'NOTHING TO REVIEW',
    deployed: 'NO DEPLOYED TOOLS',
    failed: 'NO FAILED JOBS',
  };
  return titles[filter] || 'NO JOBS FOUND';
}

/**
 * Get empty state message
 */
function getEmptyMessage(filter: FilterKey): string {
  const messages: Record<FilterKey, string> = {
    all: 'Create your first tool to get started.',
    active: 'No jobs are currently being processed.',
    review: 'All tools have been reviewed.',
    deployed: 'Deploy your first tool to see it here.',
    failed: 'No failed jobs - great!',
  };
  return messages[filter] || 'No jobs match this filter.';
}

/**
 * Attach inbox event listeners
 */
function attachInboxListeners(container: HTMLElement): void {
  // Filter tabs
  const filterTabs = container.querySelectorAll<HTMLButtonElement>('.inbox__filter-tab');
  filterTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const filter = tab.dataset.filter as FilterKey;
      if (filter && filter in FILTER_GROUPS) {
        currentFilter = filter;
        filterTabs.forEach((t) => t.classList.remove('inbox__filter-tab--active'));
        tab.classList.add('inbox__filter-tab--active');
        renderJobList(container);
      }
    });
  });

  // Refresh button
  const refreshBtn = container.querySelector<HTMLButtonElement>('#refresh-btn');
  refreshBtn?.addEventListener('click', () => {
    loadJobs();
  });
}

/**
 * Load jobs from API
 */
async function loadJobs(): Promise<void> {
  setJobsLoading(true);

  try {
    const jobs = await listJobs();
    setJobs(jobs);
    updateLastPollTime();
    currentBackoff = 1000;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load jobs';
    setJobsError(message);
    showError(message);
    currentBackoff = Math.min(currentBackoff * 2, MAX_BACKOFF);
  }
}

/**
 * Update last updated display
 */
function updateLastUpdated(container: HTMLElement): void {
  const { lastPollTime } = store.getState();
  const element = container.querySelector<HTMLElement>('#last-updated');

  if (element && lastPollTime) {
    const date = new Date(lastPollTime);
    element.textContent = `Updated ${date.toLocaleTimeString()}`;
  }
}

// Polling functions
function startPolling(): void {
  setPollingActive(true);
  schedulePoll();
}

function stopPolling(): void {
  setPollingActive(false);
  if (pollTimeout) {
    clearTimeout(pollTimeout);
    pollTimeout = null;
  }
}

function schedulePoll(): void {
  if (!store.getState().pollingActive) return;

  const { jobs, jobsError } = store.getState();
  const hasActiveJobs = jobs.some((job) =>
    ['SENT', 'PROCESSING', 'QA_IN_PROGRESS', 'REVISION_REQUESTED', 'DEPLOYING'].includes(job.status)
  );
  const pollInterval = jobsError
    ? currentBackoff
    : hasActiveJobs
      ? POLL_INTERVAL_ACTIVE
      : POLL_INTERVAL_IDLE;

  pollTimeout = setTimeout(async () => {
    if (document.visibilityState === 'visible') {
      await loadJobs();
    }
    schedulePoll();
  }, pollInterval);
}

function setupVisibilityHandler(): void {
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      if (!store.getState().pollingActive) {
        startPolling();
        loadJobs();
      }
    } else {
      stopPolling();
    }
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);
  unsubscribers.push(() => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  });
}

export function cleanupInboxView(): void {
  stopPolling();
  unsubscribers.forEach((unsub) => unsub());
  unsubscribers = [];
}

// Utility functions
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

function formatCategory(category: string): string {
  const labels: Record<string, string> = {
    B2B_PRODUCT: 'B2B Product',
    B2B_SERVICE: 'B2B Service',
    B2C_PRODUCT: 'B2C Product',
    B2C_SERVICE: 'B2C Service',
  };
  return labels[category] || category;
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
