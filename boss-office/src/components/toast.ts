import { store, removeToast } from '../store/actions.ts';
import type { Toast } from '../types/index.ts';

// Toast container reference
let toastContainer: HTMLElement | null = null;

// Render the toast container and subscribe to updates
export function renderToastContainer(container: HTMLElement): void {
  toastContainer = container;
  container.className = 'toast-container';

  // Subscribe to state changes
  store.subscribe((state, prevState) => {
    if (state.toasts !== prevState.toasts) {
      renderToasts(state.toasts);
    }
  });

  // Initial render
  renderToasts(store.getState().toasts);
}

// Render all toasts
function renderToasts(toasts: Toast[]): void {
  if (!toastContainer) return;

  toastContainer.innerHTML = toasts
    .map((toast) => renderToastHTML(toast))
    .join('');

  // Attach close handlers
  toasts.forEach((toast) => {
    const closeBtn = toastContainer?.querySelector(
      `[data-toast-close="${toast.id}"]`
    );
    closeBtn?.addEventListener('click', () => removeToast(toast.id));
  });
}

// Render single toast HTML
function renderToastHTML(toast: Toast): string {
  const icon = getToastIcon(toast.type);

  return `
    <div class="toast toast--${toast.type}" role="alert" aria-live="polite">
      <span class="toast__icon">${icon}</span>
      <span class="toast__message">${escapeHtml(toast.message)}</span>
      <button
        class="toast__close"
        data-toast-close="${toast.id}"
        aria-label="Dismiss notification"
      >
        &times;
      </button>
    </div>
  `;
}

// Get icon for toast type
function getToastIcon(type: Toast['type']): string {
  switch (type) {
    case 'success':
      return '&#10003;'; // checkmark
    case 'error':
      return '&#10007;'; // X
    case 'info':
      return '&#9432;'; // info circle
    default:
      return '';
  }
}

// Escape HTML to prevent XSS
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
