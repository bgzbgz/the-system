// Step 1: Identity & Context
// Feature: Boss Office Redesign

import type { WizardState, Category, FileUpload } from '../../types/index.ts';
import { SPRINTS } from '../../types/index.ts';
import { extractText } from '../../utils/file-parser.ts';

// Re-render callback - set by parent wizard
let reRenderCallback: ((updates: Partial<WizardState>) => void) | null = null;

export function setReRenderCallback(cb: (updates: Partial<WizardState>) => void): void {
  reRenderCallback = cb;
}

// Category options
const CATEGORY_OPTIONS: { value: Category; label: string }[] = [
  { value: 'B2B_PRODUCT', label: 'B2B Product' },
  { value: 'B2B_SERVICE', label: 'B2B Service' },
  { value: 'B2C_PRODUCT', label: 'B2C Product' },
  { value: 'B2C_SERVICE', label: 'B2C Service' },
];

/**
 * Render Step 1: Identity & Context
 */
export function renderStepIdentity(
  container: HTMLElement,
  state: WizardState,
  updateState: (updates: Partial<WizardState>) => void
): void {
  container.innerHTML = `
    <div class="wizard-step wizard-step--identity">
      <p class="wizard-step__intro">
        Start by defining your tool's identity and uploading the source content.
      </p>

      <!-- Tool Name -->
      <div class="form-group ${state.errors.toolName ? 'form-group--error' : ''}">
        <label class="form-label" for="tool-name">TOOL NAME *</label>
        <input
          type="text"
          id="tool-name"
          class="form-input"
          value="${escapeHtml(state.toolName)}"
          placeholder="e.g., Value Proposition Calculator"
          maxlength="80"
        />
        <div class="form-hint">Clear, action-oriented name (max 80 chars)</div>
        ${state.errors.toolName ? `<div class="form-error">${state.errors.toolName}</div>` : ''}
      </div>

      <!-- Sprint/Module -->
      <div class="form-group ${state.errors.sprintId ? 'form-group--error' : ''}">
        <label class="form-label" for="sprint-select">SPRINT / MODULE *</label>
        <select id="sprint-select" class="form-select">
          <option value="">Select a sprint...</option>
          ${SPRINTS.map((sprint) => `
            <option value="${sprint.id}" ${state.sprintId === sprint.id ? 'selected' : ''}>
              ${sprint.name}
            </option>
          `).join('')}
        </select>
        <div class="form-hint">Which course module is this tool for?</div>
        ${state.errors.sprintId ? `<div class="form-error">${state.errors.sprintId}</div>` : ''}
      </div>

      <!-- Category -->
      <div class="form-group">
        <label class="form-label">CATEGORY *</label>
        <div class="radio-group">
          ${CATEGORY_OPTIONS.map((opt) => `
            <label class="radio-option">
              <input
                type="radio"
                name="category"
                value="${opt.value}"
                ${state.category === opt.value ? 'checked' : ''}
              />
              <span>${opt.label}</span>
            </label>
          `).join('')}
        </div>
      </div>

      <!-- File Upload -->
      <div class="form-group ${state.errors.fileUpload ? 'form-group--error' : ''}">
        <label class="form-label">SOURCE CONTENT *</label>
        <div class="file-upload-zone ${state.fileUpload ? 'file-upload-zone--has-file' : ''}" id="file-drop-zone">
          ${state.fileUpload ? renderFileStatus(state.fileUpload) : `
            <div class="file-upload-zone__content">
              <div class="file-upload-zone__icon">📄</div>
              <p class="file-upload-zone__text">Drag & drop or click to upload</p>
              <p class="file-upload-zone__formats">PDF, DOCX, MD, TXT</p>
            </div>
          `}
          <input type="file" id="file-input" class="file-upload-zone__input" accept=".pdf,.docx,.md,.txt" />
        </div>
        ${state.errors.fileUpload ? `<div class="form-error">${state.errors.fileUpload}</div>` : ''}
      </div>
    </div>
  `;

  // Attach listeners
  attachStepIdentityListeners(container, state, updateState);
}

/**
 * Render file status
 */
