/**
 * AI-First Tool Creation View
 *
 * New flow:
 * 1. Select template (category)
 * 2. Upload document
 * 3. AI analyzes and extracts understanding
 * 4. User confirms or edits AI's understanding
 * 5. Submit to factory
 */

import { navigate } from '../utils/router.ts';
import { showSuccess, showError, addToast } from '../store/actions.ts';
import {
  getTemplates,
  analyzeContent,
  createJobFromAnalysis,
  type Template,
  type ContentAnalysisResult,
  type AnalysisEdits,
} from '../api/jobs.ts';
import { extractText } from '../utils/file-parser.ts';

// ========== STATE ==========

type CreateFlowStep = 'template' | 'upload' | 'analyzing' | 'confirm' | 'submitting';

interface CreateFlowState {
  step: CreateFlowStep;
  selectedTemplate: Template | null;
  fileName: string;
  fileContent: string;
  analysis: ContentAnalysisResult | null;
  edits: AnalysisEdits;
  error: string | null;
}

let state: CreateFlowState = {
  step: 'template',
  selectedTemplate: null,
  fileName: '',
  fileContent: '',
  analysis: null,
  edits: {},
  error: null,
};

let currentContainer: HTMLElement | null = null;
let templates: Template[] = [];

// ========== HELPERS ==========

function resetState(): void {
  state = {
    step: 'template',
    selectedTemplate: null,
    fileName: '',
    fileContent: '',
    analysis: null,
    edits: {},
    error: null,
  };
}

// ========== RENDER FUNCTIONS ==========

function renderTemplateStep(container: HTMLElement): void {
  container.innerHTML = `
    <div class="create-tool__templates">
      <h2 class="create-tool__step-title">STEP 1: SELECT TOOL TYPE</h2>
      <p class="create-tool__step-description">
        Choose the category that best matches your course content and target audience.
      </p>

      <div class="template-grid">
        ${templates.map(template => `
          <div class="template-card" data-template-id="${template.id}">
            <div class="template-card__header">
              <h3 class="template-card__name">${template.name}</h3>
            </div>
            <div class="template-card__body">
              <p class="template-card__description">${template.description}</p>
              <div class="template-card__examples">
                <span class="template-card__examples-label">EXAMPLES:</span>
                ${template.examples.map(ex => `<span class="template-card__example">${ex}</span>`).join('')}
              </div>
              <div class="template-card__ideal-for">
                <span class="template-card__ideal-label">IDEAL FOR:</span>
                <span>${template.ideal_for}</span>
              </div>
            </div>
            <button type="button" class="btn btn--primary template-card__select-btn">
              SELECT ${template.name.toUpperCase()}
            </button>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  // Attach template selection listeners
  container.querySelectorAll('.template-card').forEach(card => {
    const btn = card.querySelector('.template-card__select-btn');
    btn?.addEventListener('click', () => {
      const templateId = card.getAttribute('data-template-id');
      const template = templates.find(t => t.id === templateId);
      if (template) {
        state.selectedTemplate = template;
        state.step = 'upload';
        render();
      }
    });
  });
}

