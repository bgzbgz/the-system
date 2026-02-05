// Job Detail View - Pipeline Visualization & Actions
// Feature: Boss Office Redesign

import { setCurrentJob, setCurrentJobLoading, showSuccess, showError, updateJobInList } from '../store/actions.ts';
import { getJob, approveJob, requestRevision, rejectJob, cancelJob } from '../api/jobs.ts';
import { getLogs } from '../api/logs.ts';
import { navigate } from '../utils/router.ts';
import { renderPipelineVisualizer, mapJobStatusToPipeline, calculateProgress } from '../components/pipeline-visualizer.ts';
import type { Job, JobStatus } from '../types/index.ts';
import type { FactoryLog } from '../types/logs.ts';

// Polling state
let pollInterval: number | null = null;
const POLL_INTERVAL_ACTIVE = 3000; // 3 seconds when processing
const POLL_INTERVAL_IDLE = 30000; // 30 seconds otherwise

// Current container reference
let currentContainer: HTMLElement | null = null;
let currentJobId: string | null = null;

/**
 * Render the Job Detail view
 */
export async function renderJobDetailView(container: HTMLElement, jobId: string): Promise<void> {
  currentContainer = container;
  currentJobId = jobId;

  // Start loading
  setCurrentJobLoading(true);
  renderJobDetailSkeleton(container);

  try {
    const job = await getJob(jobId);
    setCurrentJob(job);
    renderJobDetail(container, job);
    startPolling(jobId, job.status);
  } catch (error) {
    setCurrentJobLoading(false);
    renderJobDetailError(container, error instanceof Error ? error.message : 'Failed to load job');
  }
}

/**
 * Render loading skeleton
 */
function renderJobDetailSkeleton(container: HTMLElement): void {
  container.innerHTML = `
    <div class="view view--job-detail">
      <div class="job-detail">
        <div class="job-detail__header">
          <a href="#/inbox" class="job-detail__back">← BACK TO INBOX</a>
        </div>
        <div class="job-detail__loading">
          <div class="spinner spinner--large"></div>
          <p>Loading job details...</p>
        </div>
      </div>
    </div>
  `;
}

/**
 * Render error state
 */
function renderJobDetailError(container: HTMLElement, error: string): void {
  container.innerHTML = `
    <div class="view view--job-detail">
      <div class="job-detail">
        <div class="job-detail__header">
          <a href="#/inbox" class="job-detail__back">← BACK TO INBOX</a>
        </div>
        <div class="job-detail__error">
          <span class="job-detail__error-icon">!</span>
          <h2>Error Loading Job</h2>
          <p>${escapeHtml(error)}</p>
          <button class="btn btn--secondary job-detail__retry-btn">RETRY</button>
        </div>
      </div>
    </div>
  `;

  container.querySelector('.job-detail__retry-btn')?.addEventListener('click', () => {
    if (currentJobId) renderJobDetailView(container, currentJobId);
  });
}

/**
 * Render job detail content
 */
