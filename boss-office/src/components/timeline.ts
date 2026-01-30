import type { AuditEvent, EventType } from '../types/index.ts';

// Event type display configuration
const EVENT_CONFIG: Record<EventType, { icon: string; label: string }> = {
  JOB_CREATED: { icon: '&#128221;', label: 'Job Created' },
  JOB_SUBMITTED: { icon: '&#128228;', label: 'Job Submitted' },
  PROCESSING_STARTED: { icon: '&#9881;', label: 'Processing Started' },
  QA_STARTED: { icon: '&#128269;', label: 'QA Started' },
  QA_PASSED: { icon: '&#10003;', label: 'QA Passed' },
  QA_FAILED: { icon: '&#10007;', label: 'QA Failed' },
  REVISION_REQUESTED: { icon: '&#128393;', label: 'Revision Requested' },
  REVISION_APPLIED: { icon: '&#128260;', label: 'Revision Applied' },
  APPROVED: { icon: '&#10003;', label: 'Approved' },
  DEPLOYED: { icon: '&#127881;', label: 'Deployed' },
  REJECTED: { icon: '&#10006;', label: 'Rejected' },
};

// Render the timeline component
export function renderTimeline(container: HTMLElement, events: AuditEvent[]): void {
  if (events.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">&#128197;</div>
        <h2 class="empty-state__title">NO EVENTS</h2>
        <p class="empty-state__message">No audit events to display.</p>
      </div>
    `;
    return;
  }

  // Sort by timestamp descending (newest first)
  const sortedEvents = [...events].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  container.innerHTML = `
    <div class="timeline">
      ${sortedEvents.map((event) => renderTimelineItem(event)).join('')}
    </div>
  `;
}

// Render a single timeline item
function renderTimelineItem(event: AuditEvent): string {
  const config = EVENT_CONFIG[event.eventType] || { icon: '?', label: event.eventType };
  const timestamp = formatTimestamp(event.timestamp);
  const details = formatEventDetails(event);

  return `
    <div class="timeline__item">
      <div class="timeline__marker"></div>
      <div class="timeline__content">
        <div class="timeline__header">
          <span class="timeline__type">
            <span style="margin-right: var(--space-xs);">${config.icon}</span>
            ${config.label}
          </span>
          <span class="timeline__time">${timestamp}</span>
        </div>
        ${details ? `<div class="timeline__details">${details}</div>` : ''}
        <div class="timeline__actor label" style="margin-top: var(--space-xs);">
          by ${escapeHtml(event.actor)}
        </div>
      </div>
    </div>
  `;
}

// Format timestamp for display
function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  // Relative time for recent events
  if (diffMin < 1) {
    return 'just now';
  } else if (diffMin < 60) {
    return `${diffMin} min${diffMin === 1 ? '' : 's'} ago`;
  } else if (diffHour < 24) {
    return `${diffHour} hour${diffHour === 1 ? '' : 's'} ago`;
  } else if (diffDay < 7) {
    return `${diffDay} day${diffDay === 1 ? '' : 's'} ago`;
  }

  // Full date for older events
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}

// Format event details based on event type
function formatEventDetails(event: AuditEvent): string {
  const details = event.details;
  if (!details || Object.keys(details).length === 0) {
    return '';
  }

  const parts: string[] = [];

  if (details.fileName) {
    parts.push(`File: ${escapeHtml(String(details.fileName))}`);
  }
  if (details.toolName) {
    parts.push(`Tool: ${escapeHtml(String(details.toolName))}`);
  }
  if (details.status) {
    parts.push(`Status: ${escapeHtml(String(details.status))}`);
  }
  if (details.url) {
    parts.push(`URL: ${escapeHtml(String(details.url))}`);
  }
  if (details.notes) {
    parts.push(`Notes: ${escapeHtml(String(details.notes))}`);
  }
  if (details.reason) {
    parts.push(`Reason: ${escapeHtml(String(details.reason))}`);
  }

  return parts.join(' | ');
}

// Escape HTML to prevent XSS
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