function renderUploadStep(container: HTMLElement): void {
  container.innerHTML = `
    <div class="create-tool__upload">
      <h2 class="create-tool__step-title">STEP 2: UPLOAD SOURCE CONTENT</h2>
      <p class="create-tool__step-description">
        Upload your course document. Our AI will analyze it and extract the key insights
        needed to build your tool.
      </p>

      <div class="selected-template-badge">
        <span class="selected-template-badge__label">SELECTED TYPE:</span>
        <span class="selected-template-badge__name">${state.selectedTemplate?.name || ''}</span>
        <button type="button" class="btn btn--text selected-template-badge__change">CHANGE</button>
      </div>

      <div class="upload-zone" id="upload-zone">
        <div class="upload-zone__icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="17 8 12 3 7 8"></polyline>
            <line x1="12" y1="3" x2="12" y2="15"></line>
          </svg>
        </div>
        <p class="upload-zone__text">Drag & drop your file here</p>
        <p class="upload-zone__subtext">or click to browse</p>
        <p class="upload-zone__formats">Supported: PDF, DOCX, TXT, MD (max 10MB)</p>
        <input type="file" id="file-input" class="upload-zone__input" accept=".pdf,.docx,.txt,.md" />
      </div>

      ${state.fileName ? `
        <div class="upload-preview">
          <div class="upload-preview__file">
            <span class="upload-preview__icon">📄</span>
            <span class="upload-preview__name">${state.fileName}</span>
            <span class="upload-preview__size">${Math.round(state.fileContent.length / 1024)} KB extracted</span>
            <button type="button" class="btn btn--text upload-preview__remove">REMOVE</button>
          </div>
        </div>

        <div class="upload-actions">
          <button type="button" class="btn btn--secondary upload-actions__back">← BACK</button>
          <button type="button" class="btn btn--primary upload-actions__analyze">
            ANALYZE CONTENT →
          </button>
        </div>
      ` : ''}

      ${state.error ? `
        <div class="create-tool__error">
          <span class="create-tool__error-icon">⚠</span>
          <span class="create-tool__error-text">${state.error}</span>
        </div>
      ` : ''}
    </div>
  `;

  // Change template button
  container.querySelector('.selected-template-badge__change')?.addEventListener('click', () => {
    state.step = 'template';
    state.error = null;
    render();
  });

  // File upload handling
  const uploadZone = container.querySelector('#upload-zone') as HTMLElement;
  const fileInput = container.querySelector('#file-input') as HTMLInputElement;

  uploadZone?.addEventListener('click', () => fileInput?.click());

  uploadZone?.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.classList.add('upload-zone--dragover');
  });

  uploadZone?.addEventListener('dragleave', () => {
    uploadZone.classList.remove('upload-zone--dragover');
  });

  uploadZone?.addEventListener('drop', async (e) => {
    e.preventDefault();
    uploadZone.classList.remove('upload-zone--dragover');
    const file = (e as DragEvent).dataTransfer?.files[0];
    if (file) await handleFileUpload(file);
  });

  fileInput?.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (file) await handleFileUpload(file);
  });

  // Remove file button
  container.querySelector('.upload-preview__remove')?.addEventListener('click', () => {
    state.fileName = '';
    state.fileContent = '';
    state.error = null;
    render();
  });

  // Back button
  container.querySelector('.upload-actions__back')?.addEventListener('click', () => {
    state.step = 'template';
    render();
  });

  // Analyze button
  container.querySelector('.upload-actions__analyze')?.addEventListener('click', async () => {
    await startAnalysis();
  });
}

async function handleFileUpload(file: File): Promise<void> {
  try {
    state.error = null;

    // Check file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      state.error = 'File too large. Maximum size is 10MB.';
      render();
      return;
    }

    // Check file type
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!extension || !['pdf', 'docx', 'txt', 'md'].includes(extension)) {
      state.error = 'Unsupported file type. Please use PDF, DOCX, TXT, or MD.';
      render();
      return;
    }

    addToast('info', 'Extracting text from file...', 3000);

    // Extract text (detectFileType is used internally by extractText)
    const extractedText = await extractText(file);

    if (!extractedText || extractedText.length < 100) {
      state.error = 'Could not extract enough text from file. Please try a different file.';
      render();
      return;
    }

    state.fileName = file.name;
    state.fileContent = extractedText;
    addToast('success', `Extracted ${Math.round(extractedText.length / 1024)} KB of text`, 3000);
    render();

  } catch (error) {
    console.error('File upload failed:', error);
    state.error = error instanceof Error ? error.message : 'Failed to process file';
    render();
  }
}

