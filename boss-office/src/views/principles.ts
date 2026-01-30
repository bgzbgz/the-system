/**
 * Principles View
 *
 * Displays Fast Track principle documents organized by category.
 * Allows the boss to read each document.
 */

import { getPrinciples, getPrincipleContent, PrincipleDocument } from '../api/principles.ts';
import { showError } from '../store/actions.ts';

let currentDocuments: PrincipleDocument[] = [];

/**
 * Render the principles view
 */
export async function renderPrinciplesView(container: HTMLElement): Promise<void> {
  // Show loading state
  container.innerHTML = `
    <div class="view principles-view">
      <div class="view__header">
        <h1 class="view__title">THE PRINCIPLES</h1>
        <p class="view__subtitle">Fast Track tool creation guidelines and standards</p>
      </div>
      <div class="principles-loading">
        <div class="spinner"></div>
        <p>Loading principles...</p>
      </div>
    </div>
  `;

  try {
    // Fetch documents
    currentDocuments = await getPrinciples();
    renderDocumentList(container);
  } catch (error) {
    console.error('Failed to load principles:', error);
    showError('Failed to load principles');
    container.innerHTML = `
      <div class="view principles-view">
        <div class="view__header">
          <h1 class="view__title">THE PRINCIPLES</h1>
        </div>
        <div class="empty-state">
          <div class="empty-state__icon">!</div>
          <h2 class="empty-state__title">Failed to Load</h2>
          <p class="empty-state__message">Could not load principle documents. Please try again.</p>
          <button class="btn btn--primary" onclick="location.reload()">RETRY</button>
        </div>
      </div>
    `;
  }
}

/**
 * Render the document list with categories
 */
function renderDocumentList(container: HTMLElement): void {
  // Group documents by category
  const categories = new Map<string, PrincipleDocument[]>();

  for (const doc of currentDocuments) {
    if (!categories.has(doc.category)) {
      categories.set(doc.category, []);
    }
    categories.get(doc.category)!.push(doc);
  }

  // Build HTML
  let categoriesHtml = '';
  categories.forEach((docs, category) => {
    const docsHtml = docs.map(doc => `
      <div class="principle-card" data-id="${doc.id}">
        <div class="principle-card__icon">${getCategoryIcon(doc.category)}</div>
        <div class="principle-card__content">
          <h3 class="principle-card__title">${doc.title}</h3>
          <p class="principle-card__meta">${formatSize(doc.size)}</p>
        </div>
        <div class="principle-card__arrow">→</div>
      </div>
    `).join('');

    categoriesHtml += `
      <div class="principles-category">
        <h2 class="principles-category__title">${category}</h2>
        <div class="principles-category__cards">
          ${docsHtml}
        </div>
      </div>
    `;
  });

  container.innerHTML = `
    <div class="view principles-view">
      <div class="view__header">
        <h1 class="view__title">THE PRINCIPLES</h1>
        <p class="view__subtitle">Fast Track tool creation guidelines and standards</p>
      </div>
      <div class="principles-list">
        ${categoriesHtml}
      </div>
    </div>
  `;

  // Add click handlers
  container.querySelectorAll('.principle-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.getAttribute('data-id');
      if (id) {
        openDocument(container, id);
      }
    });
  });
}

/**
 * Open a document to view its content
 */
async function openDocument(container: HTMLElement, docId: string): Promise<void> {
  // Show loading
  const doc = currentDocuments.find(d => d.id === docId);
  const title = doc?.title || 'Loading...';

  container.innerHTML = `
    <div class="view principles-view">
      <div class="view__header">
        <button class="btn btn--back" id="backBtn">← BACK TO LIST</button>
        <h1 class="view__title">${title}</h1>
        ${doc ? `<span class="view__badge">${doc.category}</span>` : ''}
      </div>
      <div class="principles-loading">
        <div class="spinner"></div>
        <p>Loading document...</p>
      </div>
    </div>
  `;

  // Add back button handler
  container.querySelector('#backBtn')?.addEventListener('click', () => {
    renderDocumentList(container);
  });

  try {
    const content = await getPrincipleContent(docId);
    renderDocumentContent(container, content.title, content.content, doc?.category || 'General');
  } catch (error) {
    console.error('Failed to load document:', error);
    showError('Failed to load document');
    container.innerHTML = `
      <div class="view principles-view">
        <div class="view__header">
          <button class="btn btn--back" id="backBtn">← BACK TO LIST</button>
          <h1 class="view__title">Error</h1>
        </div>
        <div class="empty-state">
          <div class="empty-state__icon">!</div>
          <h2 class="empty-state__title">Failed to Load Document</h2>
          <p class="empty-state__message">Could not load the document content.</p>
        </div>
      </div>
    `;
    container.querySelector('#backBtn')?.addEventListener('click', () => {
      renderDocumentList(container);
    });
  }
}

/**
 * Render the document content
 */
function renderDocumentContent(container: HTMLElement, title: string, content: string, category: string): void {
  // Convert markdown to HTML (simple conversion)
  const html = markdownToHtml(content);

  container.innerHTML = `
    <div class="view principles-view">
      <div class="view__header">
        <button class="btn btn--back" id="backBtn">← BACK TO LIST</button>
        <h1 class="view__title">${title}</h1>
        <span class="view__badge">${category}</span>
      </div>
      <div class="principles-content">
        <article class="markdown-content">
          ${html}
        </article>
      </div>
    </div>
  `;

  // Add back button handler
  container.querySelector('#backBtn')?.addEventListener('click', () => {
    renderDocumentList(container);
  });
}

/**
 * Simple markdown to HTML converter
 */
function markdownToHtml(markdown: string): string {
  let html = markdown;

  // Escape HTML
  html = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Headers
  html = html.replace(/^######\s+(.*)$/gm, '<h6>$1</h6>');
  html = html.replace(/^#####\s+(.*)$/gm, '<h5>$1</h5>');
  html = html.replace(/^####\s+(.*)$/gm, '<h4>$1</h4>');
  html = html.replace(/^###\s+(.*)$/gm, '<h3>$1</h3>');
  html = html.replace(/^##\s+(.*)$/gm, '<h2>$1</h2>');
  html = html.replace(/^#\s+(.*)$/gm, '<h1>$1</h1>');

  // Bold and italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Lists
  html = html.replace(/^\s*[-*]\s+(.*)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');

  // Numbered lists
  html = html.replace(/^\s*\d+\.\s+(.*)$/gm, '<li>$1</li>');

  // Blockquotes
  html = html.replace(/^>\s+(.*)$/gm, '<blockquote>$1</blockquote>');

  // Horizontal rules
  html = html.replace(/^---+$/gm, '<hr>');

  // Code blocks
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Paragraphs (wrap remaining text)
  html = html.replace(/^(?!<[a-z]|$)(.+)$/gm, '<p>$1</p>');

  // Clean up empty paragraphs
  html = html.replace(/<p>\s*<\/p>/g, '');

  return html;
}

/**
 * Get category icon
 */
function getCategoryIcon(category: string): string {
  switch (category) {
    case '8-Point Criteria':
      return '✓';
    case 'Tool Definition':
      return '🔧';
    case 'Guides':
      return '📖';
    case 'Brand & Fundamentals':
      return '⚡';
    case 'Client Experience':
      return '👤';
    default:
      return '📄';
  }
}

/**
 * Format file size
 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
