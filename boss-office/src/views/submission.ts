import {
  store,
  setSubmitting,
  resetSubmissionForm,
  showSuccess,
  showError,
  addJob,
} from '../store/actions.ts';
import { renderFileUpload, subscribeFileUpload } from '../components/file-upload.ts';
import { renderQuestionnaire, subscribeQuestionnaire } from '../components/questionnaire.ts';
import { isQuestionnaireValid, isFileUploadReady } from '../utils/validators.ts';
import { createJob } from '../api/jobs.ts';
import { navigate } from '../utils/router.ts';
import type { Questionnaire, CreateJobRequest } from '../types/index.ts';

// Unsubscribe functions
let unsubscribers: Array<() => void> = [];

// Render the submission view
export function renderSubmissionView(container: HTMLElement): void {
  // Clean up previous subscriptions
  unsubscribers.forEach((unsub) => unsub());
  unsubscribers = [];

  const { fileUpload, questionnaire, submitting } = store.getState();

  // Check if form is valid for submission
  const isFileReady = isFileUploadReady(fileUpload);
  const isFormValid = isQuestionnaireValid(questionnaire);
  const canSubmit = isFileReady && isFormValid && !submitting;

  container.innerHTML = `
    <div class="view">
      <div class="view__header">
        <h1 class="view__title">SUBMIT NEW TOOL</h1>
        <p class="view__subtitle">Upload your source document and answer 5 questions to create a new tool</p>
      </div>

      <div class="submission">
        <div class="submission__upload" id="upload-container"></div>
        <div class="submission__form" id="questionnaire-container"></div>
        <div class="submission__actions">
          <button
            id="submit-btn"
            class="btn btn--primary ${submitting ? 'btn--loading' : ''}"
            ${!canSubmit ? 'disabled' : ''}
          >
            SEND TO FACTORY
          </button>
        </div>
      </div>
    </div>
  `;

  // Render sub-components
  const uploadContainer = container.querySelector<HTMLElement>('#upload-container');
  const questionnaireContainer = container.querySelector<HTMLElement>('#questionnaire-container');

  if (uploadContainer) {
    renderFileUpload(uploadContainer);
    unsubscribers.push(subscribeFileUpload(uploadContainer));
  }

  if (questionnaireContainer) {
    renderQuestionnaire(questionnaireContainer);
    unsubscribers.push(subscribeQuestionnaire(questionnaireContainer));
  }

  // Attach submit handler
  const submitBtn = container.querySelector<HTMLButtonElement>('#submit-btn');
  if (submitBtn) {
    submitBtn.addEventListener('click', () => handleSubmit(container));
  }

  // Subscribe to state changes for button state
  unsubscribers.push(
    store.subscribe((state, prevState) => {
      const wasValid =
        isFileUploadReady(prevState.fileUpload) &&
        isQuestionnaireValid(prevState.questionnaire);
      const isValid =
        isFileUploadReady(state.fileUpload) &&
        isQuestionnaireValid(state.questionnaire);

      if (wasValid !== isValid || state.submitting !== prevState.submitting) {
        updateSubmitButton(container);
      }
    })
  );
}

// Update submit button state
function updateSubmitButton(container: HTMLElement): void {
  const { fileUpload, questionnaire, submitting } = store.getState();
  const isFileReady = isFileUploadReady(fileUpload);
  const isFormValid = isQuestionnaireValid(questionnaire);
  const canSubmit = isFileReady && isFormValid && !submitting;

  const submitBtn = container.querySelector<HTMLButtonElement>('#submit-btn');
  if (submitBtn) {
    submitBtn.disabled = !canSubmit;
    submitBtn.classList.toggle('btn--loading', submitting);
  }
}

// Handle form submission
async function handleSubmit(container: HTMLElement): Promise<void> {
  const { fileUpload, questionnaire } = store.getState();

  // Validate again
  if (!isFileUploadReady(fileUpload) || !isQuestionnaireValid(questionnaire)) {
    showError('Please complete all required fields');
    return;
  }

  // Set loading state
  setSubmitting(true);
  updateSubmitButton(container);

  try {
    // Prepare request
    const request: CreateJobRequest = {
      fileName: fileUpload!.name,
      fileContent: fileUpload!.extractedText!,
      questionnaire: questionnaire as Questionnaire,
    };

    // Create job via API
    const newJob = await createJob(request);

    // Add job to list immediately so progress bar shows
    addJob(newJob);

    // Success!
    showSuccess('Tool request submitted - processing started!');

    // Reset form
    resetSubmissionForm();

    // Navigate to inbox
    navigate('/inbox');
  } catch (error) {
    // T031: Error handling - preserve form data for retry
    const message = error instanceof Error ? error.message : 'Failed to submit tool request';
    showError(message);
    setSubmitting(false);
    updateSubmitButton(container);
  }
}

// Cleanup function for view unmount
export function cleanupSubmissionView(): void {
  unsubscribers.forEach((unsub) => unsub());
  unsubscribers = [];
}