async function startAnalysis(): Promise<void> {
  if (!state.selectedTemplate || !state.fileContent) return;

  state.step = 'analyzing';
  state.error = null;
  render();

  try {
    const result = await analyzeContent(
      state.fileName,
      state.fileContent,
      state.selectedTemplate.id as 'B2B_PRODUCT' | 'B2B_SERVICE' | 'B2C_PRODUCT' | 'B2C_SERVICE'
    );

    state.analysis = result.analysis;
    state.step = 'confirm';
    addToast('success', `Analysis complete in ${Math.round((result.timing?.duration || 0) / 1000)}s`, 3000);
    render();

  } catch (error) {
    console.error('Analysis failed:', error);
    state.error = error instanceof Error ? error.message : 'Analysis failed';
    state.step = 'upload';
    render();
  }
}

function renderAnalyzingStep(container: HTMLElement): void {
  container.innerHTML = `
    <div class="create-tool__analyzing">
      <div class="analyzing-animation">
        <div class="analyzing-animation__spinner"></div>
        <h2 class="analyzing-animation__title">ANALYZING YOUR CONTENT</h2>
        <p class="analyzing-animation__text">
          Our AI is extracting the key insights, frameworks, and decision criteria
          from your document...
        </p>
        <div class="analyzing-animation__steps">
          <div class="analyzing-step analyzing-step--active">
            <span class="analyzing-step__icon">✓</span>
            <span class="analyzing-step__text">Reading document</span>
          </div>
          <div class="analyzing-step">
            <span class="analyzing-step__icon">⋯</span>
            <span class="analyzing-step__text">Extracting frameworks</span>
          </div>
          <div class="analyzing-step">
            <span class="analyzing-step__icon">○</span>
            <span class="analyzing-step__text">Identifying decision criteria</span>
          </div>
          <div class="analyzing-step">
            <span class="analyzing-step__icon">○</span>
            <span class="analyzing-step__text">Generating tool design</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderConfirmStep(container: HTMLElement): void {
  const analysis = state.analysis;
  if (!analysis) return;

  container.innerHTML = `
    <div class="create-tool__confirm">
      <h2 class="create-tool__step-title">STEP 3: CONFIRM AI UNDERSTANDING</h2>
      <p class="create-tool__step-description">
        Review the AI's analysis of your content. Click any section to edit if needed.
      </p>

      <div class="confidence-badge confidence-badge--${analysis.confidence >= 80 ? 'high' : analysis.confidence >= 60 ? 'medium' : 'low'}">
        <span class="confidence-badge__label">AI CONFIDENCE:</span>
        <span class="confidence-badge__value">${analysis.confidence}%</span>
      </div>

      <div class="analysis-sections">
        <!-- Tool Name & Purpose -->
        <div class="analysis-section" data-section="tool-name">
          <div class="analysis-section__header">
            <h3 class="analysis-section__title">TOOL NAME & PURPOSE</h3>
            <button type="button" class="btn btn--text analysis-section__edit">EDIT</button>
          </div>
          <div class="analysis-section__content">
            <div class="analysis-field">
              <label class="analysis-field__label">Tool Name</label>
              <p class="analysis-field__value">${analysis.suggestedToolName}</p>
            </div>
            <div class="analysis-field">
              <label class="analysis-field__label">Purpose</label>
              <p class="analysis-field__value">${analysis.toolPurpose}</p>
            </div>
          </div>
        </div>

        <!-- Core Insight -->
        <div class="analysis-section" data-section="core-insight">
          <div class="analysis-section__header">
            <h3 class="analysis-section__title">CORE INSIGHT (THE 80/20)</h3>
            <button type="button" class="btn btn--text analysis-section__edit">EDIT</button>
          </div>
          <div class="analysis-section__content">
            <p class="analysis-field__value analysis-field__value--highlight">
              "${analysis.coreInsight}"
            </p>
          </div>
        </div>

        <!-- Framework -->
        ${analysis.framework ? `
          <div class="analysis-section" data-section="framework">
            <div class="analysis-section__header">
              <h3 class="analysis-section__title">DETECTED FRAMEWORK: ${analysis.framework.name}</h3>
            </div>
            <div class="analysis-section__content">
              <ol class="framework-items">
                ${analysis.framework.items.map(item => `
                  <li class="framework-item">
                    <span class="framework-item__number">${item.number}</span>
                    <span class="framework-item__name">${item.name}</span>
                    <span class="framework-item__description">${item.description}</span>
                  </li>
                `).join('')}
              </ol>
            </div>
          </div>
        ` : ''}

        <!-- Decision Logic -->
        <div class="analysis-section" data-section="decision">
          <div class="analysis-section__header">
            <h3 class="analysis-section__title">DECISION LOGIC</h3>
            <button type="button" class="btn btn--text analysis-section__edit">EDIT</button>
          </div>
          <div class="analysis-section__content">
            <div class="analysis-field">
              <label class="analysis-field__label">Decision Type</label>
              <p class="analysis-field__value">${analysis.decisionType.toUpperCase()}</p>
            </div>
            <div class="analysis-field">
              <label class="analysis-field__label">Decision Question</label>
              <p class="analysis-field__value">${analysis.decisionQuestion}</p>
            </div>
            <div class="analysis-field analysis-field--go">
              <label class="analysis-field__label">GO Condition</label>
              <p class="analysis-field__value">${analysis.goCondition}</p>
            </div>
            <div class="analysis-field analysis-field--nogo">
              <label class="analysis-field__label">NO-GO Condition</label>
              <p class="analysis-field__value">${analysis.noGoCondition}</p>
            </div>
          </div>
        </div>

        <!-- Suggested Inputs -->
        <div class="analysis-section" data-section="inputs">
          <div class="analysis-section__header">
            <h3 class="analysis-section__title">SUGGESTED INPUTS (${analysis.suggestedInputs.length})</h3>
            <button type="button" class="btn btn--text analysis-section__edit">EDIT</button>
          </div>
          <div class="analysis-section__content">
            <div class="inputs-list">
              ${analysis.suggestedInputs.map(input => `
                <div class="input-preview">
                  <span class="input-preview__label">${input.label}</span>
                  <span class="input-preview__type">${input.type}</span>
                  ${input.hint ? `<span class="input-preview__hint">${input.hint}</span>` : ''}
                </div>
              `).join('')}
            </div>
          </div>
        </div>

        <!-- Terminology -->
        ${analysis.terminology.length > 0 ? `
          <div class="analysis-section" data-section="terminology">
            <div class="analysis-section__header">
              <h3 class="analysis-section__title">KEY TERMINOLOGY (${analysis.terminology.length})</h3>
            </div>
            <div class="analysis-section__content">
              <div class="terminology-list">
                ${analysis.terminology.map(term => `
                  <div class="terminology-item">
                    <span class="terminology-item__term">${term.term}</span>
                    <span class="terminology-item__definition">${term.definition}</span>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
        ` : ''}

        <!-- Expert Quotes -->
        ${analysis.expertQuotes.length > 0 ? `
          <div class="analysis-section" data-section="quotes">
            <div class="analysis-section__header">
              <h3 class="analysis-section__title">EXPERT QUOTES (${analysis.expertQuotes.length})</h3>
            </div>
            <div class="analysis-section__content">
              ${analysis.expertQuotes.map(quote => `
                <blockquote class="expert-quote">
                  <p class="expert-quote__text">"${quote.quote}"</p>
                  <cite class="expert-quote__source">— ${quote.source}</cite>
                </blockquote>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>

      <div class="confirm-actions">
        <button type="button" class="btn btn--secondary confirm-actions__back">
          ← RE-ANALYZE
        </button>
        <button type="button" class="btn btn--primary confirm-actions__submit">
          LOOKS GOOD - CREATE TOOL →
        </button>
      </div>
    </div>
  `;

  // Back button - go back to upload
  container.querySelector('.confirm-actions__back')?.addEventListener('click', () => {
    state.step = 'upload';
    state.analysis = null;
    render();
  });

  // Submit button
  container.querySelector('.confirm-actions__submit')?.addEventListener('click', async () => {
    await submitTool();
  });

  // Edit functionality for each section
  attachEditHandlers(container);
}

/**
 * Attach inline edit handlers to all analysis sections
 */
function attachEditHandlers(container: HTMLElement): void {
  const analysis = state.analysis;
  if (!analysis) return;

  container.querySelectorAll('.analysis-section__edit').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const section = (e.target as HTMLElement).closest('.analysis-section');
      if (!section) return;
      const sectionId = section.getAttribute('data-section');
      if (!sectionId) return;
      enterEditMode(section as HTMLElement, sectionId);
    });
  });
}

