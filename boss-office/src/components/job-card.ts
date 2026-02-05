import type { Job, JobStatus } from '../types/index.ts';
import { navigate } from '../utils/router.ts';
import { renderCompactProgress } from './pipeline-progress.ts';

// Check if a job is actively processing
function isProcessing(status: JobStatus): boolean {
  return ['SENT', 'PROCESSING', 'QA_IN_PROGRESS', 'REVISION_REQUESTED'].includes(status);
}

// Status display configuration
const STATUS_CONFIG: Record<
  JobStatus,
  { icon: string; label: string; badgeClass: string }
> = {
  DRAFT: { icon: '&#128221;', label: 'DRAFT', badgeClass: 'badge--pending' },
  SENT: { icon: '&#128228;', label: 'SENT', badgeClass: 'badge--pending' },
  PROCESSING: { icon: '&#9881;', label: 'PROCESSING', badgeClass: 'badge--processing' },
  QA_IN_PROGRESS: { icon: '&#128269;', label: 'QA IN PROGRESS', badgeClass: 'badge--processing' },
  QA_FAILED: { icon: '&#9888;', label: 'QA FAILED', badgeClass: 'badge--error' },
  READY_FOR_REVIEW: { icon: '&#10004;', label: 'READY FOR REVIEW', badgeClass: 'badge--ready' },
  REVISION_REQUESTED: { icon: '&#128393;', label: 'REVISION REQUESTED', badgeClass: 'badge--processing' },
  DEPLOYING: { icon: '&#128640;', label: 'DEPLOYING', badgeClass: 'badge--processing' },
  DEPLOYED: { icon: '&#127881;', label: 'DEPLOYED', badgeClass: 'badge--success' },
  DEPLOY_FAILED: { icon: '&#9888;', label: 'DEPLOY FAILED', badgeClass: 'badge--error' },
  REJECTED: { icon: '&#10006;', label: 'REJECTED', badgeClass: 'badge--error' },
  ESCALATED: { icon: '&#9888;', label: 'ESCALATED', badgeClass: 'badge--error' },
  FACTORY_FAILED: { icon: '&#9888;', label: 'FACTORY FAILED', badgeClass: 'badge--error' },
  FAILED_SEND: { icon: '&#9888;', label: 'FAILED TO SEND', badgeClass: 'badge--error' },
  DEPLOY_REQUESTED: { icon: '&#128640;', label: 'DEPLOY QUEUED', badgeClass: 'badge--processing' },
};

// Category labels
const CATEGORY_LABELS: Record<string, string> = {
  B2B_PRODUCT: 'B2B PRODUCT',
  B2B_SERVICE: 'B2B SERVICE',
  B2C_PRODUCT: 'B2C PRODUCT',
  B2C_SERVICE: 'B2C SERVICE',
};

// Render a single job card
export function renderJobCard(job: Job): string {
  const status = STATUS_CONFIG[job.status] || STATUS_CONFIG.DRAFT;
  const categoryLabel = CATEGORY_LABELS[job.category] || job.category;
  const displayName = job.toolName || job.fileName;
  const relativeTime = formatRelativeTime(job.updatedAt);
  const showProgress = isProcessing(job.status);
  const progressHtml = showProgress ? renderCompactProgress(job.status, job.createdAt) : '';
  const isDeployed = job.status === 'DEPLOYED' && job.deployedUrl;
  const isFailed = job.status === 'QA_FAILED';

  // Deployed URL section for deployed tools
  const deployedUrlHtml = isDeployed ? `
    <div class="job-card__url" onclick="event.stopPropagation()">
      <a href="${escapeHtml(job.deployedUrl!)}" target="_blank" rel="noopener noreferrer" class="job-card__url-link" title="Open tool in new tab">
        ${escapeHtml(job.deployedUrl!)}
      </a>
      <button
        class="btn btn--small job-card__copy-btn"
        data-url="${escapeHtml(job.deployedUrl!)}"
        title="Copy URL"
      >
        COPY
      </button>
    </div>
  ` : '';

  // Error message section for failed jobs
  const errorHtml = isFailed && job.workflowError ? `
    <div class="job-card__error" style="margin-top: 4px; padding: 4px 8px; background: var(--color-black); color: var(--color-white); font-size: 0.75rem; border-radius: 2px;">
      <strong>Error:</strong> ${escapeHtml(job.workflowError.substring(0, 100))}${job.workflowError.length > 100 ? '...' : ''}
    </div>
  ` : '';

  return `
    <div class="job-card ${showProgress ? 'job-card--processing' : ''} ${isDeployed ? 'job-card--deployed' : ''}" data-job-id="${job._id}">
      <div class="job-card__status">
        <span title="${status.label}">${status.icon}</span>
      </div>
      <div class="job-card__info">
        <div class="job-card__title">${escapeHtml(displayName)}</div>
        <div class="job-card__meta">
          <span class="badge ${status.badgeClass}">${status.label}</span>
          <span>${categoryLabel}</span>
          <span>${relativeTime}</span>
        </div>
        ${progressHtml}
        ${deployedUrlHtml}
        ${errorHtml}
      </div>
      <div class="job-card__actions">
        <button
          class="btn btn--secondary btn--small job-card__logs-btn"
          data-job-id="${job._id}"
        >
          LOGS
        </button>
        <button
          class="btn btn--secondary btn--small job-card__view-btn"
          data-job-id="${job._id}"
          ${showProgress ? 'disabled' : ''}
        >
          ${showProgress ? 'BUILDING...' : 'VIEW'}
        </button>
      </div>
    </div>
  `;
}

// Attach click handlers to job cards
export function attachJobCardListeners(container: HTMLElement): void {
  // View button clicks
  container.querySelectorAll<HTMLButtonElement>('.job-card__view-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const jobId = btn.dataset.jobId;
      if (jobId) {
        navigate(`/preview/${jobId}`);
      }
    });
  });

  // Logs button clicks
  container.querySelectorAll<HTMLButtonElement>('.job-card__logs-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const jobId = btn.dataset.jobId;
      if (jobId) {
        navigate(`/logs/${jobId}`);
      }
    });
  });

  // Copy URL button clicks
  container.querySelectorAll<HTMLButtonElement>('.job-card__copy-btn').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const url = btn.dataset.url;
      if (url) {
        try {
          await navigator.clipboard.writeText(url);
          const originalText = btn.textContent;
          btn.textContent = 'COPIED!';
          btn.classList.add('btn--success');
          setTimeout(() => {
            btn.textContent = originalText;
            btn.classList.remove('btn--success');
          }, 2000);
        } catch (err) {
          console.error('Failed to copy URL:', err);
        }
      }
    });
  });

  // Card clicks (entire card is clickable)
  container.querySelectorAll<HTMLElement>('.job-card').forEach((card) => {
    card.addEventListener('click', () => {
      const jobId = card.dataset.jobId;
      if (jobId) {
        navigate(`/preview/${jobId}`);
      }
    });
  });
}

// Format relative time (e.g., "2 minutes ago")
function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) {
    return 'just now';
  } else if (diffMin < 60) {
    return `${diffMin} min${diffMin === 1 ? '' : 's'} ago`;
  } else if (diffHour < 24) {
    return `${diffHour} hour${diffHour === 1 ? '' : 's'} ago`;
  } else if (diffDay < 7) {
    return `${diffDay} day${diffDay === 1 ? '' : 's'} ago`;
  } else {
    return date.toLocaleDateString();
  }
}

// Escape HTML to prevent XSS
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
