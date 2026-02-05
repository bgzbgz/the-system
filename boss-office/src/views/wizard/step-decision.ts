// Step 4: Decision Logic
// Feature: Boss Office Redesign

import type { WizardState } from '../../types/index.ts';

const CHAR_LIMITS = {
  decisionQuestion: 200,
  verdictCriteria: 500,
};

/**
 * Render Step 4: Decision Logic
 */
export function renderStepDecision(
  container: HTMLElement,
  state: WizardState,
  updateState: (updates: Partial<WizardState>) => void
): void {
  container.innerHTML = `
    <div class="wizard-step wizard-step--decision">
      <p class="wizard-step__intro">
        Define the decision this tool helps users make and how the GO/NO-GO verdict should be calculated.
      </p>

      <!-- Decision Question -->
      <div class="form-group ${state.errors.decisionQuestion ? 'form-group--error' : ''}">
        <label class="form-label" for="decision-question">DECISION QUESTION *</label>
        <textarea
          id="decision-question"
          class="form-textarea"
          rows="2"
          maxlength="${CHAR_LIMITS.decisionQuestion}"
          placeholder="What specific decision should users make? e.g., 'Should I raise my prices?'"
        >${escapeHtml(state.decisionQuestion)}</textarea>
        <div class="form-hint">
          <span class="char-count ${getCharCountClass(state.decisionQuestion.length, CHAR_LIMITS.decisionQuestion)}">
            ${state.decisionQuestion.length}/${CHAR_LIMITS.decisionQuestion}
          </span>
          <span>The question this tool answers</span>
        </div>
        ${state.errors.decisionQuestion ? `<div class="form-error">${state.errors.decisionQuestion}</div>` : ''}
      </div>

      <!-- Verdict Criteria -->
      <div class="form-group ${state.errors.verdictCriteria ? 'form-group--error' : ''}">
        <label class="form-label" for="verdict-criteria">VERDICT CRITERIA *</label>
        <textarea
          id="verdict-criteria"
          class="form-textarea"
          rows="6"
          maxlength="${CHAR_LIMITS.verdictCriteria}"
          placeholder="Describe how the tool should calculate GO vs NO-GO. What conditions lead to each verdict? Include specific thresholds if applicable."
        >${escapeHtml(state.verdictCriteria)}</textarea>
        <div class="form-hint">
          <span class="char-count ${getCharCountClass(state.verdictCriteria.length, CHAR_LIMITS.verdictCriteria)}">
            ${state.verdictCriteria.length}/${CHAR_LIMITS.verdictCriteria}
          </span>
        </div>
        ${state.errors.verdictCriteria ? `<div class="form-error">${state.errors.verdictCriteria}</div>` : ''}
      </div>

      <!-- Example Verdicts -->
      <div class="verdict-examples">
        <h4 class="verdict-examples__title">EXAMPLE VERDICT TYPES</h4>
        <div class="verdict-examples__grid">
          <div class="verdict-example verdict-example--go">
            <span class="verdict-example__badge">GO</span>
            <p class="verdict-example__desc">Conditions are favorable, proceed with confidence</p>
          </div>
          <div class="verdict-example verdict-example--conditional">
            <span class="verdict-example__badge">CONDITIONAL</span>
            <p class="verdict-example__desc">Proceed with specific modifications or considerations</p>
          </div>
          <div class="verdict-example verdict-example--nogo">
            <span class="verdict-example__badge">NO-GO</span>
            <p class="verdict-example__desc">Conditions are unfavorable, do not proceed</p>
          </div>
        </div>
      </div>

      <!-- Tips -->
      <div class="wizard-step__tips">
        <h4 class="wizard-step__tips-title">TIPS FOR GOOD VERDICT CRITERIA</h4>
        <ul class="wizard-step__tips-list">
          <li>Include specific numeric thresholds when possible (e.g., "GO if margin > 30%")</li>
          <li>Consider edge cases and conditional scenarios</li>
          <li>Reference the input fields you defined in Step 3</li>
          <li>Think about what would make a decision "conditional" vs clear GO/NO-GO</li>
        </ul>
      </div>
    </div>
  `;

  // Attach listeners
  attachStepDecisionListeners(container, state, updateState);
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
function attachStepDecisionListeners(
  container: HTMLElement,
  _state: WizardState,
  updateState: (updates: Partial<WizardState>) => void
): void {
  // Decision question
  const decisionInput = container.querySelector<HTMLTextAreaElement>('#decision-question');
  decisionInput?.addEventListener('input', () => {
    updateState({ decisionQuestion: decisionInput.value, errors: {} });
  });

  // Verdict criteria
  const verdictInput = container.querySelector<HTMLTextAreaElement>('#verdict-criteria');
  verdictInput?.addEventListener('input', () => {
    updateState({ verdictCriteria: verdictInput.value, errors: {} });
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