/**
 * Enter edit mode for a specific section
 */
function enterEditMode(sectionEl: HTMLElement, sectionId: string): void {
  const analysis = state.analysis;
  if (!analysis) return;

  const contentEl = sectionEl.querySelector('.analysis-section__content');
  const editBtn = sectionEl.querySelector('.analysis-section__edit');
  if (!contentEl || !editBtn) return;

  // Store original HTML for cancel
  const originalHtml = contentEl.innerHTML;

  // Hide the EDIT button, show SAVE/CANCEL
  (editBtn as HTMLElement).style.display = 'none';
  const headerEl = sectionEl.querySelector('.analysis-section__header');
  if (!headerEl) return;

  const actionBtns = document.createElement('div');
  actionBtns.className = 'analysis-section__edit-actions';
  actionBtns.innerHTML = `
    <button type="button" class="btn btn--primary btn--small analysis-section__save">SAVE</button>
    <button type="button" class="btn btn--text btn--small analysis-section__cancel">CANCEL</button>
  `;
  headerEl.appendChild(actionBtns);

  // Render edit form based on section
  switch (sectionId) {
    case 'tool-name':
      contentEl.innerHTML = `
        <div class="edit-form">
          <div class="form-group">
            <label class="form-label">Tool Name</label>
            <input type="text" class="input-field edit-field" data-field="suggestedToolName" value="${escapeHtmlAttr(analysis.suggestedToolName)}">
          </div>
          <div class="form-group" style="margin-top:12px">
            <label class="form-label">Purpose</label>
            <textarea class="input-field edit-field" data-field="toolPurpose" rows="3">${escapeHtmlAttr(analysis.toolPurpose)}</textarea>
          </div>
        </div>
      `;
      break;

    case 'core-insight':
      contentEl.innerHTML = `
        <div class="edit-form">
          <div class="form-group">
            <label class="form-label">Core Insight</label>
            <textarea class="input-field edit-field" data-field="coreInsight" rows="4">${escapeHtmlAttr(analysis.coreInsight)}</textarea>
          </div>
        </div>
      `;
      break;

    case 'decision':
      contentEl.innerHTML = `
        <div class="edit-form">
          <div class="form-group">
            <label class="form-label">Decision Type</label>
            <select class="input-field edit-field" data-field="decisionType">
              ${['go-no-go', 'scoring', 'comparison', 'calculator'].map(t =>
                `<option value="${t}" ${analysis.decisionType === t ? 'selected' : ''}>${t.toUpperCase()}</option>`
              ).join('')}
            </select>
          </div>
          <div class="form-group" style="margin-top:12px">
            <label class="form-label">Decision Question</label>
            <input type="text" class="input-field edit-field" data-field="decisionQuestion" value="${escapeHtmlAttr(analysis.decisionQuestion)}">
          </div>
          <div class="form-group" style="margin-top:12px">
            <label class="form-label">GO Condition</label>
            <input type="text" class="input-field edit-field" data-field="goCondition" value="${escapeHtmlAttr(analysis.goCondition)}">
          </div>
          <div class="form-group" style="margin-top:12px">
            <label class="form-label">NO-GO Condition</label>
            <input type="text" class="input-field edit-field" data-field="noGoCondition" value="${escapeHtmlAttr(analysis.noGoCondition)}">
          </div>
        </div>
      `;
      break;

    case 'inputs':
      contentEl.innerHTML = `
        <div class="edit-form">
          ${analysis.suggestedInputs.map((input, i) => `
            <div class="edit-input-row" style="margin-bottom:16px;padding:12px;background:rgba(255,255,255,0.05);">
              <div class="form-group">
                <label class="form-label">Input ${i + 1} Label</label>
                <input type="text" class="input-field edit-input-label" data-index="${i}" value="${escapeHtmlAttr(input.label)}">
              </div>
              <div class="form-group" style="margin-top:8px">
                <label class="form-label">Type</label>
                <select class="input-field edit-input-type" data-index="${i}">
                  ${['number', 'currency', 'percentage', 'slider', 'text', 'select'].map(t =>
                    `<option value="${t}" ${input.type === t ? 'selected' : ''}>${t}</option>`
                  ).join('')}
                </select>
              </div>
              <div class="form-group" style="margin-top:8px">
                <label class="form-label">Hint (optional)</label>
                <input type="text" class="input-field edit-input-hint" data-index="${i}" value="${escapeHtmlAttr(input.hint || '')}">
              </div>
            </div>
          `).join('')}
        </div>
      `;
      break;

    default:
      // Section not editable, restore
      (editBtn as HTMLElement).style.display = '';
      actionBtns.remove();
      return;
  }

  // Attach save handler
  actionBtns.querySelector('.analysis-section__save')?.addEventListener('click', () => {
    saveEdits(sectionEl, sectionId, contentEl, editBtn as HTMLElement, actionBtns, originalHtml);
  });

  // Attach cancel handler
  actionBtns.querySelector('.analysis-section__cancel')?.addEventListener('click', () => {
    contentEl.innerHTML = originalHtml;
    (editBtn as HTMLElement).style.display = '';
    actionBtns.remove();
  });
}

