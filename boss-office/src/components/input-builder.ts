// InputBuilder Component - Dynamic input field creator
// Feature: Boss Office Redesign

import type { InputFieldDefinition, InputFieldType } from '../types/index.ts';

// Input type options
export const INPUT_TYPE_OPTIONS: { value: InputFieldType; label: string; description: string }[] = [
  { value: 'number', label: 'Number', description: 'Whole numbers (e.g., quantity, count)' },
  { value: 'currency', label: 'Currency', description: 'Money values (e.g., price, revenue)' },
  { value: 'percentage', label: 'Percentage', description: 'Percentage values (0-100)' },
  { value: 'text', label: 'Text', description: 'Short text input' },
  { value: 'dropdown', label: 'Dropdown', description: 'Select from predefined options' },
  { value: 'slider', label: 'Slider', description: 'Numeric range with slider' },
];

interface InputBuilderProps {
  fields: InputFieldDefinition[];
  onAdd: () => void;
  onUpdate: (index: number, field: Partial<InputFieldDefinition>) => void;
  onDelete: (index: number) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
}

/**
 * Generate unique ID for new field
 */
export function generateFieldId(): string {
  return `field-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Create default field definition
 */
export function createDefaultField(): InputFieldDefinition {
  return {
    id: generateFieldId(),
    label: '',
    type: 'number',
    hint: '',
    required: true,
  };
}

/**
 * Render the input builder component
 */
export function renderInputBuilder(
  container: HTMLElement,
  props: InputBuilderProps
): void {
  const { fields } = props;

  container.innerHTML = `
    <div class="input-builder">
      <div class="input-builder__header">
        <h4 class="input-builder__title">INPUT FIELDS</h4>
        <span class="input-builder__count">${fields.length} FIELD${fields.length !== 1 ? 'S' : ''}</span>
      </div>

      ${fields.length === 0 ? `
        <div class="input-builder__empty">
          <p>No input fields defined yet.</p>
          <p>Click "ADD FIELD" to create the first input for your tool.</p>
        </div>
      ` : `
        <div class="input-builder__list">
          ${fields.map((field, index) => renderFieldCard(field, index, fields.length)).join('')}
        </div>
      `}

      <button type="button" class="btn btn--secondary input-builder__add" ${fields.length >= 10 ? 'disabled' : ''}>
        + ADD FIELD
      </button>
      ${fields.length >= 10 ? '<p class="input-builder__limit">Maximum 10 fields allowed</p>' : ''}

      <!-- Preview Section -->
      ${fields.length > 0 ? `
        <div class="input-builder__preview">
          <h5 class="input-builder__preview-title">PREVIEW</h5>
          <div class="input-builder__preview-content">
            ${fields.map((field) => renderFieldPreview(field)).join('')}
          </div>
        </div>
      ` : ''}
    </div>
  `;

  // Attach event listeners
  attachInputBuilderListeners(container, props);
}

/**
 * Render a single field card
 */
function renderFieldCard(field: InputFieldDefinition, index: number, total: number): string {
  const showDropdownOptions = field.type === 'dropdown';
  const showRangeFields = ['number', 'currency', 'percentage', 'slider'].includes(field.type);

  return `
    <div class="input-builder__card" data-index="${index}" data-field-id="${field.id}">
      <div class="input-builder__card-header">
        <span class="input-builder__card-number">${index + 1}</span>
        <div class="input-builder__card-actions">
          ${index > 0 ? `<button type="button" class="input-builder__move-btn" data-direction="up" title="Move up">↑</button>` : ''}
          ${index < total - 1 ? `<button type="button" class="input-builder__move-btn" data-direction="down" title="Move down">↓</button>` : ''}
          <button type="button" class="input-builder__delete-btn" title="Delete field">×</button>
        </div>
      </div>

      <div class="input-builder__card-body">
        <div class="form-row">
          <div class="form-group form-group--flex">
            <label class="form-label">LABEL *</label>
            <input
              type="text"
              class="form-input input-builder__label-input"
              value="${escapeHtml(field.label)}"
              placeholder="e.g., Monthly Revenue"
              maxlength="50"
            />
          </div>

          <div class="form-group">
            <label class="form-label">TYPE</label>
            <select class="form-select input-builder__type-select">
              ${INPUT_TYPE_OPTIONS.map((opt) => `
                <option value="${opt.value}" ${field.type === opt.value ? 'selected' : ''}>${opt.label}</option>
              `).join('')}
            </select>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">HINT TEXT</label>
          <input
            type="text"
            class="form-input input-builder__hint-input"
            value="${escapeHtml(field.hint)}"
            placeholder="e.g., Enter your average monthly revenue"
            maxlength="100"
          />
        </div>

        ${showRangeFields ? `
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">MIN VALUE</label>
              <input
                type="number"
                class="form-input input-builder__min-input"
                value="${field.minValue ?? ''}"
                placeholder="0"
              />
            </div>
            <div class="form-group">
              <label class="form-label">MAX VALUE</label>
              <input
                type="number"
                class="form-input input-builder__max-input"
                value="${field.maxValue ?? ''}"
                placeholder="1000000"
              />
            </div>
          </div>
        ` : ''}

        ${showDropdownOptions ? `
          <div class="form-group">
            <label class="form-label">OPTIONS (one per line)</label>
            <textarea
              class="form-textarea input-builder__options-textarea"
              rows="3"
              placeholder="Option 1&#10;Option 2&#10;Option 3"
            >${(field.options || []).join('\n')}</textarea>
          </div>
        ` : ''}

        <div class="form-group form-group--checkbox">
          <label class="checkbox-label">
            <input
              type="checkbox"
              class="input-builder__required-checkbox"
              ${field.required ? 'checked' : ''}
            />
            <span>Required field</span>
          </label>
        </div>
      </div>
    </div>
  `;
}

/**
 * Render field preview
 */
function renderFieldPreview(field: InputFieldDefinition): string {
  const requiredMark = field.required ? ' *' : '';

  switch (field.type) {
    case 'dropdown':
      return `
        <div class="preview-field">
          <label class="preview-field__label">${escapeHtml(field.label)}${requiredMark}</label>
          <select class="preview-field__select" disabled>
            <option>Select...</option>
            ${(field.options || []).map((opt) => `<option>${escapeHtml(opt)}</option>`).join('')}
          </select>
          ${field.hint ? `<span class="preview-field__hint">${escapeHtml(field.hint)}</span>` : ''}
        </div>
      `;

    case 'slider':
      return `
        <div class="preview-field">
          <label class="preview-field__label">${escapeHtml(field.label)}${requiredMark}</label>
          <input type="range" class="preview-field__slider" min="${field.minValue || 0}" max="${field.maxValue || 100}" disabled />
          ${field.hint ? `<span class="preview-field__hint">${escapeHtml(field.hint)}</span>` : ''}
        </div>
      `;

    case 'currency':
      return `
        <div class="preview-field">
          <label class="preview-field__label">${escapeHtml(field.label)}${requiredMark}</label>
          <div class="preview-field__currency">
            <span class="preview-field__currency-symbol">$</span>
            <input type="text" class="preview-field__input" placeholder="0.00" disabled />
          </div>
          ${field.hint ? `<span class="preview-field__hint">${escapeHtml(field.hint)}</span>` : ''}
        </div>
      `;

    case 'percentage':
      return `
        <div class="preview-field">
          <label class="preview-field__label">${escapeHtml(field.label)}${requiredMark}</label>
          <div class="preview-field__percentage">
            <input type="text" class="preview-field__input" placeholder="0" disabled />
            <span class="preview-field__percentage-symbol">%</span>
          </div>
          ${field.hint ? `<span class="preview-field__hint">${escapeHtml(field.hint)}</span>` : ''}
        </div>
      `;

    default:
      return `
        <div class="preview-field">
          <label class="preview-field__label">${escapeHtml(field.label)}${requiredMark}</label>
          <input type="${field.type === 'number' ? 'number' : 'text'}" class="preview-field__input" placeholder="${escapeHtml(field.hint || '')}" disabled />
          ${field.hint ? `<span class="preview-field__hint">${escapeHtml(field.hint)}</span>` : ''}
        </div>
      `;
  }
}

/**
 * Attach event listeners
 */
function attachInputBuilderListeners(container: HTMLElement, props: InputBuilderProps): void {
  const { onAdd, onUpdate, onDelete, onReorder } = props;

  // Add button
  const addBtn = container.querySelector<HTMLButtonElement>('.input-builder__add');
  addBtn?.addEventListener('click', onAdd);

  // Card event delegation
  const list = container.querySelector('.input-builder__list');
  if (!list) return;

  list.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const card = target.closest<HTMLElement>('.input-builder__card');
    if (!card) return;

    const index = parseInt(card.dataset.index || '0', 10);

    // Delete button
    if (target.classList.contains('input-builder__delete-btn')) {
      onDelete(index);
      return;
    }

    // Move buttons
    if (target.classList.contains('input-builder__move-btn')) {
      const direction = target.dataset.direction;
      if (direction === 'up' && index > 0) {
        onReorder(index, index - 1);
      } else if (direction === 'down') {
        onReorder(index, index + 1);
      }
      return;
    }
  });

  // Input change delegation
  list.addEventListener('input', (e) => {
    const target = e.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
    const card = target.closest<HTMLElement>('.input-builder__card');
    if (!card) return;

    const index = parseInt(card.dataset.index || '0', 10);

    if (target.classList.contains('input-builder__label-input')) {
      onUpdate(index, { label: target.value });
    } else if (target.classList.contains('input-builder__hint-input')) {
      onUpdate(index, { hint: target.value });
    } else if (target.classList.contains('input-builder__min-input')) {
      onUpdate(index, { minValue: target.value ? parseFloat(target.value) : undefined });
    } else if (target.classList.contains('input-builder__max-input')) {
      onUpdate(index, { maxValue: target.value ? parseFloat(target.value) : undefined });
    } else if (target.classList.contains('input-builder__options-textarea')) {
      const options = (target as HTMLTextAreaElement).value.split('\n').filter((o) => o.trim());
      onUpdate(index, { options });
    }
  });

  // Select change delegation
  list.addEventListener('change', (e) => {
    const target = e.target as HTMLSelectElement | HTMLInputElement;
    const card = target.closest<HTMLElement>('.input-builder__card');
    if (!card) return;

    const index = parseInt(card.dataset.index || '0', 10);

    if (target.classList.contains('input-builder__type-select')) {
      onUpdate(index, { type: target.value as InputFieldType });
    } else if (target.classList.contains('input-builder__required-checkbox')) {
      onUpdate(index, { required: (target as HTMLInputElement).checked });
    }
  });
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
