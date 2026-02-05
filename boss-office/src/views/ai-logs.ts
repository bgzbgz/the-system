// AI Reasoning Logs View - Full AI call history
// Feature: Boss Office Redesign

import { showError } from '../store/actions.ts';
import { getLogs } from '../api/logs.ts';
import { getJob } from '../api/jobs.ts';
import { renderLogCard, getStageOrder } from '../components/log-card.ts';
import type { FactoryLog, AgentStage, LogsSummary } from '../types/logs.ts';
import { calculateSummary, STAGE_CONFIG } from '../types/logs.ts';
import type { Job } from '../types/index.ts';

// View state
let logsState: {
  jobId: string | null;
  job: Job | null;
  logs: FactoryLog[];
  summary: LogsSummary | null;
  loading: boolean;
  error: string | null;
  expandedIds: Set<string>;
  showingFullIds: Set<string>;
  filterStage: AgentStage | null;
} = {
  jobId: null,
  job: null,
  logs: [],
  summary: null,
  loading: true,
  error: null,
  expandedIds: new Set(),
  showingFullIds: new Set(),
  filterStage: null,
};

let currentContainer: HTMLElement | null = null;

/**
 * Render the AI Logs view
 */
export async function renderAILogsView(container: HTMLElement, jobId: string): Promise<void> {
  currentContainer = container;
  logsState.jobId = jobId;
  logsState.loading = true;

  // Check for stage filter in URL
  const urlParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
  const stageFilter = urlParams.get('stage') as AgentStage | null;
  logsState.filterStage = stageFilter;

  renderLogsView(container);

  try {
    const [job, logsResponse] = await Promise.all([
      getJob(jobId),
      getLogs(jobId, stageFilter || undefined),
    ]);

    logsState.job = job;
    logsState.logs = logsResponse.logs;
    logsState.summary = calculateSummary(logsResponse.logs);
    logsState.loading = false;
    logsState.error = null;
  } catch (error) {
    logsState.loading = false;
    logsState.error = error instanceof Error ? error.message : 'Failed to load logs';
    showError(logsState.error);
  }

  renderLogsView(container);
}

/**
 * Render the logs view
 */
function renderLogsView(container: HTMLElement): void {
  const { job, logs, summary, loading, error, filterStage } = logsState;

  // Sort logs by stage order
  const sortedLogs = [...logs].sort((a, b) => getStageOrder(a.stage) - getStageOrder(b.stage));

  // Get unique stages for filter
  const uniqueStages = [...new Set(logs.map((l) => l.stage))];

  container.innerHTML = `
    <div class="view view--ai-logs">
      <div class="ai-logs">
        <!-- Header -->
        <div class="ai-logs__header">
          <a href="#/job/${logsState.jobId}" class="ai-logs__back">← BACK TO JOB</a>
        </div>

        <div class="ai-logs__title-section">
          <h1 class="ai-logs__title">AI REASONING LOGS</h1>
          <p class="ai-logs__subtitle">${job ? escapeHtml(job.toolName || job.fileName) : 'Loading...'}</p>
        </div>

        ${loading ? renderLoading() : error ? renderError(error) : `
          <!-- Summary Stats -->
          ${summary ? `
            <div class="ai-logs__summary">
              <div class="logs-stat">
                <span class="logs-stat__value">${summary.stageCount}</span>
                <span class="logs-stat__label">STAGES</span>
              </div>
              <div class="logs-stat">
                <span class="logs-stat__value">${summary.durationDisplay}</span>
                <span class="logs-stat__label">TOTAL TIME</span>
              </div>
              <div class="logs-stat">
                <span class="logs-stat__value">${summary.tokensDisplay}</span>
                <span class="logs-stat__label">TOTAL TOKENS</span>
              </div>
            </div>
          ` : ''}

          <!-- Filter -->
          ${uniqueStages.length > 1 ? `
            <div class="ai-logs__filter">
              <label class="ai-logs__filter-label">FILTER BY STAGE:</label>
              <select class="form-select ai-logs__filter-select" id="stage-filter">
                <option value="">All Stages</option>
                ${uniqueStages.map((stage) => `
                  <option value="${stage}" ${filterStage === stage ? 'selected' : ''}>
                    ${STAGE_CONFIG[stage]?.displayName || stage}
                  </option>
                `).join('')}
              </select>
            </div>
          ` : ''}

          <!-- Expand/Collapse All -->
          <div class="ai-logs__actions">
            <button class="btn btn--secondary btn--small" id="expand-all-btn">EXPAND ALL</button>
            <button class="btn btn--secondary btn--small" id="collapse-all-btn">COLLAPSE ALL</button>
          </div>

          <!-- Log Cards -->
          <div class="ai-logs__list" id="logs-list">
            ${sortedLogs.length > 0 ? sortedLogs.map((log) => renderLogCard({
              log,
              isExpanded: logsState.expandedIds.has(log._id),
              isShowingFull: logsState.showingFullIds.has(log._id),
              onToggle: () => toggleLog(log._id),
              onShowFull: () => showFullLog(log._id),
            })).join('') : `
              <div class="ai-logs__empty">
                <p>No logs found for this job.</p>
              </div>
            `}
          </div>
        `}
      </div>
    </div>
  `;

  // Attach listeners
  attachLogsListeners(container);
}

