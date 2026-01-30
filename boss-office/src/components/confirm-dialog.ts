import { closeModal } from '../store/actions.ts';

// Confirmation dialog options
export interface ConfirmDialogOptions {
  title: string;
  message: string;
  confirmLabel: string;
  confirmClass?: string;
  onConfirm: () => void;
  onCancel?: () => void;
}

// Show confirmation dialog
export function showConfirmDialog(options: ConfirmDialogOptions): void {
  const {
    title,
    message,
    confirmLabel,
    confirmClass = 'btn--primary',
    onConfirm,
    onCancel,
  } = options;

  // Create modal container
  const modalContainer = document.createElement('div');
  modalContainer.className = 'modal-overlay';
  modalContainer.id = 'confirm-dialog';

  modalContainer.innerHTML = `
    <div class="modal">
      <div class="modal__header">
        <h2 class="modal__title">${escapeHtml(title)}</h2>
        <button class="modal__close" id="confirm-close">&times;</button>
      </div>
      <div class="modal__body">
        <p>${escapeHtml(message)}</p>
      </div>
      <div class="modal__footer">
        <button class="btn btn--secondary" id="confirm-cancel">CANCEL</button>
        <button class="btn ${confirmClass}" id="confirm-action">${escapeHtml(confirmLabel)}</button>
      </div>
    </div>
  `;

  // Add to body
  document.body.appendChild(modalContainer);

  // Focus trap
  const confirmBtn = modalContainer.querySelector<HTMLButtonElement>('#confirm-action');
  confirmBtn?.focus();

  // Handle close
  const handleClose = () => {
    modalContainer.remove();
    closeModal();
    onCancel?.();
  };

  // Handle confirm
  const handleConfirm = () => {
    modalContainer.remove();
    closeModal();
    onConfirm();
  };

  // Event listeners
  modalContainer.querySelector('#confirm-close')?.addEventListener('click', handleClose);
  modalContainer.querySelector('#confirm-cancel')?.addEventListener('click', handleClose);
  modalContainer.querySelector('#confirm-action')?.addEventListener('click', handleConfirm);

  // Close on backdrop click
  modalContainer.addEventListener('click', (e) => {
    if (e.target === modalContainer) {
      handleClose();
    }
  });

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
