import {
  store,
  setCurrentJob,
  setCurrentJobLoading,
  updateJobInList,
  showError,
  showSuccess,
  setModal,
} from '../store/actions.ts';
import { getJob, approveJob, rejectJob, cancelJob, retryJob } from '../api/jobs.ts';
import { renderToolPreview } from '../components/tool-preview.ts';
import { renderQAReport } from '../components/qa-report.ts';
import { renderActionButtons, setActionButtonsLoading } from '../components/action-buttons.ts';
import { showConfirmDialog } from '../components/confirm-dialog.ts';
import { showSuccessModal } from '../components/success-modal.ts';
import { showRevisionModal } from '../components/revision-modal.ts';
import { showDeployProgress, hideDeployProgress } from '../components/deploy-progress.ts';
import { navigate } from '../utils/router.ts';

// Polling for status changes
const POLL_INTERVAL = 10000;
let pollTimeout: ReturnType<typeof setTimeout> | null = null;
let unsubscribers: Array<() => void> = [];
let currentJobId: string | null = null;

// Render the preview view
export function renderPreviewView(container: HTMLElement, jobId: string): void {
  // Clean up previous state
  cleanupPreviewView();
  currentJobId = jobId;

  container.innerHTML = `
    <div class="view">
      <div class="view__header">
        <h1 class="view__title">PREVIEW TOOL</h1>
        <p class="view__subtitle">
          <a href="#/inbox" style="color: var(--color-grey);">&larr; Back to Inbox</a>
          <span style="margin: 0 var(--space-sm); color: var(--color-grey);">|</span>
          <a href="#/logs/${jobId}" style="color: var(--color-grey);">View Logs &rarr;</a>
        </p>
      </div>

      <div class="preview">
        <div id="preview-container"></div>
        <div class="preview__sidebar">
          <div id="qa-report-container"></div>
          <div id="action-buttons-container"></div>
        </div>
      </div>
    </div>
  `;

  // Subscribe to state changes
  unsubscribers.push(
    store.subscribe((state, prevState) => {
      if (state.currentJob !== prevState.currentJob) {
        renderPreviewContent(container);
      }
    })
  );

  // Load job
  loadJob(jobId);

  // Start polling for status changes
  startPolling(jobId);
}