function renderJobDetail(container: HTMLElement, job: Job): void {
  const pipelineStages = mapJobStatusToPipeline(job.status);
  const progress = calculateProgress(pipelineStages);
  const showActions = ['READY_FOR_REVIEW', 'QA_FAILED', 'ESCALATED'].includes(job.status);
  const isProcessing = ['PROCESSING', 'QA_IN_PROGRESS', 'DEPLOYING'].includes(job.status);

  container.innerHTML = `
    <div class="view view--job-detail">
      <div class="job-detail">
        <!-- Header -->
        <div class="job-detail__header">
          <a href="#/inbox" class="job-detail__back">← BACK TO INBOX</a>
          <div class="job-detail__header-right">
            <a href="#/job/${job._id}/logs" class="btn btn--secondary btn--small">VIEW AI LOGS</a>
          </div>
        </div>

        <!-- Title Section -->
        <div class="job-detail__title-section">
          <h1 class="job-detail__title">${escapeHtml(job.toolName || job.fileName)}</h1>
          <div class="job-detail__meta">
            <span class="badge badge--${getStatusClass(job.status)}">${formatStatus(job.status)}</span>
            <span class="job-detail__time">Updated ${formatTimeAgo(job.updatedAt)}</span>
          </div>
        </div>

        <!-- Pipeline Visualization -->
        <div class="job-detail__section">
          <div class="job-detail__section-header">
            <h2 class="job-detail__section-title">PIPELINE PROGRESS</h2>
            <span class="job-detail__progress-label">${progress}% COMPLETE</span>
          </div>
          <div id="pipeline-container"></div>
        </div>

        ${job.workflowError ? `
          <div class="job-detail__error-banner">
            <span class="job-detail__error-banner-icon">!</span>
            <div class="job-detail__error-banner-content">
              <strong>Error:</strong> ${escapeHtml(job.workflowError)}
            </div>
          </div>
        ` : ''}

        <!-- QA Report (if available) -->
        ${job.qaReport ? renderQASection(job.qaReport) : ''}

        <!-- Agent Reasoning Summary (shown for completed jobs) -->
        ${['READY_FOR_REVIEW', 'QA_FAILED', 'DEPLOYED', 'REJECTED'].includes(job.status) ? `
          <div class="job-detail__section job-detail__section--reasoning">
            <div class="job-detail__section-header">
              <h2 class="job-detail__section-title">WHY THIS DESIGN?</h2>
              <a href="#/job/${job._id}/logs" class="btn btn--text btn--small">VIEW FULL LOGS →</a>
            </div>
            <div id="reasoning-summary" class="reasoning-summary">
              <div class="reasoning-summary__loading">
                <span class="spinner spinner--small"></span>
                Loading agent reasoning...
              </div>
            </div>
          </div>
        ` : ''}

        <!-- Tool Preview (if HTML available) -->
        ${job.generatedHtml ? renderPreviewSection(job) : ''}

        <!-- Questionnaire Summary -->
        <div class="job-detail__section">
          <div class="job-detail__section-header">
            <h2 class="job-detail__section-title">SPECIFICATION</h2>
          </div>
          <div class="job-detail__spec">
            <div class="spec-item">
              <span class="spec-item__label">CATEGORY</span>
              <span class="spec-item__value">${formatCategory(job.category)}</span>
            </div>
            <div class="spec-item">
              <span class="spec-item__label">DECISION</span>
              <p class="spec-item__text">${escapeHtml(job.questionnaire?.decision || '—')}</p>
            </div>
            <div class="spec-item">
              <span class="spec-item__label">TEACHING POINT</span>
              <p class="spec-item__text">${escapeHtml(job.questionnaire?.teachingPoint || '—')}</p>
            </div>
            <div class="spec-item">
              <span class="spec-item__label">INPUTS</span>
              <p class="spec-item__text">${escapeHtml(job.questionnaire?.inputs || '—')}</p>
            </div>
            <div class="spec-item">
              <span class="spec-item__label">VERDICT CRITERIA</span>
              <p class="spec-item__text">${escapeHtml(job.questionnaire?.verdictCriteria || '—')}</p>
            </div>
          </div>
        </div>

        <!-- Revision Notes (if any) -->
        ${job.revisionNotes.length > 0 ? `
          <div class="job-detail__section">
            <div class="job-detail__section-header">
              <h2 class="job-detail__section-title">REVISION HISTORY</h2>
            </div>
            <div class="revision-history">
              ${job.revisionNotes.map((note, i) => `
                <div class="revision-note">
                  <span class="revision-note__number">#${i + 1}</span>
                  <p class="revision-note__text">${escapeHtml(note)}</p>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <!-- Action Buttons -->
        ${showActions ? `
          <div class="job-detail__actions">
            <button class="btn btn--primary job-detail__approve-btn">
              ✓ APPROVE & DEPLOY
            </button>
            <button class="btn btn--secondary job-detail__revise-btn">
              REQUEST REVISION
            </button>
            <button class="btn btn--danger job-detail__reject-btn">
              REJECT
            </button>
          </div>
        ` : ''}

        ${isProcessing ? `
          <div class="job-detail__processing-notice">
            <div class="spinner"></div>
            <span>Processing... This page will update automatically.</span>
            <button class="btn btn--danger btn--small job-detail__cancel-btn" style="margin-left: 16px;">
              CANCEL
            </button>
          </div>

          <!-- Live Logs Section (shown during processing) -->
          <div class="job-detail__section job-detail__section--live-logs">
            <div class="job-detail__section-header">
              <h2 class="job-detail__section-title">LIVE FACTORY OUTPUT</h2>
              <span id="log-count-badge" class="badge badge--processing">0 stages</span>
            </div>
            <div id="live-logs-container" class="live-logs">
              <p class="live-logs__waiting">Waiting for factory to start...</p>
            </div>
          </div>
        ` : ''}

        ${job.status === 'DEPLOYED' && job.deployedUrl ? `
          <div class="job-detail__deployed-banner">
            <span class="job-detail__deployed-icon">✓</span>
            <div class="job-detail__deployed-content">
              <strong>Tool Deployed!</strong>
              <a href="${job.deployedUrl}" target="_blank" rel="noopener noreferrer">${job.deployedUrl}</a>
            </div>
          </div>
        ` : ''}
      </div>
    </div>

    <!-- Revision Modal -->
    <div class="modal" id="revision-modal" style="display: none;">
      <div class="modal__backdrop"></div>
      <div class="modal__content">
        <div class="modal__header">
          <h3 class="modal__title">REQUEST REVISION</h3>
          <button class="modal__close" type="button">×</button>
        </div>
        <div class="modal__body">
          <div class="form-group">
            <label class="form-label">REVISION NOTES</label>
            <textarea id="revision-notes" class="form-textarea" rows="5" placeholder="Describe what needs to be changed..."></textarea>
          </div>
        </div>
        <div class="modal__footer">
          <button class="btn btn--secondary modal__cancel-btn">CANCEL</button>
          <button class="btn btn--primary modal__submit-btn">SUBMIT REVISION</button>
        </div>
      </div>
    </div>
  `;

  // Render pipeline
  const pipelineContainer = container.querySelector<HTMLElement>('#pipeline-container');
  if (pipelineContainer) {
    renderPipelineVisualizer(pipelineContainer, {
      stages: pipelineStages,
      onStageClick: (stageId) => {
        // Could navigate to logs filtered by stage
        navigate(`/job/${job._id}/logs?stage=${stageId}`);
      },
    });
  }

  // Load reasoning summary for completed jobs
  const reasoningSummaryContainer = container.querySelector<HTMLElement>('#reasoning-summary');
  if (reasoningSummaryContainer && ['READY_FOR_REVIEW', 'QA_FAILED', 'DEPLOYED', 'REJECTED'].includes(job.status)) {
    loadReasoningSummary(job._id, reasoningSummaryContainer);
  }

  // Attach event listeners
  attachJobDetailListeners(container, job);
}

/**
 * Render QA section
 */
function renderQASection(qaReport: Job['qaReport']): string {
  if (!qaReport) return '';

  return `
    <div class="job-detail__section job-detail__section--qa">
      <div class="job-detail__section-header">
        <h2 class="job-detail__section-title">QA REPORT</h2>
        <span class="badge badge--${qaReport.passed ? 'success' : 'error'}">
          ${qaReport.passed ? 'PASSED' : 'FAILED'}
        </span>
      </div>
      <div class="qa-criteria">
        ${qaReport.criteria.map((criterion) => `
          <div class="qa-criterion ${criterion.passed ? 'qa-criterion--passed' : 'qa-criterion--failed'}">
            <span class="qa-criterion__icon">${criterion.passed ? '✓' : '✗'}</span>
            <div class="qa-criterion__content">
              <span class="qa-criterion__name">${escapeHtml(criterion.name)}</span>
              ${criterion.feedback ? `<p class="qa-criterion__feedback">${escapeHtml(criterion.feedback)}</p>` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

/**
 * Render preview section
 */
function renderPreviewSection(job: Job): string {
  return `
    <div class="job-detail__section">
      <div class="job-detail__section-header">
        <h2 class="job-detail__section-title">TOOL PREVIEW</h2>
        <button class="btn btn--secondary btn--small job-detail__preview-toggle">
          EXPAND
        </button>
      </div>
      <div class="tool-preview tool-preview--collapsed" id="tool-preview">
        <iframe
          srcDoc="${escapeHtmlAttribute(job.generatedHtml || '')}"
          sandbox="allow-scripts"
          class="tool-preview__iframe"
        ></iframe>
      </div>
    </div>
  `;
}

/**
 * Load and render agent reasoning summary
 */
async function loadReasoningSummary(jobId: string, container: HTMLElement): Promise<void> {
  try {
    const response = await getLogs(jobId);
    const logs = response.logs || [];

    if (logs.length === 0) {
      container.innerHTML = `
        <p class="reasoning-summary__empty">No agent logs available for this job.</p>
      `;
      return;
    }

    // Group logs by stage and extract key insights
    const stageInsights = generateStageInsights(logs);

    container.innerHTML = `
      <div class="reasoning-cards">
        ${stageInsights.map(insight => `
          <div class="reasoning-card reasoning-card--${insight.status}">
            <div class="reasoning-card__header">
              <span class="reasoning-card__stage">${insight.stageName}</span>
              <span class="reasoning-card__status">${insight.status === 'success' ? '✓' : insight.status === 'error' ? '✗' : '•'}</span>
            </div>
            <p class="reasoning-card__summary">${escapeHtml(insight.summary)}</p>
            ${insight.keyDecisions.length > 0 ? `
              <ul class="reasoning-card__decisions">
                ${insight.keyDecisions.map(decision => `
                  <li>${escapeHtml(decision)}</li>
                `).join('')}
              </ul>
            ` : ''}
          </div>
        `).join('')}
      </div>
    `;
  } catch (error) {
    console.error('Failed to load reasoning summary:', error);
    container.innerHTML = `
      <p class="reasoning-summary__error">Failed to load agent reasoning.</p>
    `;
  }
}

/**
 * Generate insights from logs for each stage
 */
function generateStageInsights(logs: FactoryLog[]): Array<{
  stageName: string;
  status: 'success' | 'error' | 'info';
  summary: string;
  keyDecisions: string[];
}> {
  // Stage display names and order
  const stageConfig: Record<string, { name: string; order: number }> = {
    'secretary': { name: 'Secretary', order: 1 },
    'content-summarizer': { name: 'Content Summarizer', order: 2 },
    'course-analyst': { name: 'Course Analyst', order: 3 },
    'knowledge-architect': { name: 'Knowledge Architect', order: 4 },
    'tool-build': { name: 'Tool Builder', order: 5 },
    'template-select': { name: 'Template Selection', order: 6 },
    'qa-eval': { name: 'QA Evaluation', order: 7 },
    'brand-guardian': { name: 'Brand Guardian', order: 8 },
    'feedback-apply': { name: 'Feedback Applied', order: 9 },
  };

  // Group logs by stage
  const byStage = new Map<string, FactoryLog[]>();
  for (const log of logs) {
    const existing = byStage.get(log.stage) || [];
    existing.push(log);
    byStage.set(log.stage, existing);
  }

  // Generate insights for each stage
  const insights: Array<{
    stageName: string;
    status: 'success' | 'error' | 'info';
    summary: string;
    keyDecisions: string[];
    order: number;
  }> = [];

  for (const [stage, stageLogs] of byStage) {
    const config = stageConfig[stage] || { name: stage, order: 99 };
    const latestLog = stageLogs[stageLogs.length - 1];

    // Use the summary if available, otherwise generate one
    let summary = latestLog.summary || '';
    if (!summary) {
      // Generate a summary based on the response length and tokens
      const responseLen = latestLog.response?.length || 0;
      const outputTokens = latestLog.output_tokens || 0;
      summary = `Processed with ${outputTokens.toLocaleString()} tokens, generated ${responseLen.toLocaleString()} characters.`;
    }

    // Extract key decisions from the response (simplified)
    const keyDecisions = extractKeyDecisions(latestLog.response || '', stage);

    insights.push({
      stageName: config.name,
      status: 'success',
      summary,
      keyDecisions,
      order: config.order,
    });
  }

  // Sort by stage order
  insights.sort((a, b) => a.order - b.order);

  return insights;
}

/**
 * Extract key decisions from an agent's response
 */
function extractKeyDecisions(response: string, stage: string): string[] {
  const decisions: string[] = [];

  // Stage-specific extractions
  if (stage === 'template-select' || stage === 'templateDecider') {
    const templateMatch = response.match(/template[:\s]+["']?(\w+)/i);
    if (templateMatch) {
      decisions.push(`Selected template: ${templateMatch[1]}`);
    }
  }

  if (stage === 'qa-eval' || stage === 'qaDepartment') {
    const passMatch = response.match(/passed|failed/i);
    if (passMatch) {
      decisions.push(`QA Result: ${passMatch[0].toUpperCase()}`);
    }
  }

  if (stage === 'knowledge-architect' || stage === 'knowledgeArchitect') {
    const inputsMatch = response.match(/inputs?[:\s]+(\d+)/i);
    if (inputsMatch) {
      decisions.push(`Designed ${inputsMatch[1]} input fields`);
    }
  }

  if (stage === 'tool-build' || stage === 'toolBuilder') {
    // Check for HTML generation
    if (response.includes('<!DOCTYPE') || response.includes('<html')) {
      decisions.push('Generated complete HTML tool');
    }
  }

  // Limit to 3 decisions
  return decisions.slice(0, 3);
}

/**
 * Attach event listeners
 */
function attachJobDetailListeners(container: HTMLElement, job: Job): void {
  // Approve button
  const approveBtn = container.querySelector<HTMLButtonElement>('.job-detail__approve-btn');
  approveBtn?.addEventListener('click', async () => {
    if (!confirm('Approve and deploy this tool?')) return;

    approveBtn.disabled = true;
    approveBtn.innerHTML = '<span class="spinner spinner--small"></span> DEPLOYING...';

    try {
      const result = await approveJob(job._id);
      updateJobInList(result.job);
      showSuccess('Tool deployed successfully!');
      if (currentContainer && currentJobId) {
        renderJobDetailView(currentContainer, currentJobId);
      }
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to deploy');
      approveBtn.disabled = false;
      approveBtn.textContent = '✓ APPROVE & DEPLOY';
    }
  });

  // Revise button
  const reviseBtn = container.querySelector<HTMLButtonElement>('.job-detail__revise-btn');
  const revisionModal = container.querySelector<HTMLElement>('#revision-modal');
  const modalBackdrop = revisionModal?.querySelector('.modal__backdrop');
  const modalClose = revisionModal?.querySelector('.modal__close');
  const modalCancel = revisionModal?.querySelector('.modal__cancel-btn');
  const modalSubmit = revisionModal?.querySelector<HTMLButtonElement>('.modal__submit-btn');
  const revisionNotes = container.querySelector<HTMLTextAreaElement>('#revision-notes');

  const openModal = () => {
    if (revisionModal) revisionModal.style.display = 'flex';
  };

  const closeModalFn = () => {
    if (revisionModal) revisionModal.style.display = 'none';
    if (revisionNotes) revisionNotes.value = '';
  };

  reviseBtn?.addEventListener('click', openModal);
  modalBackdrop?.addEventListener('click', closeModalFn);
  modalClose?.addEventListener('click', closeModalFn);
  modalCancel?.addEventListener('click', closeModalFn);

  modalSubmit?.addEventListener('click', async () => {
    const notes = revisionNotes?.value.trim();
    if (!notes) {
      showError('Please enter revision notes');
      return;
    }

    modalSubmit.disabled = true;
    modalSubmit.innerHTML = '<span class="spinner spinner--small"></span> SUBMITTING...';

    try {
      const updatedJob = await requestRevision(job._id, notes);
      updateJobInList(updatedJob);
      showSuccess('Revision requested');
      closeModalFn();
      if (currentContainer && currentJobId) {
        renderJobDetailView(currentContainer, currentJobId);
      }
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to request revision');
      modalSubmit.disabled = false;
      modalSubmit.textContent = 'SUBMIT REVISION';
    }
  });

  // Reject button
  const rejectBtn = container.querySelector<HTMLButtonElement>('.job-detail__reject-btn');
  rejectBtn?.addEventListener('click', async () => {
    const reason = prompt('Enter rejection reason:');
    if (!reason) return;

    rejectBtn.disabled = true;
    rejectBtn.textContent = 'REJECTING...';

    try {
      await rejectJob(job._id, reason);
      showSuccess('Job rejected');
      navigate('/inbox');
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to reject');
      rejectBtn.disabled = false;
      rejectBtn.textContent = 'REJECT';
    }
  });

  // Preview toggle
  const previewToggle = container.querySelector<HTMLButtonElement>('.job-detail__preview-toggle');
  const previewContainer = container.querySelector<HTMLElement>('#tool-preview');
  previewToggle?.addEventListener('click', () => {
    if (previewContainer) {
      const isCollapsed = previewContainer.classList.contains('tool-preview--collapsed');
      previewContainer.classList.toggle('tool-preview--collapsed');
      previewToggle.textContent = isCollapsed ? 'COLLAPSE' : 'EXPAND';
    }
  });

  // Cancel button (for stuck deployments/processing)
  const cancelBtn = container.querySelector<HTMLButtonElement>('.job-detail__cancel-btn');
  cancelBtn?.addEventListener('click', async () => {
    if (!confirm('Cancel this job? It will be moved back to review.')) return;

    cancelBtn.disabled = true;
    cancelBtn.textContent = 'CANCELLING...';

    try {
      await cancelJob(job._id);
      showSuccess('Job cancelled');
      if (currentContainer && currentJobId) {
        renderJobDetailView(currentContainer, currentJobId);
      }
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to cancel');
      cancelBtn.disabled = false;
      cancelBtn.textContent = 'CANCEL';
    }
  });
}

/**
 * Start polling for job updates
 */
function startPolling(jobId: string, currentStatus: JobStatus): void {
  stopPolling();

  const shouldPollFast = ['PROCESSING', 'QA_IN_PROGRESS', 'DEPLOYING'].includes(currentStatus);
  const interval = shouldPollFast ? POLL_INTERVAL_ACTIVE : POLL_INTERVAL_IDLE;

  // Immediately poll logs if processing
  if (shouldPollFast) {
    pollLogs(jobId);
  }

  pollInterval = window.setInterval(async () => {
    try {
      const job = await getJob(jobId);
      setCurrentJob(job);

      // Poll logs during processing
      if (['PROCESSING', 'QA_IN_PROGRESS', 'DEPLOYING'].includes(job.status)) {
        await pollLogs(jobId);
      }

      // If status changed, re-render
      if (job.status !== currentStatus && currentContainer) {
        renderJobDetail(currentContainer, job);
        // Adjust polling interval if status changed
        startPolling(jobId, job.status);
      }
    } catch (error) {
      console.error('Polling error:', error);
    }
  }, interval);
}

/**
 * Poll and display live logs
 */
async function pollLogs(jobId: string): Promise<void> {
  try {
    const { logs, count } = await getLogs(jobId);

    // Update log count badge
    const badge = document.getElementById('log-count-badge');
    if (badge) {
      badge.textContent = `${count} stages`;
    }

    // Update live logs container
    const container = document.getElementById('live-logs-container');
    if (!container) return;

    if (logs.length === 0) {
      container.innerHTML = '<p class="live-logs__waiting">Waiting for factory to start...</p>';
      return;
    }

    // Group logs by stage and show latest from each
    const stageNames: Record<string, string> = {
      'secretary': 'Secretary',
      'audience-profile': 'Audience Profiler',
      'example-gen': 'Example Generator',
      'copy-write': 'Copy Writer',
      'template-select': 'Template Decider',
      'tool-build': 'Tool Builder',
      'brand-audit': 'Brand Guardian',
      'qa-eval': 'QA Department',
      'feedback-apply': 'Feedback Applier'
    };

    // Update pipeline visualizer based on completed stages
    updatePipelineFromLogs(logs);

    // Render logs summary
    const logsHtml = logs.map(log => `
      <div class="live-log-entry">
        <div class="live-log-entry__header">
          <span class="live-log-entry__stage">${stageNames[log.stage] || log.stage}</span>
          <span class="live-log-entry__meta">
            ${log.model} • ${log.input_tokens?.toLocaleString() || 0}→${log.output_tokens?.toLocaleString() || 0} tokens
            ${log.duration_ms ? `• ${(log.duration_ms / 1000).toFixed(1)}s` : ''}
          </span>
        </div>
        <p class="live-log-entry__summary">${escapeHtml(log.summary || 'Completed')}</p>
      </div>
    `).join('');

    container.innerHTML = logsHtml;

  } catch (error) {
    console.error('Log polling error:', error);
  }
}

/**
 * Update pipeline visualizer based on completed logs
 */
function updatePipelineFromLogs(logs: FactoryLog[]): void {
  const stageMap: Record<string, string> = {
    'secretary': 'sec',
    'audience-profile': 'aud',
    'example-gen': 'exm',
    'copy-write': 'cpy',
    'template-select': 'tpl',
    'tool-build': 'bld',
    'brand-audit': 'brd',
    'qa-eval': 'qa'
  };

  const completedStageIds = logs.map(log => stageMap[log.stage]).filter(Boolean);

  // Update stage indicators
  completedStageIds.forEach(stageId => {
    const stageEl = document.querySelector(`[data-stage-id="${stageId}"]`);
    if (stageEl) {
      stageEl.classList.remove('pipeline-stage--pending', 'pipeline-stage--active');
      stageEl.classList.add('pipeline-stage--completed');
    }
  });

  // Find the next incomplete stage and mark it active
  const allStages = ['sec', 'aud', 'exm', 'cpy', 'bld', 'brd', 'qa', 'rev'];
  for (const stageId of allStages) {
    if (!completedStageIds.includes(stageId)) {
      const stageEl = document.querySelector(`[data-stage-id="${stageId}"]`);
      if (stageEl && !stageEl.classList.contains('pipeline-stage--failed')) {
        stageEl.classList.remove('pipeline-stage--pending');
        stageEl.classList.add('pipeline-stage--active');
      }
      break;
    }
  }
}

/**
 * Stop polling
 */
export function stopPolling(): void {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}

// Helper functions
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

function formatStatus(status: JobStatus): string {
  return status.replace(/_/g, ' ');
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

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function escapeHtmlAttribute(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
