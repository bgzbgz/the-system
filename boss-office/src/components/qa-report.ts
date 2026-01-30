import type { QAReport } from '../types/index.ts';

// Render the QA report component
export function renderQAReport(container: HTMLElement, qaReport: QAReport | null): void {
  if (!qaReport) {
    container.innerHTML = `
      <div class="qa-report">
        <h3 class="qa-report__title">QA REPORT</h3>
        <p class="empty-state__message">QA report not available</p>
      </div>
    `;
    return;
  }

  const overallStatus = qaReport.passed ? 'PASSED' : 'FAILED';
  const overallIcon = qaReport.passed ? '&#10003;' : '&#10007;';

  container.innerHTML = `
    <div class="qa-report">
      <h3 class="qa-report__title">QA REPORT</h3>
      <div class="qa-report__overall" style="margin-bottom: var(--space-md); padding: var(--space-sm); background: ${qaReport.passed ? 'var(--color-yellow)' : 'var(--color-black)'}; color: ${qaReport.passed ? 'var(--color-black)' : 'var(--color-white)'};">
        <strong>${overallIcon} ${overallStatus}</strong>
      </div>

      <ul class="qa-report__list">
        ${qaReport.criteria
          .map(
            (criterion) => `
          <li class="qa-report__item">
            <span class="qa-report__icon qa-report__icon--${criterion.passed ? 'pass' : 'fail'}">
              ${criterion.passed ? '&#10003;' : '&#10007;'}
            </span>
            <span class="qa-report__name">${escapeHtml(criterion.name)}</span>
            ${criterion.feedback ? `<span class="qa-report__feedback" style="font-size: 0.75rem; color: var(--color-grey); display: block; margin-left: 28px;">${escapeHtml(criterion.feedback)}</span>` : ''}
          </li>
        `
          )
          .join('')}
      </ul>

      ${
        qaReport.notes
          ? `
        <div class="qa-report__notes" style="margin-top: var(--space-md); padding-top: var(--space-md); border-top: 1px solid var(--color-grey);">
          <strong class="label">NOTES:</strong>
          <p style="margin-top: var(--space-xs);">${escapeHtml(qaReport.notes)}</p>
        </div>
      `
          : ''
      }
    </div>
  `;
}

// Escape HTML to prevent XSS
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