function renderFileStatus(file: FileUpload): string {
  const statusIcons: Record<string, string> = {
    pending: '⏳',
    extracting: '⚙️',
    ready: '✓',
    error: '✗',
  };

  const statusClasses: Record<string, string> = {
    pending: 'file-status--pending',
    extracting: 'file-status--extracting',
    ready: 'file-status--ready',
    error: 'file-status--error',
  };

  return `
    <div class="file-status ${statusClasses[file.status] || ''}">
      <span class="file-status__icon">${statusIcons[file.status]}</span>
      <div class="file-status__info">
        <span class="file-status__name">${escapeHtml(file.name)}</span>
        <span class="file-status__size">${formatFileSize(file.size)}</span>
      </div>
      ${file.status === 'ready' ? `
        <button type="button" class="file-status__remove" title="Remove file">×</button>
      ` : ''}
      ${file.status === 'extracting' ? `
        <div class="file-status__spinner"></div>
      ` : ''}
      ${file.error ? `
        <span class="file-status__error">${escapeHtml(file.error)}</span>
      ` : ''}
    </div>
  `;
}

/**
 * Format file size
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Attach event listeners
 */
function attachStepIdentityListeners(
  container: HTMLElement,
  _state: WizardState,
  updateState: (updates: Partial<WizardState>) => void
): void {
  // Tool name
  const toolNameInput = container.querySelector<HTMLInputElement>('#tool-name');
  toolNameInput?.addEventListener('input', () => {
    updateState({ toolName: toolNameInput.value, errors: {} });
  });

  // Sprint select
  const sprintSelect = container.querySelector<HTMLSelectElement>('#sprint-select');
  sprintSelect?.addEventListener('change', () => {
    updateState({ sprintId: sprintSelect.value, errors: {} });
  });

  // Category radios
  const categoryRadios = container.querySelectorAll<HTMLInputElement>('input[name="category"]');
  categoryRadios.forEach((radio) => {
    radio.addEventListener('change', () => {
      updateState({ category: radio.value as Category, errors: {} });
    });
  });

  // File upload
  const dropZone = container.querySelector<HTMLElement>('#file-drop-zone');
  const fileInput = container.querySelector<HTMLInputElement>('#file-input');

  if (dropZone && fileInput) {
    // Click to upload
    dropZone.addEventListener('click', (e) => {
      if (!(e.target as HTMLElement).closest('.file-status__remove')) {
        fileInput.click();
      }
    });

    // File selected
    fileInput.addEventListener('change', () => {
      const file = fileInput.files?.[0];
      if (file) {
        handleFileUpload(file, updateState);
      }
    });

    // Drag and drop
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('file-upload-zone--dragover');
    });

    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('file-upload-zone--dragover');
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('file-upload-zone--dragover');
      const file = e.dataTransfer?.files?.[0];
      if (file) {
        handleFileUpload(file, updateState);
      }
    });

    // Remove file button - needs to re-render to show upload zone
    const removeBtn = container.querySelector<HTMLButtonElement>('.file-status__remove');
    removeBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (reRenderCallback) {
        reRenderCallback({ fileUpload: null, errors: {} });
      }
    });
  }
}

/**
 * Handle file upload - uses reRenderCallback to show progress
 */
async function handleFileUpload(
  file: File,
  _updateState: (updates: Partial<WizardState>) => void
): Promise<void> {
  // Validate file type
  const validTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/markdown', 'text/plain'];
  const validExtensions = ['.pdf', '.docx', '.md', '.txt'];
  const fileExt = '.' + file.name.split('.').pop()?.toLowerCase();

  const updateAndRender = (updates: Partial<WizardState>) => {
    if (reRenderCallback) {
      reRenderCallback(updates);
    }
  };

  if (!validTypes.includes(file.type) && !validExtensions.includes(fileExt)) {
    updateAndRender({
      fileUpload: {
        file,
        name: file.name,
        size: file.size,
        type: 'txt',
        extractedText: null,
        status: 'error',
        error: 'Invalid file type. Please upload PDF, DOCX, MD, or TXT.',
      },
      errors: {},
    });
    return;
  }

  // Set extracting status
  const fileType = fileExt.replace('.', '') as 'pdf' | 'docx' | 'md' | 'txt';
  updateAndRender({
    fileUpload: {
      file,
      name: file.name,
      size: file.size,
      type: fileType,
      extractedText: null,
      status: 'extracting',
      error: null,
    },
    errors: {},
  });

  try {
    const extractedText = await extractText(file);
    updateAndRender({
      fileUpload: {
        file,
        name: file.name,
        size: file.size,
        type: fileType,
        extractedText,
        status: 'ready',
        error: null,
      },
      errors: {},
    });
  } catch (error) {
    updateAndRender({
      fileUpload: {
        file,
        name: file.name,
        size: file.size,
        type: fileType,
        extractedText: null,
        status: 'error',
        error: error instanceof Error ? error.message : 'Failed to extract text',
      },
      errors: {},
    });
  }
}

/**
 * Escape HTML
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
