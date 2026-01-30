/**
 * Audit Routes
 * Spec: 016-backend-api
 * Per contracts/audit.yaml
 *
 * Endpoints:
 * - GET /api/audit - List all audit events with optional job_id filter
 * - GET /api/audit/:jobId - Get audit history for specific job
 */

import { Router, Request, Response } from 'express';

import { queryEvents, getJobAuditHistory, jobHasAuditEntries } from '../services/audit';
import { getAllAuditLogs, hasAuditEntries } from '../services/stateMachine';
import { getJob } from '../services/jobStore';
import logger from '../utils/logger';
import {
  sendSuccess,
  sendSuccessWithMeta,
  sendNotFound,
  sendValidationError
} from '../utils/response';

// ========== ROUTER ==========

const router = Router();

// ========== ROUTES ==========

/**
 * GET /api/audit
 * List all audit events with optional job_id filter and pagination (FR-016)
 *
 * Query Parameters:
 * - job_id: Filter by specific job (optional)
 * - limit: Max entries per page (default 50, max 100)
 * - offset: Skip entries for pagination (default 0)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const jobId = req.query.job_id as string | undefined;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    // Validate limit
    if (limit < 1 || limit > 100) {
      return sendValidationError(res, 'Limit must be between 1 and 100');
    }

    // Validate offset
    if (offset < 0) {
      return sendValidationError(res, 'Offset must be non-negative');
    }

    // Use stateMachine's getAllAuditLogs for compatibility with existing audit entries
    const result = await getAllAuditLogs({
      jobId,
      limit,
      offset
    });

    logger.info('Audit list request', {
      job_id: jobId || 'all',
      total: result.meta.total,
      returned: result.data.length
    });

    // Return in the format expected by contracts/audit.yaml
    res.json({
      data: result.data,
      meta: result.meta
    });

  } catch (error) {
    logger.logError('Error listing audit events', error as Error);
    return res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * GET /api/audit/:jobId
 * Get audit history for a specific job (FR-016)
 * Returns events in chronological order (oldest first)
 */
router.get('/:jobId', async (req: Request, res: Response) => {
  const { jobId } = req.params;

  try {
    // Check if job exists
    const job = getJob(jobId);

    // Also check audit entries for jobs that may have been deleted
    const hasEntries = await hasAuditEntries(jobId);

    if (!job && !hasEntries) {
      return sendNotFound(res, 'Job not found');
    }

    // Get audit log for this job using stateMachine's getAuditLog
    const result = await getAllAuditLogs({
      jobId,
      limit: 100, // Get all entries for single job
      offset: 0
    });

    // Sort chronologically (oldest first) for job-specific history
    const sortedData = [...result.data].sort((a, b) => {
      return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    });

    logger.info('Job audit history request', {
      job_id: jobId,
      total: result.meta.total
    });

    // Return in the format expected by contracts/audit.yaml
    res.json({
      data: sortedData,
      meta: {
        total: result.meta.total,
        limit: result.meta.limit,
        offset: 0
      }
    });

  } catch (error) {
    logger.logError('Error fetching job audit history', error as Error, { job_id: jobId });
    return res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

export default router;