/**
 * Save edits from an edit form
 */
function saveEdits(
  _sectionEl: HTMLElement,
  sectionId: string,
  contentEl: Element,
  editBtn: HTMLElement,
  actionBtns: HTMLElement,
  _originalHtml: string
): void {
  const analysis = state.analysis;
  if (!analysis) return;

  switch (sectionId) {
    case 'tool-name': {
      const name = (contentEl.querySelector('[data-field="suggestedToolName"]') as HTMLInputElement)?.value.trim();
      const purpose = (contentEl.querySelector('[data-field="toolPurpose"]') as HTMLTextAreaElement)?.value.trim();
      if (name) {
        analysis.suggestedToolName = name;
        state.edits.suggestedToolName = name;
      }
      if (purpose) {
        analysis.toolPurpose = purpose;
        state.edits.toolPurpose = purpose;
      }
      break;
    }

    case 'core-insight': {
      const insight = (contentEl.querySelector('[data-field="coreInsight"]') as HTMLTextAreaElement)?.value.trim();
      if (insight) {
        analysis.coreInsight = insight;
        state.edits.coreInsight = insight;
      }
      break;
    }

    case 'decision': {
      const decisionType = (contentEl.querySelector('[data-field="decisionType"]') as HTMLSelectElement)?.value;
      const question = (contentEl.querySelector('[data-field="decisionQuestion"]') as HTMLInputElement)?.value.trim();
      const go = (contentEl.querySelector('[data-field="goCondition"]') as HTMLInputElement)?.value.trim();
      const nogo = (contentEl.querySelector('[data-field="noGoCondition"]') as HTMLInputElement)?.value.trim();
      if (decisionType) {
        analysis.decisionType = decisionType as ContentAnalysisResult['decisionType'];
        state.edits.decisionType = decisionType as ContentAnalysisResult['decisionType'];
      }
      if (question) {
        analysis.decisionQuestion = question;
        state.edits.decisionQuestion = question;
      }
      if (go) {
        analysis.goCondition = go;
        state.edits.goCondition = go;
      }
      if (nogo) {
        analysis.noGoCondition = nogo;
        state.edits.noGoCondition = nogo;
      }
      break;
    }

    case 'inputs': {
      const updatedInputs = [...analysis.suggestedInputs];
      contentEl.querySelectorAll('.edit-input-row').forEach((row) => {
        const idx = parseInt((row.querySelector('.edit-input-label') as HTMLInputElement)?.getAttribute('data-index') || '0');
        const label = (row.querySelector('.edit-input-label') as HTMLInputElement)?.value.trim();
        const type = (row.querySelector('.edit-input-type') as HTMLSelectElement)?.value;
        const hint = (row.querySelector('.edit-input-hint') as HTMLInputElement)?.value.trim();
        if (updatedInputs[idx]) {
          if (label) updatedInputs[idx].label = label;
          if (type) updatedInputs[idx].type = type as any;
          updatedInputs[idx].hint = hint || undefined;
        }
      });
      analysis.suggestedInputs = updatedInputs;
      state.edits.suggestedInputs = updatedInputs;
      break;
    }
  }

  // Re-render the confirm step to show updated values
  actionBtns.remove();
  editBtn.style.display = '';
  render();
  addToast('success', 'Changes saved', 2000);
}

