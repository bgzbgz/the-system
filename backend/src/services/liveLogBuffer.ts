/**
 * Live Log Buffer Service
 * Stores recent activity logs for the factory floor view
 *
 * Captures meaningful events for real-time visualization
 */

// ========== TYPES ==========

export type LogLevel = 'info' | 'warn' | 'error' | 'success';
export type LogCategory =
  | 'job'        // Job lifecycle events
  | 'pipeline'   // Pipeline stage events
  | 'ai'         // AI call events
  | 'deploy'     // Deployment events
  | 'system'     // System events
  | 'monitor';   // Stale job monitor events

export interface LiveLogEntry {
  id: string;
  timestamp: Date;
  level: LogLevel;
  category: LogCategory;
  message: string;
  jobId?: string;
  jobName?: string;
  stage?: string;
  details?: Record<string, unknown>;
}

// ========== CONFIGURATION ==========

/** Maximum logs to keep in buffer */
const MAX_BUFFER_SIZE = 200;

/** Log entry counter for unique IDs */
let logCounter = 0;

// ========== BUFFER ==========

const logBuffer: LiveLogEntry[] = [];

// ========== FUNCTIONS ==========

/**
 * Add a log entry to the buffer
 */
export function addLog(entry: Omit<LiveLogEntry, 'id' | 'timestamp'>): LiveLogEntry {
  const fullEntry: LiveLogEntry = {
    ...entry,
    id: `log_${++logCounter}_${Date.now()}`,
    timestamp: new Date()
  };

  logBuffer.unshift(fullEntry); // Add to front (newest first)

  // Trim buffer if too large
  if (logBuffer.length > MAX_BUFFER_SIZE) {
    logBuffer.pop();
  }

  return fullEntry;
}

/**
 * Get recent logs, optionally filtered
 */
export function getLogs(options?: {
  limit?: number;
  since?: Date;
  category?: LogCategory;
  jobId?: string;
}): LiveLogEntry[] {
  let logs = [...logBuffer];
  const { limit = 50, since, category, jobId } = options || {};

  if (since) {
    logs = logs.filter(log => log.timestamp > since);
  }

  if (category) {
    logs = logs.filter(log => log.category === category);
  }

  if (jobId) {
    logs = logs.filter(log => log.jobId === jobId);
  }

  return logs.slice(0, limit);
}

/**
 * Get active jobs (jobs with recent activity)
 */
export function getActiveJobs(): Array<{
  jobId: string;
  jobName: string;
  lastStage?: string;
  lastActivity: Date;
  status: 'processing' | 'complete' | 'error';
}> {
  const jobMap = new Map<string, {
    jobId: string;
    jobName: string;
    lastStage?: string;
    lastActivity: Date;
    status: 'processing' | 'complete' | 'error';
  }>();

  // Process logs to extract active jobs (last 5 minutes)
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

  for (const log of logBuffer) {
    if (log.timestamp < fiveMinutesAgo) continue;
    if (!log.jobId) continue;

    const existing = jobMap.get(log.jobId);
    if (!existing || log.timestamp > existing.lastActivity) {
      jobMap.set(log.jobId, {
        jobId: log.jobId,
        jobName: log.jobName || log.jobId.slice(0, 8),
        lastStage: log.stage || existing?.lastStage,
        lastActivity: log.timestamp,
        status: log.level === 'error' ? 'error' :
                log.message.includes('complete') || log.message.includes('deployed') ? 'complete' :
                'processing'
      });
    }
  }

  return Array.from(jobMap.values())
    .sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());
}

/**
 * Clear the log buffer (for testing)
 */
export function clearLogs(): void {
  logBuffer.length = 0;
}

// ========== CONVENIENCE LOGGERS ==========

export const liveLog = {
  // Job events
  jobCreated: (jobId: string, jobName: string) => addLog({
    level: 'success',
    category: 'job',
    message: `New job created: ${jobName}`,
    jobId,
    jobName
  }),

  jobStarted: (jobId: string, jobName: string) => addLog({
    level: 'info',
    category: 'job',
    message: `Factory started processing: ${jobName}`,
    jobId,
    jobName,
    stage: 'start'
  }),

  jobCompleted: (jobId: string, jobName: string) => addLog({
    level: 'success',
    category: 'job',
    message: `Job ready for review: ${jobName}`,
    jobId,
    jobName,
    stage: 'complete'
  }),

  jobFailed: (jobId: string, jobName: string, error: string) => addLog({
    level: 'error',
    category: 'job',
    message: `Job failed: ${jobName} - ${error}`,
    jobId,
    jobName
  }),

  // Pipeline events
  stageStarted: (jobId: string, jobName: string, stage: string) => addLog({
    level: 'info',
    category: 'pipeline',
    message: `${stage} started`,
    jobId,
    jobName,
    stage
  }),

  stageCompleted: (jobId: string, jobName: string, stage: string, durationMs?: number) => addLog({
    level: 'success',
    category: 'pipeline',
    message: `${stage} completed${durationMs ? ` (${(durationMs/1000).toFixed(1)}s)` : ''}`,
    jobId,
    jobName,
    stage,
    details: durationMs ? { duration_ms: durationMs } : undefined
  }),

  stageFailed: (jobId: string, jobName: string, stage: string, error: string) => addLog({
    level: 'error',
    category: 'pipeline',
    message: `${stage} failed: ${error}`,
    jobId,
    jobName,
    stage
  }),

  // AI events
  aiCallStarted: (jobId: string, jobName: string, model: string) => addLog({
    level: 'info',
    category: 'ai',
    message: `AI thinking (${model})...`,
    jobId,
    jobName,
    details: { model }
  }),

  aiCallCompleted: (jobId: string, jobName: string, model: string, tokens?: number) => addLog({
    level: 'success',
    category: 'ai',
    message: `AI response received${tokens ? ` (${tokens} tokens)` : ''}`,
    jobId,
    jobName,
    details: { model, tokens }
  }),

  // Deploy events
  deployStarted: (jobId: string, jobName: string) => addLog({
    level: 'info',
    category: 'deploy',
    message: `Deploying to GitHub Pages: ${jobName}`,
    jobId,
    jobName,
    stage: 'deploy'
  }),

  deployCompleted: (jobId: string, jobName: string, url: string) => addLog({
    level: 'success',
    category: 'deploy',
    message: `Deployed! ${url}`,
    jobId,
    jobName,
    stage: 'deploy',
    details: { url }
  }),

  deployFailed: (jobId: string, jobName: string, error: string) => addLog({
    level: 'error',
    category: 'deploy',
    message: `Deploy failed: ${error}`,
    jobId,
    jobName,
    stage: 'deploy'
  }),

  // System events
  system: (message: string, level: LogLevel = 'info') => addLog({
    level,
    category: 'system',
    message
  }),

  monitor: (message: string, level: LogLevel = 'info', jobId?: string) => addLog({
    level,
    category: 'monitor',
    message,
    jobId
  })
};

export default liveLog;