// Render preview content
function renderPreviewContent(container: HTMLElement): void {
  const { currentJob, currentJobLoading } = store.getState();

  const previewContainer = container.querySelector<HTMLElement>('#preview-container');
  const qaContainer = container.querySelector<HTMLElement>('#qa-report-container');
  const actionsContainer = container.querySelector<HTMLElement>('#action-buttons-container');

  if (!previewContainer || !qaContainer || !actionsContainer) return;

  if (currentJobLoading && !currentJob) {
    previewContainer.innerHTML = `
      <div class="preview__iframe-container">
        <div class="view--loading" style="height: 100%;">
          <div class="spinner spinner--large"></div>
        </div>
      </div>
    `;
    qaContainer.innerHTML = '';
    actionsContainer.innerHTML = '';
    return;
  }

  if (!currentJob) {
    previewContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">&#9888;</div>
        <h2 class="empty-state__title">JOB NOT FOUND</h2>
        <p class="empty-state__message">This job may have been deleted.</p>
        <a href="#/inbox" class="btn btn--primary">BACK TO INBOX</a>
      </div>
    `;
    qaContainer.innerHTML = '';
    actionsContainer.innerHTML = '';
    return;
  }

  // Render tool preview (with error message if available)
  renderToolPreview(previewContainer, currentJob.generatedHtml, currentJob.workflowError);

  // Render QA report
  renderQAReport(qaContainer, currentJob.qaReport);

  // Render action buttons with handlers
  renderActionButtons(actionsContainer, currentJob.status, {
    onApprove: () => handleApprove(container),
    onRevise: () => handleRevise(container),
    onReject: () => handleReject(container),
    onCancel: () => handleCancel(container),
    onRetry: () => handleRetry(container),
  });
}

// Load job from API
async function loadJob(jobId: string): Promise<void> {
  setCurrentJobLoading(true);

  try {
    const job = await getJob(jobId);
    setCurrentJob(job);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load job';
    showError(message);
    setCurrentJob(null);
  }
}

// Handle approve action
async function handleApprove(container: HTMLElement): Promise<void> {
  const { currentJob } = store.getState();
  if (!currentJob) return;

  showConfirmDialog({
    title: 'APPROVE & DEPLOY',
    message: 'Are you sure you want to deploy this tool? It will be published to GitHub Pages.',
    confirmLabel: 'DEPLOY',
    confirmClass: 'btn--primary',
    onConfirm: async () => {
      const actionsContainer = container.querySelector<HTMLElement>('#action-buttons-container');
      if (actionsContainer) {
        setActionButtonsLoading(actionsContainer, true);
      }

      // Show deployment progress modal
      showDeployProgress({
        toolName: currentJob.toolName || currentJob.fileName,
      });

      try {
        const response = await approveJob(currentJob._id);

        // Hide progress modal
        hideDeployProgress();

        // Update job in state
        setCurrentJob(response.job);
        updateJobInList(response.job);

        // Show success modal with URL
        if (response.deployedUrl) {
          showSuccessModal({
            url: response.deployedUrl,
            toolName: response.job.toolName || undefined,
          });
        } else {
          showSuccess('Tool deployed successfully!');
          navigate('/inbox');
        }
      } catch (error) {
        // Hide progress modal on error
        hideDeployProgress();

        const message = error instanceof Error ? error.message : 'Failed to deploy tool';
        showError(message);
        if (actionsContainer) {
          setActionButtonsLoading(actionsContainer, false);
        }
      }
    },
  });
}

// Handle revise action
function handleRevise(_container: HTMLElement): void {
  const { currentJob } = store.getState();
  if (!currentJob) return;

  setModal('revision');
  showRevisionModal(currentJob._id);
}

// Handle reject action
async function handleReject(container: HTMLElement): Promise<void> {
  const { currentJob } = store.getState();
  if (!currentJob) return;

  showConfirmDialog({
    title: 'REJECT TOOL',
    message: 'Are you sure you want to reject this tool? This action cannot be undone.',
    confirmLabel: 'REJECT',
    confirmClass: 'btn--danger',
    onConfirm: async () => {
      const actionsContainer = container.querySelector<HTMLElement>('#action-buttons-container');
      if (actionsContainer) {
        setActionButtonsLoading(actionsContainer, true);
      }

      try {
        await rejectJob(currentJob._id);

        // Navigate away - job is rejected, no need to update state
        showSuccess('Tool rejected');
        navigate('/inbox');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to reject job';
        showError(message);
        if (actionsContainer) {
          setActionButtonsLoading(actionsContainer, false);
        }
      }
    },
  });
}

// Handle retry action (for FACTORY_FAILED, QA_FAILED, DEPLOY_FAILED jobs)
async function handleRetry(container: HTMLElement): Promise<void> {
  const { currentJob } = store.getState();
  if (!currentJob) return;

  showConfirmDialog({
    title: 'RETRY JOB',
    message: 'This will re-run the factory pipeline from scratch. Continue?',
    confirmLabel: 'RETRY',
    confirmClass: 'btn--primary',
    onConfirm: async () => {
      const actionsContainer = container.querySelector<HTMLElement>('#action-buttons-container');
      if (actionsContainer) {
        setActionButtonsLoading(actionsContainer, true);
      }

      try {
        await retryJob(currentJob._id);

        // Refresh the job to get new status (should be PROCESSING now)
        const updatedJob = await getJob(currentJob._id);
        setCurrentJob(updatedJob);
        updateJobInList(updatedJob);

        showSuccess('Job sent back to factory for retry');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to retry job';
        showError(message);
        if (actionsContainer) {
          setActionButtonsLoading(actionsContainer, false);
        }
      }
    },
  });
}

// Handle cancel action (for stuck PROCESSING/DEPLOYING jobs)
async function handleCancel(container: HTMLElement): Promise<void> {
  const { currentJob } = store.getState();
  if (!currentJob) return;

  showConfirmDialog({
    title: 'CANCEL JOB',
    message: 'Are you sure you want to cancel this job? It will be moved to QA_FAILED or DEPLOY_FAILED status.',
    confirmLabel: 'CANCEL JOB',
    confirmClass: 'btn--danger',
    onConfirm: async () => {
      const actionsContainer = container.querySelector<HTMLElement>('#action-buttons-container');
      if (actionsContainer) {
        setActionButtonsLoading(actionsContainer, true);
      }

      try {
        const result = await cancelJob(currentJob._id);

        // Refresh the job to get new status
        const updatedJob = await getJob(currentJob._id);
        setCurrentJob(updatedJob);
        updateJobInList(updatedJob);

        showSuccess(result.message || 'Job cancelled');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to cancel job';
        showError(message);
        if (actionsContainer) {
          setActionButtonsLoading(actionsContainer, false);
        }
      }
    },
  });
}

// Polling for status changes
function startPolling(jobId: string): void {
  schedulePoll(jobId);
}

function stopPolling(): void {
  if (pollTimeout) {
    clearTimeout(pollTimeout);
    pollTimeout = null;
  }
}

function schedulePoll(jobId: string): void {
  pollTimeout = setTimeout(async () => {
    if (currentJobId !== jobId) return;

    try {
      const job = await getJob(jobId);
      const { currentJob } = store.getState();

      // Check if status changed from READY_FOR_REVIEW
      if (currentJob && currentJob.status !== job.status) {
        setCurrentJob(job);
        updateJobInList(job);

        // If status changed away from READY_FOR_REVIEW, buttons will be disabled via re-render
        if (currentJob.status === 'READY_FOR_REVIEW' && job.status !== 'READY_FOR_REVIEW') {
          showError('Job status has changed. Action buttons disabled.');
        }
      }
    } catch (error) {
      // Silently fail on poll errors
      console.error('Poll error:', error);
    }

    if (currentJobId === jobId) {
      schedulePoll(jobId);
    }
  }, POLL_INTERVAL);
}

// Cleanup function
export function cleanupPreviewView(): void {
  stopPolling();
  unsubscribers.forEach((unsub) => unsub());
  unsubscribers = [];
  currentJobId = null;
  setCurrentJob(null);
}
