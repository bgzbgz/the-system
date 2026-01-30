import {
  closeModal,
  showSuccess,
  showError,
  setCurrentJob,
  updateJobInList,
} from '../store/actions.ts';
import { requestRevision } from '../api/jobs.ts';
import {
  validateRevisionNotes,
  REVISION_LIMITS,
  formatCharCount,
  getCharCountStatus,
} from '../utils/validators.ts';
import { navigate } from '../utils/router.ts';

// Show revision modal
export function showRevisionModal(jobId: string): void {
  // Create modal container
  const modalContainer = document.createElement('div');
  modalContainer.className = 'modal-overlay';
  modalContainer.id = 'revision-modal';

  modalContainer.innerHTML = `
    <div class="modal" style="max-width: 600px;">
      <div class="modal__header">
        <h2 class="modal__title">REQUEST REVISION</h2>
        <button class="modal__close" id="revision-close">&times;</button>
      </div>
      <div class="modal__body">
        <div class="form-group">
          <label class="form-label" for="revision-notes">
            DESCRIBE THE CHANGES NEEDED
          </label>
          <textarea
            id="revision-notes"
            class="form-textarea"
            placeholder="Be specific about what needs to change..."
            minlength="${REVISION_LIMITS.minLength}"
            maxlength="${REVISION_LIMITS.maxLength}"
            rows="6"
          ></textarea>
          <div class="form-hint">
            <span id="revision-char-count" class="char-count">
              ${formatCharCount(0, REVISION_LIMITS.maxLength)}
            </span>
            <span style="margin-left: var(--space-md);">Min ${REVISION_LIMITS.minLength} characters</span>
          </div>
          <div id="revision-error" class="form-error hidden"></div>
        </div>
      </div>
      <div class="modal__footer">
        <button class="btn btn--secondary" id="revision-cancel">CANCEL</button>
        <button class="btn btn--primary" id="revision-submit" disabled>
          SUBMIT REVISION
        </button>
      </div>
    </div>
  `;

  // Add to body
  document.body.appendChild(modalContainer);

  // Get elements
  const textarea = modalContainer.querySelector<HTMLTextAreaElement>('#revision-notes');
  const charCount = modalContainer.querySelector<HTMLElement>('#revision-char-count');
  const errorEl = modalContainer.querySelector<HTMLElement>('#revision-error');
  const submitBtn = modalContainer.querySelector<HTMLButtonElement>('#revision-submit');

  // Focus textarea
  textarea?.focus();

  // Handle close
  const handleClose = () => {
    modalContainer.remove();
    closeModal();
  };

  // Update char count and validation
  const updateValidation = () => {
    if (!textarea || !charCount || !errorEl || !submitBtn) return;

    const value = textarea.value;
    const length = value.length;

    // Update char count
    charCount.textContent = formatCharCount(length, REVISION_LIMITS.maxLength);
    const status = getCharCountStatus(length, REVISION_LIMITS.maxLength);
    charCount.className = `char-count ${status === 'warning' ? 'char-count--warning' : ''} ${status === 'error' ? 'char-count--error' : ''}`;

    // Validate
    const validation = validateRevisionNotes(value);
    submitBtn.disabled = !validation.valid;

    // Show/hide error (only on blur or submit attempt)
    if (!validation.valid && length > 0) {
      textarea.classList.add('form-textarea--error');
    } else {
      textarea.classList.remove('form-textarea--error');
    }
  };

  // Handle submit
  const handleSubmit = async () => {
    if (!textarea || !submitBtn) return;

    const value = textarea.value;
    const validation = validateRevisionNotes(value);

    if (!validation.valid) {
      if (errorEl) {
        errorEl.textContent = validation.error || '';
        errorEl.classList.remove('hidden');
      }
      return;
    }

    // Set loading state
    submitBtn.disabled = true;
    submitBtn.classList.add('btn--loading');

    try {
      const job = await requestRevision(jobId, value.trim());

      // Update state
      setCurrentJob(job);
      updateJobInList(job);

      // Close modal and show success
      handleClose();
      showSuccess('Revision requested');
      navigate('/inbox');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to submit revision';
      showError(message);

      // Reset button
      submitBtn.disabled = false;
      submitBtn.classList.remove('btn--loading');
    }
  };

  // Event listeners
  textarea?.addEventListener('input', updateValidation);
  textarea?.addEventListener('blur', () => {
    const validation = validateRevisionNotes(textarea.value);
    if (!validation.valid && textarea.value.length > 0 && errorEl) {
      errorEl.textContent = validation.error || '';
      errorEl.classList.remove('hidden');
    } else if (errorEl) {
      errorEl.classList.add('hidden');
    }
  });

  modalContainer.querySelector('#revision-close')?.addEventListener('click', handleClose);
  modalContainer.querySelector('#revision-cancel')?.addEventListener('click', handleClose);
  modalContainer.querySelector('#revision-submit')?.addEventListener('click', handleSubmit);

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
