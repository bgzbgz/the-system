// Step 2: Framework Selection
// Feature: Boss Office Redesign

import type { WizardState } from '../../types/index.ts';

const CHAR_LIMITS = {
  frameworkDescription: 500,
  terminology: 200,
  quote: 300,
};

/**
 * Render Step 2: Framework Selection
 */
export function renderStepFramework(
  container: HTMLElement,
  state: WizardState,
  updateState: (updates: Partial<WizardState>) => void
): void {
  container.innerHTML = `
    <div class="wizard-step wizard-step--framework">
      <p class="wizard-step__intro">
        Define the teaching framework and course-specific content this tool should apply.
      </p>

      <!-- Framework Description -->
      <div class="form-group ${state.errors.frameworkDescription ? 'form-group--error' : ''}">
        <label class="form-label" for="framework-desc">FRAMEWORK DESCRIPTION *</label>
        <textarea
          id="framework-desc"
          class="form-textarea"
          rows="5"
          maxlength="${CHAR_LIMITS.frameworkDescription}"
          placeholder="Describe the teaching framework or methodology this tool should apply. What concept from the course should users learn while using this tool?"
        >${escapeHtml(state.frameworkDescription)}</textarea>
        <div class="form-hint">
          <span class="char-count ${getCharCountClass(state.frameworkDescription.length, CHAR_LIMITS.frameworkDescription)}">
            ${state.frameworkDescription.length}/${CHAR_LIMITS.frameworkDescription}
          </span>
        </div>
        ${state.errors.frameworkDescription ? `<div class="form-error">${state.errors.frameworkDescription}</div>` : ''}
      </div>

      <!-- Key Terminology -->
      <div class="form-group">
        <label class="form-label">KEY TERMINOLOGY</label>
        <p class="form-subtitle">Course-specific terms to include in the tool</p>

        <div class="tag-input-container">
          <div class="tag-list" id="terminology-tags">
            ${state.keyTerminology.map((term, index) => `
              <span class="tag" data-index="${index}">
                ${escapeHtml(term)}
                <button type="button" class="tag__remove" data-index="${index}">×</button>
              </span>
            `).join('')}
          </div>
          <div class="tag-input-row">
            <input
              type="text"
              id="terminology-input"
              class="form-input tag-input"
              placeholder="Type a term and press Enter"
              maxlength="${CHAR_LIMITS.terminology}"
            />
            <button type="button" class="btn btn--secondary btn--small tag-add-btn" id="add-term-btn">
              ADD
            </button>
          </div>
        </div>
        <div class="form-hint">
          Examples: "Power of One", "7 Levers", "Value Ladder"
        </div>
      </div>

      <!-- Expert Quotes -->
      <div class="form-group">
        <label class="form-label">EXPERT QUOTES (Optional)</label>
        <p class="form-subtitle">Quotes to display in the results section</p>

        <div class="quotes-container" id="quotes-container">
          ${state.expertQuotes.map((quote, index) => `
            <div class="quote-item" data-index="${index}">
              <textarea
                class="form-textarea quote-textarea"
                rows="2"
                maxlength="${CHAR_LIMITS.quote}"
                placeholder="Enter a quote..."
                data-index="${index}"
              >${escapeHtml(quote)}</textarea>
              <button type="button" class="quote-remove-btn" data-index="${index}">×</button>
            </div>
          `).join('')}
        </div>

        ${state.expertQuotes.length < 3 ? `
          <button type="button" class="btn btn--secondary btn--small" id="add-quote-btn">
            + ADD QUOTE
          </button>
        ` : ''}
        <div class="form-hint">Maximum 3 quotes</div>
      </div>
    </div>
  `;

  // Attach listeners
  attachStepFrameworkListeners(container, state, updateState);
}

/**
 * Get character count class
 */
function getCharCountClass(current: number, max: number): string {
  const ratio = current / max;
  if (ratio >= 0.9) return 'char-count--error';
  if (ratio >= 0.75) return 'char-count--warning';
  return '';
}

/**
 * Attach event listeners
 */
function attachStepFrameworkListeners(
  container: HTMLElement,
  state: WizardState,
  updateState: (updates: Partial<WizardState>) => void
): void {
  // Framework description
  const frameworkDesc = container.querySelector<HTMLTextAreaElement>('#framework-desc');
  frameworkDesc?.addEventListener('input', () => {
    updateState({ frameworkDescription: frameworkDesc.value, errors: {} });
  });

  // Terminology input
  const termInput = container.querySelector<HTMLInputElement>('#terminology-input');
  const addTermBtn = container.querySelector<HTMLButtonElement>('#add-term-btn');

  const addTerm = () => {
    const term = termInput?.value.trim();
    if (term && !state.keyTerminology.includes(term)) {
      updateState({
        keyTerminology: [...state.keyTerminology, term],
        errors: {},
      });
    }
    if (termInput) termInput.value = '';
  };

  termInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTerm();
    }
  });

  addTermBtn?.addEventListener('click', addTerm);

  // Remove terminology tags
  const tagList = container.querySelector('#terminology-tags');
  tagList?.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('tag__remove')) {
      const index = parseInt(target.dataset.index || '0', 10);
      const newTerms = [...state.keyTerminology];
      newTerms.splice(index, 1);
      updateState({ keyTerminology: newTerms, errors: {} });
    }
  });

  // Add quote button
  const addQuoteBtn = container.querySelector<HTMLButtonElement>('#add-quote-btn');
  addQuoteBtn?.addEventListener('click', () => {
    if (state.expertQuotes.length < 3) {
      updateState({
        expertQuotes: [...state.expertQuotes, ''],
        errors: {},
      });
    }
  });

  // Quote textareas
  const quotesContainer = container.querySelector('#quotes-container');
  quotesContainer?.addEventListener('input', (e) => {
    const target = e.target as HTMLTextAreaElement;
    if (target.classList.contains('quote-textarea')) {
      const index = parseInt(target.dataset.index || '0', 10);
      const newQuotes = [...state.expertQuotes];
      newQuotes[index] = target.value;
      updateState({ expertQuotes: newQuotes, errors: {} });
    }
  });

  // Remove quote buttons
  quotesContainer?.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('quote-remove-btn')) {
      const index = parseInt(target.dataset.index || '0', 10);
      const newQuotes = [...state.expertQuotes];
      newQuotes.splice(index, 1);
      updateState({ expertQuotes: newQuotes, errors: {} });
    }
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
