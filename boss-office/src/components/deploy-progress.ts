// Deployment progress modal
// Shows while deployment is in progress

let progressInterval: ReturnType<typeof setInterval> | null = null;

export interface DeployProgressOptions {
  toolName?: string;
}

// Show deployment progress modal
export function showDeployProgress(options: DeployProgressOptions = {}): void {
  const { toolName } = options;

  // Create modal container
  const modalContainer = document.createElement('div');
  modalContainer.className = 'modal-overlay';
  modalContainer.id = 'deploy-progress-modal';

  modalContainer.innerHTML = `
    <div class="modal" style="max-width: 500px;">
      <div class="modal__header">
        <h2 class="modal__title">DEPLOYING TO GITHUB PAGES</h2>
      </div>
      <div class="modal__body" style="text-align: center; padding: var(--space-xl);">
        <div class="deploy-progress__icon" style="font-size: 3rem; margin-bottom: var(--space-md);">
          &#128640;
        </div>
        <h3 style="margin-bottom: var(--space-md); font-family: var(--font-heading);">
          ${toolName ? escapeHtml(toolName) : 'YOUR TOOL'}
        </h3>
        <div class="deploy-progress__bar-container" style="
          width: 100%;
          height: 8px;
          background: var(--color-dark-grey);
          border-radius: 4px;
          overflow: hidden;
          margin-bottom: var(--space-md);
        ">
          <div class="deploy-progress__bar" id="deploy-progress-bar" style="
            width: 0%;
            height: 100%;
            background: var(--color-yellow);
            transition: width 0.3s ease-out;
          "></div>
        </div>
        <p class="deploy-progress__status" id="deploy-status" style="
          color: var(--color-grey);
          font-size: 0.875rem;
        ">
          Connecting to GitHub...
        </p>
      </div>
    </div>
  `;

  // Add to body
  document.body.appendChild(modalContainer);

  // Start progress animation
  let progress = 0;
  const stages = [
    { at: 10, text: 'Authenticating with GitHub...' },
    { at: 25, text: 'Preparing tool HTML...' },
    { at: 40, text: 'Creating file in repository...' },
    { at: 60, text: 'Committing changes...' },
    { at: 75, text: 'Triggering GitHub Pages build...' },
    { at: 90, text: 'Finalizing deployment...' },
  ];

  const progressBar = modalContainer.querySelector<HTMLElement>('#deploy-progress-bar');
  const statusText = modalContainer.querySelector<HTMLElement>('#deploy-status');

  progressInterval = setInterval(() => {
    if (progress < 95) {
      progress += Math.random() * 3 + 1;
      if (progress > 95) progress = 95;

      if (progressBar) {
        progressBar.style.width = `${progress}%`;
      }

      // Update status text based on progress
      const currentStage = stages.filter(s => s.at <= progress).pop();
      if (currentStage && statusText) {
        statusText.textContent = currentStage.text;
      }
    }
  }, 200);
}

// Hide deployment progress modal (called when deployment completes or fails)
export function hideDeployProgress(): void {
  // Clear the interval
  if (progressInterval) {
    clearInterval(progressInterval);
    progressInterval = null;
  }

  // Complete the progress bar
  const progressBar = document.querySelector<HTMLElement>('#deploy-progress-bar');
  if (progressBar) {
    progressBar.style.width = '100%';
  }

  // Remove after brief delay to show completion
  setTimeout(() => {
    const modal = document.querySelector('#deploy-progress-modal');
    if (modal) {
      modal.remove();
    }
  }, 300);
}

// Escape HTML to prevent XSS
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