/**
 * Render loading state
 */
function renderLoading(): string {
  return `
    <div class="ai-logs__loading">
      <div class="spinner spinner--large"></div>
      <p>Loading AI reasoning logs...</p>
    </div>
  `;
}

/**
 * Render error state
 */
function renderError(error: string): string {
  return `
    <div class="ai-logs__error">
      <span class="ai-logs__error-icon">!</span>
      <p>${escapeHtml(error)}</p>
      <button class="btn btn--secondary ai-logs__retry-btn">RETRY</button>
    </div>
  `;
}

/**
 * Toggle log expansion
 */
function toggleLog(logId: string): void {
  if (logsState.expandedIds.has(logId)) {
    logsState.expandedIds.delete(logId);
  } else {
    logsState.expandedIds.add(logId);
  }
  if (currentContainer) renderLogsView(currentContainer);
}

/**
 * Show full log content
 */
function showFullLog(logId: string): void {
  logsState.showingFullIds.add(logId);
  if (currentContainer) renderLogsView(currentContainer);
}

/**
 * Expand all logs
 */
function expandAll(): void {
  logsState.logs.forEach((log) => logsState.expandedIds.add(log._id));
  if (currentContainer) renderLogsView(currentContainer);
}

/**
 * Collapse all logs
 */
function collapseAll(): void {
  logsState.expandedIds.clear();
  if (currentContainer) renderLogsView(currentContainer);
}

/**
 * Attach event listeners
 */
function attachLogsListeners(container: HTMLElement): void {
  // Retry button
  const retryBtn = container.querySelector<HTMLButtonElement>('.ai-logs__retry-btn');
  retryBtn?.addEventListener('click', () => {
    if (logsState.jobId && currentContainer) {
      renderAILogsView(currentContainer, logsState.jobId);
    }
  });

  // Stage filter
  const stageFilter = container.querySelector<HTMLSelectElement>('#stage-filter');
  stageFilter?.addEventListener('change', () => {
    const stage = stageFilter.value as AgentStage | '';
    logsState.filterStage = stage || null;
    if (logsState.jobId && currentContainer) {
      renderAILogsView(currentContainer, logsState.jobId);
    }
  });

  // Expand/Collapse all
  const expandAllBtn = container.querySelector<HTMLButtonElement>('#expand-all-btn');
  expandAllBtn?.addEventListener('click', expandAll);

  const collapseAllBtn = container.querySelector<HTMLButtonElement>('#collapse-all-btn');
  collapseAllBtn?.addEventListener('click', collapseAll);

  // Log card event delegation
  const logsList = container.querySelector<HTMLElement>('#logs-list');
  logsList?.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const card = target.closest<HTMLElement>('.log-card');
    if (!card) return;

    const logId = card.dataset.logId;
    if (!logId) return;

    if (target.closest('[data-action="toggle"]')) {
      toggleLog(logId);
    } else if (target.closest('[data-action="show-full"]')) {
      showFullLog(logId);
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