function escapeHtmlAttr(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function submitTool(): Promise<void> {
  if (!state.selectedTemplate || !state.analysis) return;

  state.step = 'submitting';
  render();

  try {
    const job = await createJobFromAnalysis(
      state.fileName,
      state.fileContent,
      state.selectedTemplate.id as 'B2B_PRODUCT' | 'B2B_SERVICE' | 'B2C_PRODUCT' | 'B2C_SERVICE',
      state.analysis,
      Object.keys(state.edits).length > 0 ? state.edits : undefined
    );

    showSuccess(`Tool "${state.analysis.suggestedToolName}" submitted successfully!`);
    resetState();
    navigate(`/job/${job._id}`);

  } catch (error) {
    console.error('Failed to create tool:', error);
    showError(error instanceof Error ? error.message : 'Failed to create tool');
    state.step = 'confirm';
    render();
  }
}

function renderSubmittingStep(container: HTMLElement): void {
  container.innerHTML = `
    <div class="create-tool__submitting">
      <div class="submitting-animation">
        <div class="submitting-animation__spinner"></div>
        <h2 class="submitting-animation__title">CREATING YOUR TOOL</h2>
        <p class="submitting-animation__text">
          Sending your confirmed specifications to the factory...
        </p>
      </div>
    </div>
  `;
}

// ========== MAIN RENDER ==========

function render(): void {
  if (!currentContainer) return;

  currentContainer.innerHTML = `
    <div class="view view--create-tool">
      <div class="create-tool">
        <div class="create-tool__header">
          <h1 class="create-tool__title">CREATE NEW TOOL</h1>
          <button type="button" class="btn btn--secondary create-tool__cancel-btn">CANCEL</button>
        </div>

        <div class="create-tool__progress">
          <div class="progress-step ${state.step === 'template' ? 'progress-step--active' : 'progress-step--completed'}">
            <span class="progress-step__number">1</span>
            <span class="progress-step__label">SELECT TYPE</span>
          </div>
          <div class="progress-step__connector ${state.step !== 'template' ? 'progress-step__connector--completed' : ''}"></div>
          <div class="progress-step ${state.step === 'upload' || state.step === 'analyzing' ? 'progress-step--active' : (state.step === 'confirm' || state.step === 'submitting' ? 'progress-step--completed' : '')}">
            <span class="progress-step__number">2</span>
            <span class="progress-step__label">UPLOAD & ANALYZE</span>
          </div>
          <div class="progress-step__connector ${state.step === 'confirm' || state.step === 'submitting' ? 'progress-step__connector--completed' : ''}"></div>
          <div class="progress-step ${state.step === 'confirm' || state.step === 'submitting' ? 'progress-step--active' : ''}">
            <span class="progress-step__number">3</span>
            <span class="progress-step__label">CONFIRM & CREATE</span>
          </div>
        </div>

        <div id="step-content" class="create-tool__content"></div>
      </div>
    </div>
  `;

  // Cancel button
  currentContainer.querySelector('.create-tool__cancel-btn')?.addEventListener('click', () => {
    if (confirm('Are you sure you want to cancel? All progress will be lost.')) {
      resetState();
      navigate('/');
    }
  });

  // Render current step content
  const stepContent = currentContainer.querySelector<HTMLElement>('#step-content');
  if (stepContent) {
    switch (state.step) {
      case 'template':
        renderTemplateStep(stepContent);
        break;
      case 'upload':
        renderUploadStep(stepContent);
        break;
      case 'analyzing':
        renderAnalyzingStep(stepContent);
        break;
      case 'confirm':
        renderConfirmStep(stepContent);
        break;
      case 'submitting':
        renderSubmittingStep(stepContent);
        break;
    }
  }
}

// ========== PUBLIC API ==========

export async function renderCreateToolView(container: HTMLElement): Promise<void> {
  currentContainer = container;
  resetState();

  // Check for pre-selected template from URL hash params (e.g., #/create?template=B2B_PRODUCT)
  const hashParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
  const preselectedTemplateId = hashParams.get('template');

  // Load templates
  try {
    templates = await getTemplates();
  } catch (error) {
    console.error('Failed to load templates:', error);
    // Fallback to hardcoded templates
    templates = [
      {
        id: 'B2B_PRODUCT',
        name: 'B2B Product',
        description: 'Physical or digital goods sold to businesses. Decisions focus on ROI, implementation effort, and competitive advantage. Buyers need data-backed justification.',
        examples: ['ROI Calculator', 'Implementation Readiness Assessment', 'Feature Comparison Tool'],
        ideal_for: 'SaaS platforms, manufacturing equipment, enterprise software, hardware solutions'
      },
      {
        id: 'B2B_SERVICE',
        name: 'B2B Service',
        description: 'Professional services and ongoing engagements sold to businesses. Decisions focus on scope, vendor fit, and partnership value. Relationships and trust matter most.',
        examples: ['Vendor Selection Scorecard', 'Partnership Readiness Quiz', 'Service Scope Calculator'],
        ideal_for: 'Consulting firms, marketing agencies, outsourcing, professional services, managed IT'
      },
      {
        id: 'B2C_PRODUCT',
        name: 'B2C Product',
        description: 'Consumer goods purchased by individuals. Decisions are often emotional and lifestyle-driven. Tools help buyers find the right fit for their personal situation.',
        examples: ['Product Fit Quiz', 'Purchase Decision Helper', 'Value Assessment Tool'],
        ideal_for: 'Retail, e-commerce, consumer electronics, FMCG, health & wellness products'
      },
      {
        id: 'B2C_SERVICE',
        name: 'B2C Service',
        description: 'Services consumed by individuals. Decisions weigh personal goals, time commitment, and ongoing value. Tools help users assess if a service fits their life.',
        examples: ['Membership Value Calculator', 'Goal Alignment Quiz', 'Service Selection Guide'],
        ideal_for: 'Fitness, education, coaching, healthcare, hospitality, subscription services'
      }
    ];
  }

  // If a template was pre-selected via URL, skip to upload step
  if (preselectedTemplateId) {
    const preselected = templates.find(t => t.id === preselectedTemplateId);
    if (preselected) {
      state.selectedTemplate = preselected;
      state.step = 'upload';
    }
  }

  render();
}

export function cleanupCreateToolView(): void {
  currentContainer = null;
}
