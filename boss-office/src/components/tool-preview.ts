// Tool Preview Component - Sandboxed iframe for viewing generated tools

// Escape HTML to prevent XSS in error messages
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Render the tool preview iframe
export function renderToolPreview(
  container: HTMLElement,
  html: string | null,
  errorMessage?: string | null
): void {
  if (!html) {
    const errorInfo = errorMessage
      ? `<p class="empty-state__message" style="color: #ff6b6b; margin-top: 8px;">Error: ${escapeHtml(errorMessage)}</p>`
      : '';

    container.innerHTML = `
      <div class="preview__iframe-container">
        <div class="empty-state" style="height: 100%; display: flex; flex-direction: column; justify-content: center;">
          <div class="empty-state__icon">&#128194;</div>
          <h2 class="empty-state__title">NO PREVIEW</h2>
          <p class="empty-state__message">Tool generation failed or is still in progress</p>
          ${errorInfo}
        </div>
      </div>
    `;
    return;
  }

  // Create iframe with sandbox attributes for security
  // allow-scripts: needed for tool interactivity
  // allow-forms: needed for tool form submissions
  // NOT including allow-same-origin to prevent escaping sandbox
  container.innerHTML = `
    <div class="preview__iframe-container">
      <iframe
        id="tool-preview-iframe"
        class="preview__iframe"
        sandbox="allow-scripts allow-forms"
        title="Tool Preview"
      ></iframe>
    </div>
  `;

  // Write HTML content to iframe
  const iframe = container.querySelector<HTMLIFrameElement>('#tool-preview-iframe');
  if (iframe) {
    // Use srcdoc for same-origin content
    iframe.srcdoc = html;
  }
}

// Get the preview iframe element
export function getPreviewIframe(container: HTMLElement): HTMLIFrameElement | null {
  return container.querySelector<HTMLIFrameElement>('#tool-preview-iframe');
}
