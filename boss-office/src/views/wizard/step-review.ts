// Step 5: Review & Submit
// Feature: Boss Office Redesign

import type { WizardState } from '../../types/index.ts';
import { SPRINTS } from '../../types/index.ts';

// Category display names
const CATEGORY_LABELS: Record<string, string> = {
  B2B_PRODUCT: 'B2B Product',
  B2B_SERVICE: 'B2B Service',
  B2C_PRODUCT: 'B2C Product',
  B2C_SERVICE: 'B2C Service',
};

/**
 * Render Step 5: Review & Submit
 */
export function renderStepReview(
  container: HTMLElement,
  state: WizardState,
  goToStep: (step: number) => void
): void {
  const sprint = SPRINTS.find((s) => s.id === state.sprintId);

  container.innerHTML = `
    <div class="wizard-step wizard-step--review">
      <p class="wizard-step__intro">
        Review your tool specification before submitting. Click "EDIT" on any section to make changes.
      </p>

      <!-- Step 1: Identity -->
      <div class="review-card">
        <div class="review-card__header">
          <h4 class="review-card__title">IDENTITY & CONTEXT</h4>
          <button type="button" class="btn btn--secondary btn--small review-card__edit" data-step="1">EDIT</button>
        </div>
        <div class="review-card__content">
          <div class="review-field">
            <span class="review-field__label">Tool Name</span>
            <span class="review-field__value">${escapeHtml(state.toolName) || '—'}</span>
          </div>
          <div class="review-field">
            <span class="review-field__label">Sprint / Module</span>
            <span class="review-field__value">${sprint?.name || '—'}</span>
          </div>
          <div class="review-field">
            <span class="review-field__label">Category</span>
            <span class="review-field__value">${CATEGORY_LABELS[state.category] || state.category}</span>
          </div>
          <div class="review-field">
            <span class="review-field__label">Source File</span>
            <span class="review-field__value">
              ${state.fileUpload ? `${escapeHtml(state.fileUpload.name)} (${state.fileUpload.status})` : '—'}
            </span>
          </div>
        </div>
      </div>

      <!-- Step 2: Framework -->
      <div class="review-card">
        <div class="review-card__header">
          <h4 class="review-card__title">FRAMEWORK SELECTION</h4>
          <button type="button" class="btn btn--secondary btn--small review-card__edit" data-step="2">EDIT</button>
        </div>
        <div class="review-card__content">
          <div class="review-field review-field--full">
            <span class="review-field__label">Framework Description</span>
            <p class="review-field__text">${escapeHtml(state.frameworkDescription) || '—'}</p>
          </div>
          <div class="review-field">
            <span class="review-field__label">Key Terminology</span>
            <div class="review-field__tags">
              ${state.keyTerminology.length > 0
                ? state.keyTerminology.map((t) => `<span class="tag tag--small">${escapeHtml(t)}</span>`).join('')
                : '<span class="review-field__empty">None specified</span>'
              }
            </div>
          </div>
          <div class="review-field">
            <span class="review-field__label">Expert Quotes</span>
            <span class="review-field__value">${state.expertQuotes.filter((q) => q.trim()).length} quote(s)</span>
          </div>
        </div>
      </div>

      <!-- Step 3: Inputs -->
      <div class="review-card">
        <div class="review-card__header">
          <h4 class="review-card__title">INPUT DESIGN</h4>
          <button type="button" class="btn btn--secondary btn--small review-card__edit" data-step="3">EDIT</button>
        </div>
        <div class="review-card__content">
          ${state.inputFields.length > 0 ? `
            <div class="review-inputs">
              ${state.inputFields.map((field, index) => `
                <div class="review-input">
                  <span class="review-input__number">${index + 1}</span>
                  <div class="review-input__details">
                    <span class="review-input__label">${escapeHtml(field.label) || 'Unnamed field'}</span>
                    <span class="review-input__type">${field.type}${field.required ? ' (required)' : ''}</span>
                  </div>
                </div>
              `).join('')}
            </div>
          ` : `
            <p class="review-field__empty">No input fields defined</p>
          `}
        </div>
      </div>

      <!-- Step 4: Decision -->
      <div class="review-card">
        <div class="review-card__header">
          <h4 class="review-card__title">DECISION LOGIC</h4>
          <button type="button" class="btn btn--secondary btn--small review-card__edit" data-step="4">EDIT</button>
        </div>
        <div class="review-card__content">
          <div class="review-field review-field--full">
            <span class="review-field__label">Decision Question</span>
            <p class="review-field__text">${escapeHtml(state.decisionQuestion) || '—'}</p>
          </div>
          <div class="review-field review-field--full">
            <span class="review-field__label">Verdict Criteria</span>
            <p class="review-field__text">${escapeHtml(state.verdictCriteria) || '—'}</p>
          </div>
        </div>
      </div>

      <!-- Submit Confirmation -->
      <div class="review-submit-info">
        <div class="review-submit-info__icon">🚀</div>
        <div class="review-submit-info__content">
          <h4 class="review-submit-info__title">READY TO SUBMIT</h4>
          <p class="review-submit-info__text">
            Your tool will be sent to the factory for processing. You can track its progress in the inbox.
          </p>
        </div>
      </div>
    </div>
  `;

  // Attach edit button listeners
  const editButtons = container.querySelectorAll<HTMLButtonElement>('.review-card__edit');
  editButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const step = parseInt(btn.dataset.step || '1', 10);
      goToStep(step);
    });
  });
}

/**
 * Escape HTML
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
