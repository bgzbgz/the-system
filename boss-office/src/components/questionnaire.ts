import { store, setQuestionnaireField } from '../store/actions.ts';
import {
  CHAR_LIMITS,
  validateQuestionnaire,
  formatCharCount,
  getCharCountStatus,
} from '../utils/validators.ts';
import type { Category, Questionnaire } from '../types/index.ts';

// Category options for Q1
const CATEGORY_OPTIONS: { value: Category; label: string }[] = [
  { value: 'B2B_PRODUCT', label: 'B2B Product' },
  { value: 'B2B_SERVICE', label: 'B2B Service' },
  { value: 'B2C_PRODUCT', label: 'B2C Product' },
  { value: 'B2C_SERVICE', label: 'B2C Service' },
];

// Render the questionnaire component
export function renderQuestionnaire(container: HTMLElement): void {
  const { questionnaire } = store.getState();
  const validation = validateQuestionnaire(questionnaire);

  container.innerHTML = `
    <div class="card">
      <h3 class="card__title">SPECIFICATION QUESTIONS</h3>

      <!-- Q1: Category -->
      <div class="form-group">
        <label class="form-label">Q1. WHAT TYPE OF TOOL IS THIS?</label>
        <div class="radio-group">
          ${CATEGORY_OPTIONS.map(
            (opt) => `
            <label class="radio-option">
              <input
                type="radio"
                name="category"
                value="${opt.value}"
                ${questionnaire.category === opt.value ? 'checked' : ''}
              />
              <span>${opt.label}</span>
            </label>
          `
          ).join('')}
        </div>
        ${
          !validation.category.valid && questionnaire.category !== undefined
            ? `<div class="form-error">${validation.category.error}</div>`
            : ''
        }
      </div>

      <!-- Q2: Decision -->
      <div class="form-group">
        <label class="form-label" for="decision">
          Q2. WHAT DECISION SHOULD USERS MAKE?
        </label>
        <textarea
          id="decision"
          class="form-textarea ${!validation.decision.valid && questionnaire.decision !== undefined ? 'form-textarea--error' : ''}"
          placeholder="Describe the specific decision this tool helps users make..."
          maxlength="${CHAR_LIMITS.decision}"
        >${escapeHtml(questionnaire.decision || '')}</textarea>
        <div class="form-hint">
          <span class="char-count ${getCharCountClass(questionnaire.decision?.length || 0, CHAR_LIMITS.decision)}">
            ${formatCharCount(questionnaire.decision?.length || 0, CHAR_LIMITS.decision)}
          </span>
        </div>
        ${
          !validation.decision.valid && questionnaire.decision !== undefined
            ? `<div class="form-error">${validation.decision.error}</div>`
            : ''
        }
      </div>

      <!-- Q3: Teaching Point -->
      <div class="form-group">
        <label class="form-label" for="teachingPoint">
          Q3. WHAT KNOWLEDGE SHOULD THIS TOOL HELP APPLY?
        </label>
        <textarea
          id="teachingPoint"
          class="form-textarea ${!validation.teachingPoint.valid && questionnaire.teachingPoint !== undefined ? 'form-textarea--error' : ''}"
          placeholder="Describe the teaching point or knowledge from the course..."
          maxlength="${CHAR_LIMITS.teachingPoint}"
        >${escapeHtml(questionnaire.teachingPoint || '')}</textarea>
        <div class="form-hint">
          <span class="char-count ${getCharCountClass(questionnaire.teachingPoint?.length || 0, CHAR_LIMITS.teachingPoint)}">
            ${formatCharCount(questionnaire.teachingPoint?.length || 0, CHAR_LIMITS.teachingPoint)}
          </span>
        </div>
        ${
          !validation.teachingPoint.valid && questionnaire.teachingPoint !== undefined
            ? `<div class="form-error">${validation.teachingPoint.error}</div>`
            : ''
        }
      </div>

      <!-- Q4: Inputs -->
      <div class="form-group">
        <label class="form-label" for="inputs">
          Q4. WHAT INFORMATION SHOULD USERS PROVIDE?
        </label>
        <textarea
          id="inputs"
          class="form-textarea ${!validation.inputs.valid && questionnaire.inputs !== undefined ? 'form-textarea--error' : ''}"
          placeholder="List the inputs users need to provide to the tool..."
          maxlength="${CHAR_LIMITS.inputs}"
        >${escapeHtml(questionnaire.inputs || '')}</textarea>
        <div class="form-hint">
          <span class="char-count ${getCharCountClass(questionnaire.inputs?.length || 0, CHAR_LIMITS.inputs)}">
            ${formatCharCount(questionnaire.inputs?.length || 0, CHAR_LIMITS.inputs)}
          </span>
        </div>
        ${
          !validation.inputs.valid && questionnaire.inputs !== undefined
            ? `<div class="form-error">${validation.inputs.error}</div>`
            : ''
        }
      </div>

      <!-- Q5: Verdict Criteria -->
      <div class="form-group">
        <label class="form-label" for="verdictCriteria">
          Q5. HOW SHOULD THE TOOL CALCULATE GO/NO-GO?
        </label>
        <textarea
          id="verdictCriteria"
          class="form-textarea ${!validation.verdictCriteria.valid && questionnaire.verdictCriteria !== undefined ? 'form-textarea--error' : ''}"
          placeholder="Describe how the tool should determine the verdict..."
          maxlength="${CHAR_LIMITS.verdictCriteria}"
        >${escapeHtml(questionnaire.verdictCriteria || '')}</textarea>
        <div class="form-hint">
          <span class="char-count ${getCharCountClass(questionnaire.verdictCriteria?.length || 0, CHAR_LIMITS.verdictCriteria)}">
            ${formatCharCount(questionnaire.verdictCriteria?.length || 0, CHAR_LIMITS.verdictCriteria)}
          </span>
        </div>
        ${
          !validation.verdictCriteria.valid && questionnaire.verdictCriteria !== undefined
            ? `<div class="form-error">${validation.verdictCriteria.error}</div>`
            : ''
        }
      </div>
    </div>
  `;

  // Attach event listeners
  attachQuestionnaireListeners(container);
}

