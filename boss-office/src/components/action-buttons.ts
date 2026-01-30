import type { JobStatus } from '../types/index.ts';

// Action button click handlers
export interface ActionButtonHandlers {
  onApprove: () => void;
  onRevise: () => void;
  onReject: () => void;
}

// Render action buttons (for READY_FOR_REVIEW and QA_FAILED statuses)
export function renderActionButtons(
  container: HTMLElement,
  status: JobStatus,
  handlers: ActionButtonHandlers,
  loading: boolean = false
): void {
  // Allow actions for both READY_FOR_REVIEW and QA_FAILED (boss can still approve or revise)
  const isActionable = status === 'READY_FOR_REVIEW' || status === 'QA_FAILED';

  if (!isActionable) {
    container.innerHTML = `
      <div class="preview__actions">
        <p class="label" style="text-align: center; color: var(--color-grey);">
          ${getStatusMessage(status)}
        </p>
      </div>
    `;
    return;
  }

  // Show warning for QA_FAILED
  const qaFailedWarning = status === 'QA_FAILED'
    ? `<p class="preview__warning" style="text-align: center; color: var(--color-yellow); margin-bottom: var(--space-md); font-size: 0.875rem;">
        ⚠️ QA checks failed. Review carefully before approving.
      </p>`
    : '';

  container.innerHTML = `
    <div class="preview__actions">
      ${qaFailedWarning}
      <button
        id="approve-btn"
        class="btn btn--primary ${loading ? 'btn--loading' : ''}"
        ${loading ? 'disabled' : ''}
      >
        APPROVE & DEPLOY
      </button>
      <button
        id="revise-btn"
        class="btn btn--secondary ${loading ? 'btn--loading' : ''}"
        ${loading ? 'disabled' : ''}
      >
        REVISE
      </button>
      <button
        id="reject-btn"
        class="btn btn--danger ${loading ? 'btn--loading' : ''}"
        ${loading ? 'disabled' : ''}
      >
        REJECT
      </button>
    </div>
  `;

  // Attach handlers
  const approveBtn = container.querySelector<HTMLButtonElement>('#approve-btn');
  const reviseBtn = container.querySelector<HTMLButtonElement>('#revise-btn');
  const rejectBtn = container.querySelector<HTMLButtonElement>('#reject-btn');

  approveBtn?.addEventListener('click', handlers.onApprove);
  reviseBtn?.addEventListener('click', handlers.onRevise);
  rejectBtn?.addEventListener('click', handlers.onReject);
}

// Get status message for non-actionable states
function getStatusMessage(status: JobStatus): string {
  switch (status) {
    case 'DRAFT':
      return 'This tool is still in draft';
    case 'SENT':
      return 'This tool has been sent to the Factory';
    case 'PROCESSING':
      return 'The Factory is generating this tool...';
    case 'QA_IN_PROGRESS':
      return 'QA Department is reviewing this tool...';
    case 'REVISION_REQUESTED':
      return 'Revision in progress...';
    case 'DEPLOYING':
      return 'Deployment in progress...';
    case 'DEPLOYED':
      return 'This tool has been deployed';
    case 'REJECTED':
      return 'This tool has been rejected';
    default:
      return 'Actions not available';
  }
}

// Update button loading state
export function setActionButtonsLoading(container: HTMLElement, loading: boolean): void {
  const buttons = container.querySelectorAll<HTMLButtonElement>('.preview__actions .btn');
  buttons.forEach((btn) => {
    btn.disabled = loading;
    btn.classList.toggle('btn--loading', loading);
  });
}
