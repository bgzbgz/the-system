/**
 * Stale Job Monitor Service
 * Automatically fails jobs that are stuck in transitional states
 *
 * Prevents jobs from spinning indefinitely by:
 * - Checking for stale jobs every 2 minutes
 * - Failing SENT jobs after 5 minutes (factory never picked up)
 * - Failing PROCESSING jobs after 15 minutes (processing timed out)
 * - Failing DEPLOYING jobs after 10 minutes (deployment timed out)
 */

import { JobStatus, Job } from '../models/job';
import { jobService } from '../db/supabase';
import { transitionJob, canTransition } from './stateMachine';
import { ActorType } from '../models/auditLog';
import logger from '../utils/logger';

// ========== CONFIGURATION ==========

/** How often to check for stale jobs (ms) */
const CHECK_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes

/** Timeout thresholds per status (ms) */
const STALE_THRESHOLDS: Record<string, { timeout: number; targetStatus: JobStatus; reason: string }> = {
  [JobStatus.SENT]: {
    timeout: 5 * 60 * 1000, // 5 minutes
    targetStatus: JobStatus.FACTORY_FAILED,
    reason: 'Factory never picked up job (timeout after 5 minutes)'
  },
  [JobStatus.PROCESSING]: {
    timeout: 15 * 60 * 1000, // 15 minutes
    targetStatus: JobStatus.FACTORY_FAILED,
    reason: 'Processing timed out after 15 minutes'
  },
  [JobStatus.DEPLOYING]: {
    timeout: 10 * 60 * 1000, // 10 minutes
    targetStatus: JobStatus.DEPLOY_FAILED,
    reason: 'Deployment timed out after 10 minutes'
  }
};

// ========== STATE ==========

let monitorInterval: NodeJS.Timeout | null = null;
let isRunning = false;

// ========== FUNCTIONS ==========

/**
 * Check for and handle stale jobs
 */
async function checkStaleJobs(): Promise<void> {
  if (isRunning) {
    logger.info('[StaleJobMonitor] Previous check still running, skipping');
    return;
  }

  isRunning = true;
  const now = Date.now();

  try {
    // Get all jobs in transitional states
    const transitionalStatuses = Object.keys(STALE_THRESHOLDS);

    for (const status of transitionalStatuses) {
      const config = STALE_THRESHOLDS[status];

      try {
        // Query jobs in this status (cast to any to handle Supabase vs model type differences)
        const jobs = await jobService.getJobsByStatus(status as any);

        for (const job of jobs) {
          // Calculate how long the job has been in this state
          const updatedAt = new Date(job.updated_at || job.created_at).getTime();
          const ageMs = now - updatedAt;

          if (ageMs > config.timeout) {
            // Job is stale - fail it
            const jobId = (job as any).job_id || job.id;
            logger.warn('[StaleJobMonitor] Found stale job', {
              job_id: jobId,
              status: job.status,
              age_minutes: Math.round(ageMs / 60000),
              threshold_minutes: Math.round(config.timeout / 60000)
            });

            await failStaleJob(jobId, job.status as JobStatus, config.targetStatus, config.reason);
          }
        }
      } catch (error) {
        logger.logError(`[StaleJobMonitor] Error checking ${status} jobs`, error as Error);
      }
    }
  } catch (error) {
    logger.logError('[StaleJobMonitor] Error in stale job check', error as Error);
  } finally {
    isRunning = false;
  }
}

/**
 * Fail a stale job with appropriate status and reason
 */
async function failStaleJob(
  jobId: string,
  currentStatus: JobStatus,
  targetStatus: JobStatus,
  reason: string
): Promise<void> {
  try {
    // Get the full job
    const job = await jobService.getJob(jobId);
    if (!job) {
      logger.warn('[StaleJobMonitor] Job not found for stale check', { job_id: jobId });
      return;
    }

    // Verify status hasn't changed
    if (job.status !== currentStatus) {
      logger.info('[StaleJobMonitor] Job status changed, skipping', {
        job_id: jobId,
        expected: currentStatus,
        actual: job.status
      });
      return;
    }

    // Check if transition is valid
    if (!canTransition(currentStatus, targetStatus)) {
      logger.warn('[StaleJobMonitor] Invalid transition for stale job', {
        job_id: jobId,
        from: currentStatus,
        to: targetStatus
      });
      return;
    }

    // Execute transition (cast job to any to handle type differences)
    const result = await transitionJob(
      job as any,
      targetStatus,
      ActorType.SYSTEM,
      reason
    );

    if (result.success) {
      // Update job with error message
      await jobService.updateJob(jobId, {
        status: targetStatus as any,
        workflow_error: reason
      });

      logger.info('[StaleJobMonitor] Stale job failed', {
        job_id: jobId,
        from: currentStatus,
        to: targetStatus,
        reason
      });
    } else {
      logger.warn('[StaleJobMonitor] Failed to transition stale job', {
        job_id: jobId,
        error: result.error
      });
    }
  } catch (error) {
    logger.logError('[StaleJobMonitor] Error failing stale job', error as Error, { job_id: jobId });
  }
}

/**
 * Start the stale job monitor
 */
export function startStaleJobMonitor(): void {
  if (monitorInterval) {
    logger.info('[StaleJobMonitor] Already running');
    return;
  }

  logger.info('[StaleJobMonitor] Starting stale job monitor', {
    check_interval_minutes: CHECK_INTERVAL_MS / 60000,
    thresholds: Object.entries(STALE_THRESHOLDS).map(([status, config]) => ({
      status,
      timeout_minutes: config.timeout / 60000
    }))
  });

  // Run immediately on start
  checkStaleJobs();

  // Then run on interval
  monitorInterval = setInterval(checkStaleJobs, CHECK_INTERVAL_MS);
}

/**
 * Stop the stale job monitor
 */
export function stopStaleJobMonitor(): void {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
    logger.info('[StaleJobMonitor] Stopped');
  }
}

/**
 * Check if the monitor is running
 */
export function isMonitorRunning(): boolean {
  return monitorInterval !== null;
}

export default {
  start: startStaleJobMonitor,
  stop: stopStaleJobMonitor,
  isRunning: isMonitorRunning
};