// Get CSS class for character count
function getCharCountClass(current: number, max: number): string {
  const status = getCharCountStatus(current, max);
  switch (status) {
    case 'warning':
      return 'char-count--warning';
    case 'error':
      return 'char-count--error';
    default:
      return '';
  }
}

// Attach event listeners for form inputs
function attachQuestionnaireListeners(container: HTMLElement): void {
  // Category radio buttons
  const radios = container.querySelectorAll<HTMLInputElement>('input[name="category"]');
  radios.forEach((radio) => {
    radio.addEventListener('change', () => {
      setQuestionnaireField('category', radio.value as Category);
    });
  });

  // Text areas
  const textareas: Array<{ id: string; field: keyof Questionnaire }> = [
    { id: 'decision', field: 'decision' },
    { id: 'teachingPoint', field: 'teachingPoint' },
    { id: 'inputs', field: 'inputs' },
    { id: 'verdictCriteria', field: 'verdictCriteria' },
  ];

  textareas.forEach(({ id, field }) => {
    const textarea = container.querySelector<HTMLTextAreaElement>(`#${id}`);
    if (textarea) {
      // Update on input for real-time character count
      textarea.addEventListener('input', () => {
        setQuestionnaireField(field, textarea.value);
        updateCharCount(container, id, textarea.value.length);
      });

      // Validate on blur
      textarea.addEventListener('blur', () => {
        renderQuestionnaire(container);
      });
    }
  });
}

// Update character count display without full re-render
function updateCharCount(container: HTMLElement, fieldId: string, currentLength: number): void {
  const field = fieldId as keyof typeof CHAR_LIMITS;
  const maxLength = CHAR_LIMITS[field];
  if (!maxLength) return;

  const textarea = container.querySelector<HTMLTextAreaElement>(`#${fieldId}`);
  const formGroup = textarea?.closest('.form-group');
  const charCount = formGroup?.querySelector('.char-count');

  if (charCount) {
    charCount.textContent = formatCharCount(currentLength, maxLength);
    charCount.className = `char-count ${getCharCountClass(currentLength, maxLength)}`;
  }
}

// Subscribe to state changes for re-render
export function subscribeQuestionnaire(container: HTMLElement): () => void {
  return store.subscribe((state, prevState) => {
    // Only re-render on significant changes, not every keystroke
    if (
      state.questionnaire.category !== prevState.questionnaire.category
    ) {
      renderQuestionnaire(container);
    }
  });
}

// Escape HTML to prevent XSS
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
