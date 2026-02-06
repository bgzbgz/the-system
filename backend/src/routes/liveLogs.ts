/**
 * Live Logs Routes
 * API for the Factory Floor live view
 */

import { Router, Request, Response } from 'express';
import { getLogs, getActiveJobs, LogCategory } from '../services/liveLogBuffer';

const router = Router();

/**
 * GET /api/live/logs
 * Get recent activity logs for the factory floor
 *
 * Query params:
 * - limit: Max logs to return (default 50, max 100)
 * - since: ISO timestamp to get logs after
 * - category: Filter by category (job, pipeline, ai, deploy, system, monitor)
 * - jobId: Filter by job ID
 */
router.get('/logs', (req: Request, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const since = req.query.since ? new Date(req.query.since as string) : undefined;
  const category = req.query.category as LogCategory | undefined;
  const jobId = req.query.jobId as string | undefined;

  const logs = getLogs({ limit, since, category, jobId });

  res.json({
    success: true,
    logs,
    count: logs.length,
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /api/live/active-jobs
 * Get jobs with recent activity (for conveyor belt)
 */
router.get('/active-jobs', (_req: Request, res: Response) => {
  const jobs = getActiveJobs();

  res.json({
    success: true,
    jobs,
    count: jobs.length,
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /api/live/stats
 * Get factory statistics
 */
router.get('/stats', (_req: Request, res: Response) => {
  const allLogs = getLogs({ limit: 200 });
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  const recentLogs = allLogs.filter(l => l.timestamp > fiveMinutesAgo);

  const stats = {
    totalLogs: allLogs.length,
    recentActivity: recentLogs.length,
    activeJobs: getActiveJobs().length,
    byCategory: {
      job: recentLogs.filter(l => l.category === 'job').length,
      pipeline: recentLogs.filter(l => l.category === 'pipeline').length,
      ai: recentLogs.filter(l => l.category === 'ai').length,
      deploy: recentLogs.filter(l => l.category === 'deploy').length,
      system: recentLogs.filter(l => l.category === 'system').length
    },
    byLevel: {
      info: recentLogs.filter(l => l.level === 'info').length,
      success: recentLogs.filter(l => l.level === 'success').length,
      warn: recentLogs.filter(l => l.level === 'warn').length,
      error: recentLogs.filter(l => l.level === 'error').length
    }
  };

  res.json({
    success: true,
    stats,
    timestamp: new Date().toISOString()
  });
});

export default router;
