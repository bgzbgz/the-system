import {
  store,
  setFileUpload,
  updateFileUploadStatus,
  showError,
} from '../store/actions.ts';
import { validateFile, FILE_LIMITS } from '../utils/validators.ts';
import { extractText, formatFileSize, detectFileType } from '../utils/file-parser.ts';
import type { FileUpload, FileType } from '../types/index.ts';

// Render the file upload component
export function renderFileUpload(container: HTMLElement): void {
  const { fileUpload } = store.getState();

  container.innerHTML = `
    <div class="card">
      <h3 class="card__title">SOURCE DOCUMENT</h3>
      <div
        id="upload-zone"
        class="upload-zone ${getZoneClass(fileUpload)}"
        tabindex="0"
        role="button"
        aria-label="Upload file"
      >
        ${renderZoneContent(fileUpload)}
      </div>
      <input
        type="file"
        id="file-input"
        class="hidden"
        accept="${FILE_LIMITS.allowedExtensions.join(',')}"
      />
    </div>
  `;

  // Attach event listeners
  attachFileUploadListeners(container);
}

// Get zone CSS class based on state
function getZoneClass(fileUpload: FileUpload | null): string {
  if (!fileUpload) return '';
  switch (fileUpload.status) {
    case 'ready':
      return 'upload-zone--ready';
    case 'extracting':
      return 'upload-zone--active';
    case 'error':
      return 'upload-zone--error';
    default:
      return '';
  }
}

// Render zone content based on state
function renderZoneContent(fileUpload: FileUpload | null): string {
  if (!fileUpload) {
    return `
      <div class="upload-zone__icon">&#128194;</div>
      <div class="upload-zone__title">DROP FILE HERE OR CLICK TO BROWSE</div>
      <div class="upload-zone__hint">PDF, DOCX, MD, TXT (MAX 10MB)</div>
    `;
  }

  switch (fileUpload.status) {
    case 'pending':
    case 'extracting':
      return `
        <div class="upload-zone__icon">
          <div class="spinner"></div>
        </div>
        <div class="upload-zone__title">EXTRACTING TEXT...</div>
        <div class="upload-zone__file">
          <div class="upload-zone__filename">${escapeHtml(fileUpload.name)}</div>
          <div class="upload-zone__filesize">${formatFileSize(fileUpload.size)}</div>
        </div>
      `;

    case 'ready':
      return `
        <div class="upload-zone__icon">&#10003;</div>
        <div class="upload-zone__title">FILE READY</div>
        <div class="upload-zone__file">
          <div class="upload-zone__filename">${escapeHtml(fileUpload.name)}</div>
          <div class="upload-zone__filesize">${formatFileSize(fileUpload.size)}</div>
        </div>
        <div class="upload-zone__hint">CLICK TO REPLACE</div>
      `;

    case 'error':
      return `
        <div class="upload-zone__icon">&#10007;</div>
        <div class="upload-zone__title">EXTRACTION FAILED</div>
        <div class="upload-zone__file">
          <div class="upload-zone__filename">${escapeHtml(fileUpload.error || 'Unknown error')}</div>
        </div>
        <div class="upload-zone__hint">CLICK TO TRY AGAIN</div>
      `;

    default:
      return '';
  }
}

// Attach event listeners for drag/drop and click
function attachFileUploadListeners(container: HTMLElement): void {
  const zone = container.querySelector<HTMLElement>('#upload-zone');
  const input = container.querySelector<HTMLInputElement>('#file-input');

  if (!zone || !input) return;

  // Click to open file browser
  zone.addEventListener('click', () => input.click());

  // Keyboard accessibility
  zone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      input.click();
    }
  });

  // File input change
  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (file) {
      handleFileSelected(file, container);
    }
    // Reset input so same file can be selected again
    input.value = '';
  });

  // Drag events
  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('upload-zone--active');
  });

  zone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    zone.classList.remove('upload-zone--active');
  });

  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('upload-zone--active');

    const file = e.dataTransfer?.files?.[0];
    if (file) {
      handleFileSelected(file, container);
    }
  });
}

// Handle file selection
async function handleFileSelected(file: File, container: HTMLElement): Promise<void> {
  // Validate file
  const validation = validateFile(file);
  if (!validation.valid) {
    showError(validation.error || 'Invalid file');
    return;
  }

  // Detect file type
  const fileType = detectFileType(file.name);
  if (!fileType) {
    showError('Unsupported file type');
    return;
  }

  // Create file upload state
  const fileUpload: FileUpload = {
    file,
    name: file.name,
    size: file.size,
    type: fileType as FileType,
    extractedText: null,
    status: 'extracting',
    error: null,
  };

  setFileUpload(fileUpload);
  renderFileUpload(container);

  // Extract text
  try {
    const extractedText = await extractText(file);

    if (!extractedText || extractedText.trim().length === 0) {
      throw new Error('No text content found in file');
    }

    updateFileUploadStatus('ready', extractedText);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to extract text';
    updateFileUploadStatus('error', undefined, message);
    showError(message);
  }

  // Re-render with updated state
  renderFileUpload(container);
}

// Subscribe to state changes for re-render
export function subscribeFileUpload(container: HTMLElement): () => void {
  return store.subscribe((state, prevState) => {
    if (state.fileUpload !== prevState.fileUpload) {
      renderFileUpload(container);
    }
  });
}

// Escape HTML to prevent XSS
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
