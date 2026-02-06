/**
 * Factory Floor View
 * Real-time animated view of the tool factory pipeline
 */

import { getLiveLogs, getActiveJobs, getFactoryStats, LiveLogEntry, ActiveJob, FactoryStats } from '../api/live.ts';

// ========== STATE ==========

let pollInterval: number | null = null;
const POLL_INTERVAL = 2000; // 2 seconds

// Pipeline stages for the conveyor belt
const PIPELINE_STAGES = [
  { id: 'secretary', name: 'SEC', fullName: 'Secretary' },
  { id: 'analyst', name: 'ANL', fullName: 'Course Analyst' },
  { id: 'architect', name: 'ARC', fullName: 'Knowledge Architect' },
  { id: 'builder', name: 'BLD', fullName: 'Tool Builder' },
  { id: 'brand', name: 'BRD', fullName: 'Brand Guardian' },
  { id: 'qa', name: 'QA', fullName: 'QA Department' },
  { id: 'deploy', name: 'DEP', fullName: 'Deploy' },
];

// ========== MAIN RENDER ==========

export async function renderFactoryFloorView(container: HTMLElement): Promise<void> {
  container.innerHTML = `
    <div class="view view--factory-floor">
      <div class="factory-floor">
        <!-- Header -->
        <div class="factory-floor__header">
          <h1 class="factory-floor__title">FACTORY FLOOR</h1>
          <div class="factory-floor__status">
            <span class="factory-floor__status-dot"></span>
            <span class="factory-floor__status-text">LIVE</span>
          </div>
        </div>

        <!-- Stats Bar -->
        <div class="factory-floor__stats" id="stats-container">
          <div class="stat-card">
            <span class="stat-card__value" id="stat-active">-</span>
            <span class="stat-card__label">ACTIVE JOBS</span>
          </div>
          <div class="stat-card">
            <span class="stat-card__value" id="stat-recent">-</span>
            <span class="stat-card__label">EVENTS (5m)</span>
          </div>
          <div class="stat-card stat-card--success">
            <span class="stat-card__value" id="stat-success">-</span>
            <span class="stat-card__label">COMPLETED</span>
          </div>
          <div class="stat-card stat-card--error">
            <span class="stat-card__value" id="stat-errors">-</span>
            <span class="stat-card__label">ERRORS</span>
          </div>
        </div>

        <!-- Conveyor Belt -->
        <div class="conveyor">
          <div class="conveyor__title">PIPELINE</div>
          <div class="conveyor__belt">
            <div class="conveyor__track"></div>
            <div class="conveyor__stages">
              ${PIPELINE_STAGES.map(stage => `
                <div class="conveyor__stage" data-stage="${stage.id}">
                  <div class="conveyor__stage-icon">${stage.name}</div>
                  <div class="conveyor__stage-name">${stage.fullName}</div>
                </div>
              `).join('')}
            </div>
            <div class="conveyor__jobs" id="conveyor-jobs"></div>
          </div>
        </div>

        <!-- Activity Feed -->
        <div class="activity-feed">
          <div class="activity-feed__header">
            <h2 class="activity-feed__title">LIVE ACTIVITY</h2>
            <div class="activity-feed__filters">
              <button class="filter-btn filter-btn--active" data-filter="all">ALL</button>
              <button class="filter-btn" data-filter="job">JOBS</button>
              <button class="filter-btn" data-filter="pipeline">STAGES</button>
              <button class="filter-btn" data-filter="error">ERRORS</button>
            </div>
          </div>
          <div class="activity-feed__list" id="activity-list">
            <div class="activity-feed__loading">
              <div class="spinner"></div>
              <span>Connecting to factory...</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Add styles
  addFactoryFloorStyles();

  // Attach filter handlers
  attachFilterHandlers(container);

  // Start polling
  startPolling(container);
}

// ========== POLLING ==========

function startPolling(container: HTMLElement): void {
  // Initial load
  refreshData(container);

  // Poll for updates
  pollInterval = window.setInterval(() => {
    refreshData(container);
  }, POLL_INTERVAL);
}

export function stopPolling(): void {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}

async function refreshData(container: HTMLElement): Promise<void> {
  try {
    const [logsResult, jobsResult, statsResult] = await Promise.all([
      getLiveLogs({ limit: 50 }),
      getActiveJobs(),
      getFactoryStats()
    ]);

    updateStats(container, statsResult.stats);
    updateConveyor(container, jobsResult.jobs);
    updateActivityFeed(container, logsResult.logs);
  } catch (error) {
    console.error('Factory floor polling error:', error);
  }
}

// ========== UPDATE FUNCTIONS ==========

function updateStats(container: HTMLElement, stats: FactoryStats): void {
  const activeEl = container.querySelector('#stat-active');
  const recentEl = container.querySelector('#stat-recent');
  const successEl = container.querySelector('#stat-success');
  const errorsEl = container.querySelector('#stat-errors');

  if (activeEl) activeEl.textContent = stats.activeJobs.toString();
  if (recentEl) recentEl.textContent = stats.recentActivity.toString();
  if (successEl) successEl.textContent = stats.byLevel.success.toString();
  if (errorsEl) errorsEl.textContent = stats.byLevel.error.toString();
}

function updateConveyor(container: HTMLElement, jobs: ActiveJob[]): void {
  const conveyorJobs = container.querySelector('#conveyor-jobs');
  if (!conveyorJobs) return;

  // Map stage names to positions
  const stagePositions: Record<string, number> = {
    'Secretary': 0,
    'Content Summarizer': 0,
    'Course Analyst': 1,
    'Knowledge Architect': 2,
    'Audience Profiler': 2,
    'Example Generator': 2,
    'Copy Writer': 2,
    'Tool Builder': 3,
    'Brand Guardian': 4,
    'QA Department': 5,
    'Deploy': 6,
    'complete': 6,
  };

  const jobsHtml = jobs.slice(0, 5).map((job, index) => {
    const position = stagePositions[job.lastStage || 'Secretary'] || 0;
    const leftPercent = 5 + (position * 13.5); // Distribute across conveyor
    const statusClass = job.status === 'error' ? 'conveyor__job--error' :
                       job.status === 'complete' ? 'conveyor__job--complete' : '';

    return `
      <div class="conveyor__job ${statusClass}" style="left: ${leftPercent}%; animation-delay: ${index * 0.1}s">
        <div class="conveyor__job-name">${escapeHtml(job.jobName.slice(0, 15))}</div>
        <div class="conveyor__job-stage">${job.lastStage || 'Starting...'}</div>
      </div>
    `;
  }).join('');

  conveyorJobs.innerHTML = jobsHtml || '<div class="conveyor__empty">No active jobs</div>';
}

function updateActivityFeed(container: HTMLElement, logs: LiveLogEntry[]): void {
  const activityList = container.querySelector('#activity-list');
  if (!activityList) return;

  const activeFilter = container.querySelector('.filter-btn--active')?.getAttribute('data-filter') || 'all';

  const filteredLogs = logs.filter(log => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'error') return log.level === 'error' || log.level === 'warn';
    return log.category === activeFilter;
  });

  if (filteredLogs.length === 0) {
    activityList.innerHTML = `
      <div class="activity-feed__empty">
        <span>No activity yet. Create a job to see the factory in action!</span>
      </div>
    `;
    return;
  }

  const logsHtml = filteredLogs.map(log => {
    const timeAgo = getTimeAgo(new Date(log.timestamp));
    const levelClass = `activity-item--${log.level}`;
    const icon = getLogIcon(log.level, log.category);

    return `
      <div class="activity-item ${levelClass}">
        <span class="activity-item__icon">${icon}</span>
        <div class="activity-item__content">
          <span class="activity-item__message">${escapeHtml(log.message)}</span>
          ${log.jobName ? `<span class="activity-item__job">${escapeHtml(log.jobName)}</span>` : ''}
        </div>
        <span class="activity-item__time">${timeAgo}</span>
      </div>
    `;
  }).join('');

  activityList.innerHTML = logsHtml;
}

// ========== FILTER HANDLERS ==========

function attachFilterHandlers(container: HTMLElement): void {
  const filterBtns = container.querySelectorAll('.filter-btn');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('filter-btn--active'));
      btn.classList.add('filter-btn--active');
      refreshData(container);
    });
  });
}

// ========== HELPERS ==========

function getLogIcon(level: string, category: string): string {
  if (level === 'error') return '!';
  if (level === 'warn') return '⚠';
  if (level === 'success') return '✓';
  if (category === 'ai') return '◆';
  if (category === 'deploy') return '↑';
  if (category === 'job') return '◉';
  return '●';
}

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 5) return 'now';
  if (diffSec < 60) return `${diffSec}s`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m`;
  return `${Math.floor(diffSec / 3600)}h`;
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ========== STYLES ==========

function addFactoryFloorStyles(): void {
  if (document.getElementById('factory-floor-styles')) return;

  const styles = document.createElement('style');
  styles.id = 'factory-floor-styles';
  styles.textContent = `
    .view--factory-floor {
      background: var(--color-black);
      min-height: 100vh;
    }

    .factory-floor {
      max-width: 1400px;
      margin: 0 auto;
      padding: var(--space-lg);
    }

    /* Header */
    .factory-floor__header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: var(--space-lg);
    }

    .factory-floor__title {
      font-family: var(--font-headline);
      font-size: 2rem;
      color: var(--color-white);
      margin: 0;
    }

    .factory-floor__status {
      display: flex;
      align-items: center;
      gap: var(--space-xs);
      padding: var(--space-xs) var(--space-sm);
      border: 2px solid var(--color-yellow);
    }

    .factory-floor__status-dot {
      width: 8px;
      height: 8px;
      background: var(--color-yellow);
      animation: pulse 1.5s ease-in-out infinite;
    }

    .factory-floor__status-text {
      font-family: var(--font-mono);
      font-size: 0.75rem;
      color: var(--color-yellow);
      letter-spacing: 0.1em;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.3; }
    }

    /* Stats Bar */
    .factory-floor__stats {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: var(--space-md);
      margin-bottom: var(--space-xl);
    }

    .stat-card {
      background: var(--color-black);
      border: 2px solid var(--color-white);
      padding: var(--space-md);
      text-align: center;
    }

    .stat-card__value {
      display: block;
      font-family: var(--font-headline);
      font-size: 2.5rem;
      color: var(--color-white);
    }

    .stat-card__label {
      font-family: var(--font-mono);
      font-size: 0.625rem;
      color: var(--color-grey);
      letter-spacing: 0.1em;
    }

    .stat-card--success .stat-card__value { color: var(--color-yellow); }
    .stat-card--error .stat-card__value { color: #ff4444; }

    /* Conveyor Belt */
    .conveyor {
      background: #111;
      border: 2px solid var(--color-white);
      padding: var(--space-lg);
      margin-bottom: var(--space-xl);
      position: relative;
      overflow: hidden;
    }

    .conveyor__title {
      font-family: var(--font-mono);
      font-size: 0.625rem;
      color: var(--color-grey);
      letter-spacing: 0.2em;
      margin-bottom: var(--space-md);
    }

    .conveyor__belt {
      position: relative;
      height: 160px;
    }

    .conveyor__track {
      position: absolute;
      top: 50%;
      left: 0;
      right: 0;
      height: 4px;
      background: repeating-linear-gradient(
        90deg,
        var(--color-grey) 0px,
        var(--color-grey) 20px,
        transparent 20px,
        transparent 30px
      );
      animation: conveyorMove 2s linear infinite;
    }

    @keyframes conveyorMove {
      from { background-position: 0 0; }
      to { background-position: 30px 0; }
    }

    .conveyor__stages {
      display: flex;
      justify-content: space-between;
      position: relative;
      z-index: 1;
    }

    .conveyor__stage {
      text-align: center;
      width: 80px;
    }

    .conveyor__stage-icon {
      width: 50px;
      height: 50px;
      margin: 0 auto var(--space-xs);
      background: var(--color-black);
      border: 2px solid var(--color-white);
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: var(--font-mono);
      font-size: 0.75rem;
      color: var(--color-white);
    }

    .conveyor__stage-name {
      font-family: var(--font-mono);
      font-size: 0.5rem;
      color: var(--color-grey);
      letter-spacing: 0.05em;
    }

    .conveyor__jobs {
      position: absolute;
      top: 70px;
      left: 0;
      right: 0;
      height: 60px;
    }

    .conveyor__job {
      position: absolute;
      background: var(--color-yellow);
      color: var(--color-black);
      padding: var(--space-xs) var(--space-sm);
      font-family: var(--font-mono);
      font-size: 0.625rem;
      animation: jobBounce 0.5s ease-out;
      transform: translateX(-50%);
    }

    .conveyor__job--complete {
      background: #00cc66;
      color: white;
    }

    .conveyor__job--error {
      background: #ff4444;
      color: white;
    }

    .conveyor__job-name {
      font-weight: bold;
      white-space: nowrap;
    }

    .conveyor__job-stage {
      font-size: 0.5rem;
      opacity: 0.8;
    }

    @keyframes jobBounce {
      0% { transform: translateX(-50%) translateY(-20px); opacity: 0; }
      100% { transform: translateX(-50%) translateY(0); opacity: 1; }
    }

    .conveyor__empty {
      text-align: center;
      color: var(--color-grey);
      font-family: var(--font-mono);
      font-size: 0.75rem;
      padding-top: var(--space-md);
    }

    /* Activity Feed */
    .activity-feed {
      background: #111;
      border: 2px solid var(--color-white);
    }

    .activity-feed__header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: var(--space-md);
      border-bottom: 2px solid var(--color-white);
    }

    .activity-feed__title {
      font-family: var(--font-mono);
      font-size: 0.625rem;
      color: var(--color-grey);
      letter-spacing: 0.2em;
      margin: 0;
    }

    .activity-feed__filters {
      display: flex;
      gap: var(--space-xs);
    }

    .filter-btn {
      background: transparent;
      border: 1px solid var(--color-grey);
      color: var(--color-grey);
      font-family: var(--font-mono);
      font-size: 0.5rem;
      padding: var(--space-xs) var(--space-sm);
      cursor: pointer;
      letter-spacing: 0.1em;
    }

    .filter-btn:hover {
      border-color: var(--color-white);
      color: var(--color-white);
    }

    .filter-btn--active {
      background: var(--color-yellow);
      border-color: var(--color-yellow);
      color: var(--color-black);
    }

    .activity-feed__list {
      max-height: 400px;
      overflow-y: auto;
    }

    .activity-feed__loading,
    .activity-feed__empty {
      padding: var(--space-xl);
      text-align: center;
      color: var(--color-grey);
      font-family: var(--font-mono);
      font-size: 0.75rem;
    }

    .activity-feed__loading {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--space-sm);
    }

    .activity-item {
      display: flex;
      align-items: flex-start;
      gap: var(--space-sm);
      padding: var(--space-sm) var(--space-md);
      border-bottom: 1px solid #222;
      animation: fadeIn 0.3s ease-out;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(-10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .activity-item__icon {
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.75rem;
      color: var(--color-grey);
      flex-shrink: 0;
    }

    .activity-item--success .activity-item__icon { color: var(--color-yellow); }
    .activity-item--error .activity-item__icon { color: #ff4444; }
    .activity-item--warn .activity-item__icon { color: #ffaa00; }

    .activity-item__content {
      flex: 1;
      min-width: 0;
    }

    .activity-item__message {
      display: block;
      color: var(--color-white);
      font-size: 0.8125rem;
    }

    .activity-item__job {
      display: block;
      color: var(--color-grey);
      font-family: var(--font-mono);
      font-size: 0.625rem;
      margin-top: 2px;
    }

    .activity-item__time {
      color: var(--color-grey);
      font-family: var(--font-mono);
      font-size: 0.625rem;
      flex-shrink: 0;
    }

    /* Scrollbar */
    .activity-feed__list::-webkit-scrollbar {
      width: 8px;
    }

    .activity-feed__list::-webkit-scrollbar-track {
      background: #111;
    }

    .activity-feed__list::-webkit-scrollbar-thumb {
      background: var(--color-grey);
    }

    .activity-feed__list::-webkit-scrollbar-thumb:hover {
      background: var(--color-white);
    }

    /* Mobile */
    @media (max-width: 768px) {
      .factory-floor__stats {
        grid-template-columns: repeat(2, 1fr);
      }

      .conveyor__stages {
        overflow-x: auto;
        justify-content: flex-start;
        gap: var(--space-md);
        padding-bottom: var(--space-sm);
      }

      .activity-feed__filters {
        flex-wrap: wrap;
      }
    }
  `;

  document.head.appendChild(styles);
}
