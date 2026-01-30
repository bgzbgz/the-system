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
import { renderJobCard, attachJobCardListeners } from '../components/job-card.ts';
import type { JobStatus } from '../types/index.ts';

// Polling configuration
const POLL_INTERVAL_IDLE = 10000; // 10 seconds when no active jobs
const POLL_INTERVAL_ACTIVE = 3000; // 3 seconds when jobs are processing
const MAX_BACKOFF = 30000; // 30 seconds max
let pollTimeout: ReturnType<typeof setTimeout> | null = null;
let currentBackoff = 1000;
let unsubscribers: Array<() => void> = [];

// Filter options
const STATUS_FILTERS: Array<{ value: string; label: string }> = [
  { value: '', label: 'All Status' },
  { value: 'READY_FOR_REVIEW', label: 'Ready for Review' },
  { value: 'PROCESSING', label: 'Processing' },
  { value: 'QA_IN_PROGRESS', label: 'QA In Progress' },
  { value: 'REVISION_REQUESTED', label: 'Revision Requested' },
  { value: 'DEPLOYED', label: 'Deployed' },
  { value: 'REJECTED', label: 'Rejected' },
];

// Current filter state
let currentFilter: JobStatus | '' = '';

// Render the inbox view
export function renderInboxView(container: HTMLElement): void {
  // Clean up previous state
  cleanupInboxView();

  container.innerHTML = `
    <div class="view">
      <div class="view__header">
        <h1 class="view__title">INBOX</h1>
        <p class="view__subtitle">Review and manage submitted tools</p>
      </div>

      <div class="inbox">
        <div class="inbox__filters">
          <select id="status-filter" class="form-select" style="width: auto;">
            ${STATUS_FILTERS.map(
              (opt) => `
              <option value="${opt.value}" ${currentFilter === opt.value ? 'selected' : ''}>
                ${opt.label}
              </option>
            `
            ).join('')}
          </select>

          <div class="inbox__refresh">
            <span id="last-updated" class="inbox__last-updated"></span>
            <button id="refresh-btn" class="btn btn--secondary btn--small">
              REFRESH
            </button>
          </div>
        </div>

        <div id="job-list" class="inbox__list">
          <div class="view--loading">
            <div class="spinner spinner--large"></div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Attach event listeners
  attachInboxListeners(container);

  // Subscribe to state changes
  unsubscribers.push(
    store.subscribe((state, prevState) => {
      if (
        state.jobs !== prevState.jobs ||
        state.jobsLoading !== prevState.jobsLoading ||
        state.jobsError !== prevState.jobsError
      ) {
        renderJobList(container);
      }
      if (state.lastPollTime !== prevState.lastPollTime) {
        updateLastUpdated(container);
      }
    })
  );

  // Initial load
  loadJobs();

  // Start polling
  startPolling();

  // Handle page visibility
  setupVisibilityHandler();
}

// Render the job list
function renderJobList(container: HTMLElement): void {
  const { jobs, jobsLoading, jobsError } = store.getState();
  const listContainer = container.querySelector<HTMLElement>('#job-list');

  if (!listContainer) return;

  if (jobsLoading && jobs.length === 0) {
    listContainer.innerHTML = `
      <div class="view--loading">
        <div class="spinner spinner--large"></div>
      </div>
    `;
    return;
  }

  if (jobsError) {
    listContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">&#9888;</div>
        <h2 class="empty-state__title">FAILED TO LOAD</h2>
        <p class="empty-state__message">${escapeHtml(jobsError)}</p>
        <button class="btn btn--primary" onclick="location.reload()">TRY AGAIN</button>
      </div>
    `;
    return;
  }

  // Filter jobs
  const filteredJobs = currentFilter
    ? jobs.filter((job) => job.status === currentFilter)
    : jobs;

  if (filteredJobs.length === 0) {
    listContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">&#128193;</div>
        <h2 class="empty-state__title">NO TOOLS FOUND</h2>
        <p class="empty-state__message">
          ${currentFilter ? 'No tools match this filter.' : 'Submit your first tool to get started.'}
        </p>
        ${!currentFilter ? '<a href="#/submit" class="btn btn--primary">SUBMIT NEW TOOL</a>' : ''}
      </div>
    `;
    return;
  }

  // Sort by updatedAt descending
  const sortedJobs = [...filteredJobs].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  listContainer.innerHTML = sortedJobs.map((job) => renderJobCard(job)).join('');

  // Attach click handlers
  attachJobCardListeners(listContainer);
}

// Attach event listeners for inbox controls
function attachInboxListeners(container: HTMLElement): void {
  // Status filter
  const filterSelect = container.querySelector<HTMLSelectElement>('#status-filter');
  if (filterSelect) {
    filterSelect.addEventListener('change', () => {
      currentFilter = filterSelect.value as JobStatus | '';
      renderJobList(container);
    });
  }

  // Refresh button
  const refreshBtn = container.querySelector<HTMLButtonElement>('#refresh-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      loadJobs();
    });
  }
}

// Load jobs from API
async function loadJobs(): Promise<void> {
  setJobsLoading(true);

  try {
    const jobs = await listJobs();
    setJobs(jobs);
    updateLastPollTime();

    // Reset backoff on success
    currentBackoff = 1000;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load jobs';
    setJobsError(message);
    showError(message);

    // Increase backoff on error (exponential with max)
    currentBackoff = Math.min(currentBackoff * 2, MAX_BACKOFF);
  }
}

// Update last updated display
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

  // Use faster polling when jobs are actively processing
  const { jobs, jobsError } = store.getState();
  const hasActiveJobs = jobs.some(job =>
    ['SENT', 'PROCESSING', 'QA_IN_PROGRESS', 'REVISION_REQUESTED'].includes(job.status)
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

// Page visibility handler
function setupVisibilityHandler(): void {
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      // Resume polling and refresh immediately
      if (!store.getState().pollingActive) {
        startPolling();
        loadJobs();
      }
    } else {
      // Pause polling when hidden
      stopPolling();
    }
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);

  // Store cleanup function
  unsubscribers.push(() => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  });
}

// Cleanup function
export function cleanupInboxView(): void {
  stopPolling();
  unsubscribers.forEach((unsub) => unsub());
  unsubscribers = [];
  currentFilter = '';
}

// Escape HTML to prevent XSS
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
