// LogCard Component - Collapsible AI Reasoning Display
// Feature: Boss Office Redesign

import type { FactoryLog, AgentStage } from '../types/logs.ts';
import { STAGE_CONFIG, formatDuration, formatTokens, CONTENT_TRUNCATION_LIMIT } from '../types/logs.ts';

interface LogCardProps {
  log: FactoryLog;
  isExpanded: boolean;
  isShowingFull: boolean;
  onToggle?: () => void;
  onShowFull?: () => void;
}

/**
 * Render a log card
 */
export function renderLogCard(props: LogCardProps): string {
  const { log, isExpanded, isShowingFull } = props;
  const stageConfig = STAGE_CONFIG[log.stage] || STAGE_CONFIG['unknown'];

  const shouldTruncatePrompt = log.prompt.length > CONTENT_TRUNCATION_LIMIT && !isShowingFull;
  const shouldTruncateResponse = log.response.length > CONTENT_TRUNCATION_LIMIT && !isShowingFull;

  return `
    <div class="log-card ${isExpanded ? 'log-card--expanded' : ''}" data-log-id="${log._id}">
      <div class="log-card__header">
        <div class="log-card__stage">
          <span class="log-card__stage-number">${stageConfig.icon}</span>
          <span class="log-card__stage-name">${stageConfig.displayName}</span>
        </div>

        <div class="log-card__meta">
          <span class="log-card__provider">${log.provider.toUpperCase()}</span>
          <span class="log-card__model">${log.model}</span>
          <span class="log-card__duration">${formatDuration(log.duration_ms)}</span>
          <span class="log-card__tokens">${formatTokens(log.input_tokens + log.output_tokens)} tokens</span>
        </div>

        <button type="button" class="log-card__toggle" data-action="toggle">
          ${isExpanded ? '−' : '+'}
        </button>
      </div>

      <div class="log-card__summary">
        <p>${escapeHtml(log.summary)}</p>
      </div>

      ${isExpanded ? `
        <div class="log-card__content">
          <!-- Prompt Section -->
          <div class="log-card__section">
            <div class="log-card__section-header">
              <h4 class="log-card__section-title">PROMPT</h4>
              <span class="log-card__section-tokens">${formatTokens(log.input_tokens)} input tokens</span>
              ${log.prompt_truncated ? '<span class="log-card__truncated-badge">TRUNCATED</span>' : ''}
            </div>
            <pre class="log-card__code">${escapeHtml(shouldTruncatePrompt ? log.prompt.slice(0, CONTENT_TRUNCATION_LIMIT) : log.prompt)}</pre>
            ${shouldTruncatePrompt ? `
              <button type="button" class="btn btn--secondary btn--small log-card__show-more" data-action="show-full">
                SHOW FULL CONTENT
              </button>
            ` : ''}
          </div>

          <!-- Response Section -->
          <div class="log-card__section">
            <div class="log-card__section-header">
              <h4 class="log-card__section-title">RESPONSE</h4>
              <span class="log-card__section-tokens">${formatTokens(log.output_tokens)} output tokens</span>
              ${log.response_truncated ? '<span class="log-card__truncated-badge">TRUNCATED</span>' : ''}
            </div>
            <pre class="log-card__code">${escapeHtml(shouldTruncateResponse ? log.response.slice(0, CONTENT_TRUNCATION_LIMIT) : log.response)}</pre>
            ${shouldTruncateResponse ? `
              <button type="button" class="btn btn--secondary btn--small log-card__show-more" data-action="show-full">
                SHOW FULL CONTENT
              </button>
            ` : ''}
          </div>

          <!-- Metadata -->
          <div class="log-card__section log-card__section--meta">
            <div class="log-card__meta-grid">
              <div class="log-card__meta-item">
                <span class="log-card__meta-label">TIMESTAMP</span>
                <span class="log-card__meta-value">${formatTimestamp(log.createdAt)}</span>
              </div>
              <div class="log-card__meta-item">
                <span class="log-card__meta-label">DURATION</span>
                <span class="log-card__meta-value">${formatDuration(log.duration_ms)}</span>
              </div>
              <div class="log-card__meta-item">
                <span class="log-card__meta-label">INPUT TOKENS</span>
                <span class="log-card__meta-value">${formatTokens(log.input_tokens)}</span>
              </div>
              <div class="log-card__meta-item">
                <span class="log-card__meta-label">OUTPUT TOKENS</span>
                <span class="log-card__meta-value">${formatTokens(log.output_tokens)}</span>
              </div>
            </div>
          </div>
        </div>
      ` : ''}
    </div>
  `;
}


/**
 * Format timestamp
 */
function formatTimestamp(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString();
}

/**
 * Escape HTML
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Get stage display name
 */
export function getStageDisplayName(stage: AgentStage): string {
  return STAGE_CONFIG[stage]?.displayName || stage.toUpperCase();
}

/**
 * Get stage order
 */
export function getStageOrder(stage: AgentStage): number {
  return STAGE_CONFIG[stage]?.order || 99;
}
