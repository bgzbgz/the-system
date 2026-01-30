import { store, setJobs, showError } from '../store/actions.ts';
import { listAuditEvents } from '../api/audit.ts';
import { listJobs } from '../api/jobs.ts';
import { renderTimeline } from '../components/timeline.ts';
import type { AuditEvent, Job } from '../types/index.ts';

// Local state for audit view
let events: AuditEvent[] = [];
let eventsLoading = true;
let selectedJobId: string | null = null;
let unsubscribers: Array<() => void> = [];

// Render the audit view
export function renderAuditView(container: HTMLElement, jobIdFromRoute?: string): void {
  // Clean up previous state
  cleanupAuditView();
  selectedJobId = jobIdFromRoute || null;

  container.innerHTML = `
    <div class="view">
      <div class="view__header">
        <h1 class="view__title">AUDIT TRAIL</h1>
        <p class="view__subtitle">View the history of all tool events</p>
      </div>

      <div class="audit">
        <div class="audit__filters">
          <select id="job-filter" class="form-select" style="width: auto; min-width: 200px;">
            <option value="">All Jobs</option>
          </select>
        </div>

        <div id="timeline-container">
          <div class="view--loading">
            <div class="spinner spinner--large"></div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Subscribe to job list for filter dropdown
  unsubscribers.push(
    store.subscribe((state, prevState) => {
      if (state.jobs !== prevState.jobs) {
        updateJobFilter(container, state.jobs);
      }
    })
  );

  // Load data
  loadData(container);
}

// Load jobs (for filter) and events
async function loadData(container: HTMLElement): Promise<void> {
  eventsLoading = true;
  renderTimelineContent(container);

  try {
    // Load jobs for filter dropdown (in parallel with events)
    const jobsPromise = listJobs().then((jobs) => {
      setJobs(jobs);
      updateJobFilter(container, jobs);
    });

    // Load events
    const eventsPromise = listAuditEvents(selectedJobId || undefined);

    const [_, loadedEvents] = await Promise.all([jobsPromise, eventsPromise]);

    events = loadedEvents;
    eventsLoading = false;
    renderTimelineContent(container);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load audit events';
    showError(message);
    eventsLoading = false;
    events = [];
    renderTimelineContent(container);
  }

  // Attach filter listener after data is loaded
  attachFilterListener(container);
}

// Update job filter dropdown
function updateJobFilter(container: HTMLElement, jobs: Job[]): void {
  const filterSelect = container.querySelector<HTMLSelectElement>('#job-filter');
  if (!filterSelect) return;

  // Preserve current selection
  const currentValue = filterSelect.value;

  // Build options
  const options = [
    '<option value="">All Jobs</option>',
    ...jobs.map(
      (job) =>
        `<option value="${job._id}" ${selectedJobId === job._id ? 'selected' : ''}>
          ${escapeHtml(job.toolName || job.fileName)}
        </option>`
    ),
  ];

  filterSelect.innerHTML = options.join('');

  // Restore selection if it still exists
  if (currentValue && jobs.some((j) => j._id === currentValue)) {
    filterSelect.value = currentValue;
  }
}

// Attach filter change listener
function attachFilterListener(container: HTMLElement): void {
  const filterSelect = container.querySelector<HTMLSelectElement>('#job-filter');
  if (!filterSelect) return;

  filterSelect.addEventListener('change', async () => {
    const newJobId = filterSelect.value || null;

    // Update URL if navigating to specific job
    if (newJobId) {
      window.location.hash = `/audit/${newJobId}`;
    } else {
      window.location.hash = '/audit';
    }

    selectedJobId = newJobId;

    // Reload events with new filter
    eventsLoading = true;
    renderTimelineContent(container);

    try {
      events = await listAuditEvents(selectedJobId || undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load audit events';
      showError(message);
      events = [];
    }

    eventsLoading = false;
    renderTimelineContent(container);
  });
}

// Render timeline content
function renderTimelineContent(container: HTMLElement): void {
  const timelineContainer = container.querySelector<HTMLElement>('#timeline-container');
  if (!timelineContainer) return;

  if (eventsLoading) {
    timelineContainer.innerHTML = `
      <div class="view--loading">
        <div class="spinner spinner--large"></div>
      </div>
    `;
    return;
  }

  renderTimeline(timelineContainer, events);
}

// Cleanup function
export function cleanupAuditView(): void {
  unsubscribers.forEach((unsub) => unsub());
  unsubscribers = [];
  events = [];
  eventsLoading = true;
  selectedJobId = null;
}

// Escape HTML to prevent XSS
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
