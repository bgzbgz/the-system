import { closeModal, showSuccess } from '../store/actions.ts';
import { navigate } from '../utils/router.ts';

// Success modal options
export interface SuccessModalOptions {
  url: string;
  toolName?: string;
}

// Show success modal with deployed URL
export function showSuccessModal(options: SuccessModalOptions): void {
  const { url, toolName } = options;

  // Create modal container
  const modalContainer = document.createElement('div');
  modalContainer.className = 'modal-overlay';
  modalContainer.id = 'success-modal';

  modalContainer.innerHTML = `
    <div class="modal" style="max-width: 600px;">
      <div class="modal__header">
        <h2 class="modal__title">TOOL DEPLOYED</h2>
        <button class="modal__close" id="success-close">&times;</button>
      </div>
      <div class="modal__body success-modal">
        <div class="success-modal__icon">&#127881;</div>
        <h3 class="success-modal__title">
          ${toolName ? escapeHtml(toolName) : 'YOUR TOOL'} IS LIVE!
        </h3>
        <div class="success-modal__url" id="deployed-url">
          ${escapeHtml(url)}
        </div>
        <button class="btn btn--primary" id="copy-url-btn" style="width: 100%; margin-bottom: var(--space-md);">
          COPY URL
        </button>
        <a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="btn btn--secondary" style="width: 100%; margin-bottom: var(--space-md);">
          OPEN IN NEW TAB
        </a>
        <p class="success-modal__instruction">
          Paste this URL in LearnWorlds course button to link to this tool.
        </p>
        <p class="success-modal__note" style="font-size: 0.75rem; color: var(--color-grey); margin-top: var(--space-sm);">
          Note: GitHub Pages may take 1-2 minutes to build. If you see a 404 error, wait and refresh.
        </p>
      </div>
      <div class="modal__footer">
        <button class="btn btn--secondary" id="success-done">DONE</button>
      </div>
    </div>
  `;

  // Add to body
  document.body.appendChild(modalContainer);

  // Handle close
  const handleClose = () => {
    modalContainer.remove();
    closeModal();
    navigate('/inbox');
  };

  // Handle copy URL
  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(url);
      showSuccess('URL copied to clipboard!');

      // Update button text temporarily
      const copyBtn = modalContainer.querySelector<HTMLButtonElement>('#copy-url-btn');
      if (copyBtn) {
        const originalText = copyBtn.textContent;
        copyBtn.textContent = 'COPIED!';
        setTimeout(() => {
          copyBtn.textContent = originalText;
        }, 2000);
      }
    } catch (error) {
      // Fallback for older browsers
      const urlElement = modalContainer.querySelector<HTMLElement>('#deployed-url');
      if (urlElement) {
        const range = document.createRange();
        range.selectNodeContents(urlElement);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);

        showSuccess('URL selected - press Ctrl+C to copy');
      }
    }
  };

  // Event listeners
  modalContainer.querySelector('#success-close')?.addEventListener('click', handleClose);
  modalContainer.querySelector('#success-done')?.addEventListener('click', handleClose);
  modalContainer.querySelector('#copy-url-btn')?.addEventListener('click', handleCopyUrl);

  // Close on Escape
  const handleKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleClose();
      document.removeEventListener('keydown', handleKeydown);
    }
  };
  document.addEventListener('keydown', handleKeydown);
}

// Escape HTML to prevent XSS
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
