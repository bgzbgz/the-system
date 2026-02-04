/**
 * Tool Serving Routes
 *
 * Dynamic tool serving with dependency injection (locked boxes)
 */

import express, { Request, Response } from 'express';
import { getDependenciesWithValues, DependencyWithValue } from '../db/supabase/services/dependencyService';
import { hasToolAccess, markToolAsInProgress } from '../db/supabase/services/progressService';
import { getToolHtml } from '../db/supabase/services/jobService';

/**
 * Generate HTML for a single locked box (T028, T029)
 * Implements FR-008: Display dependency values with source sprint labels
 * Implements FR-022: Show locked state for incomplete dependencies
 * Implements FR-023: Source sprint labels for dependencies
 */
function generateLockedBoxHTML(dep: DependencyWithValue): string {
  const isLocked = dep.is_locked;
  const statusClass = isLocked ? 'locked-box-locked' : 'locked-box-unlocked';
  const lockIcon = isLocked ? '🔒' : '✓';
  const sprintLabel = dep.source_sprint_number ? `Sprint ${dep.source_sprint_number}` : 'Previous Sprint';

  // Format value for display
  let displayValue = '';
  if (isLocked) {
    displayValue = `<span class="locked-placeholder">Complete ${sprintLabel} to unlock this data</span>`;
  } else {
    // Format value based on type
    const value = dep.value;
    if (typeof value === 'string') {
      displayValue = `<div class="locked-box-value">${escapeHtml(value)}</div>`;
    } else if (Array.isArray(value)) {
      displayValue = `<ul class="locked-box-list">${value.map(item => `<li>${escapeHtml(String(item))}</li>`).join('')}</ul>`;
    } else if (typeof value === 'object' && value !== null) {
      displayValue = `<pre class="locked-box-json">${escapeHtml(JSON.stringify(value, null, 2))}</pre>`;
    } else {
      displayValue = `<div class="locked-box-value">${escapeHtml(String(value))}</div>`;
    }
  }

  return `
    <div class="locked-box ${statusClass}" data-field-id="${dep.field_id}">
      <div class="locked-box-header">
        <span class="lock-icon">${lockIcon}</span>
        <span class="locked-box-label">${dep.label}</span>
        <span class="locked-box-source">${sprintLabel}</span>
      </div>
      <div class="locked-box-content">
        ${displayValue}
      </div>
    </div>
  `;
}

/**
 * Generate CSS for locked boxes
 */
function generateLockedBoxCSS(): string {
  return `
    <style>
      .locked-boxes-container {
        margin: 20px 0;
        padding: 20px;
        background: #f8f9fa;
        border-radius: 8px;
      }
      .locked-boxes-header {
        font-size: 18px;
        font-weight: 600;
        margin-bottom: 16px;
        color: #2c3e50;
      }
      .locked-box {
        margin-bottom: 16px;
        padding: 16px;
        border-radius: 6px;
        border: 2px solid;
        transition: all 0.3s ease;
      }
      .locked-box-unlocked {
        background: white;
        border-color: #27ae60;
      }
      .locked-box-locked {
        background: #fff3cd;
        border-color: #ffc107;
        opacity: 0.8;
      }
      .locked-box-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 12px;
        font-weight: 600;
      }
      .lock-icon {
        font-size: 18px;
      }
      .locked-box-label {
        flex: 1;
        color: #2c3e50;
        font-size: 14px;
      }
      .locked-box-source {
        font-size: 12px;
        color: #7f8c8d;
        background: #ecf0f1;
        padding: 2px 8px;
        border-radius: 12px;
      }
      .locked-box-content {
        color: #34495e;
        font-size: 14px;
        line-height: 1.5;
      }
      .locked-placeholder {
        font-style: italic;
        color: #95a5a6;
      }
      .locked-box-value {
        padding: 8px;
        background: #f8f9fa;
        border-radius: 4px;
      }
      .locked-box-list {
        margin: 0;
        padding-left: 20px;
      }
      .locked-box-json {
        background: #2c3e50;
        color: #ecf0f1;
        padding: 12px;
        border-radius: 4px;
        overflow-x: auto;
        font-size: 12px;
      }
    </style>
  `;
}

/**
 * Generate HTML for all locked boxes (T028)
 */
function generateLockedBoxesHTML(dependencies: DependencyWithValue[]): string {
  if (dependencies.length === 0) {
    return '';
  }

  const boxesHTML = dependencies.map(dep => generateLockedBoxHTML(dep)).join('\n');
  const lockedCount = dependencies.filter(d => d.is_locked).length;
  const unlockedCount = dependencies.length - lockedCount;

  const headerText = lockedCount > 0
    ? `Your Progress: ${unlockedCount} of ${dependencies.length} data points unlocked`
    : `All ${dependencies.length} data points from previous sprints`;

  return `
    ${generateLockedBoxCSS()}
    <div class="locked-boxes-container">
      <div class="locked-boxes-header">${headerText}</div>
      ${boxesHTML}
    </div>
  `;
}

/**
 * Simple HTML escape to prevent XSS
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

const router = express.Router();

/**
 * GET /tools/:slug/dependencies
 *
 * Get dependencies configuration and values for a tool
 * Implements FR-016: API endpoint to retrieve all dependencies with data
 */
router.get('/tools/:slug/dependencies', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const { user_id } = req.query;

    if (!user_id) {
      return res.status(400).json({
        error: 'Missing required parameter: user_id',
      });
    }

    const startTime = Date.now();

    const dependencyData = await getDependenciesWithValues(slug, user_id as string);

    const duration_ms = Date.now() - startTime;

    // FR-026: Log dependency fetch (basic observability)
    console.log(
      JSON.stringify({
        operation: 'dependency_fetch',
        user_id,
        tool_slug: slug,
        dependencies_count: dependencyData.dependencies.length,
        satisfied_count: dependencyData.meta.satisfiedCount,
        access_allowed: dependencyData.access.allowed,
        status: 'success',
        duration_ms,
      })
    );

    res.status(200).json({
      success: true,
      data: dependencyData,
      duration_ms,
    });
  } catch (error: any) {
    console.error('Get dependencies error:', error);

    // FR-026: Log failure
    console.log(
      JSON.stringify({
        operation: 'dependency_fetch',
        user_id: req.query.user_id,
        tool_slug: req.params.slug,
        status: 'failure',
        error: error.message,
      })
    );

    res.status(500).json({
      error: 'Failed to get dependencies',
      message: error.message,
    });
  }
});

/**
 * GET /tools/:slug
 *
 * Serve tool HTML with dependency data injected
 * Implements FR-015: Dynamic tool serving from backend
 * Implements FR-009: Prevent access if required dependencies incomplete
 * Implements FR-027: Tool serving with data injection
 */
router.get('/tools/:slug', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const { user_id } = req.query;

    if (!user_id) {
      return res.status(400).json({
        error: 'Missing required parameter: user_id',
      });
    }

    const userId = user_id as string;

    // Check if user has access to this tool
    const hasAccess = await hasToolAccess(userId, slug);

    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You must complete required prerequisite sprints before accessing this tool',
        tool_slug: slug,
      });
    }

    // Get dependencies with values
    const dependencyData = await getDependenciesWithValues(slug, userId);

    // FR-009: Check if required dependencies are satisfied
    if (!dependencyData.access.allowed) {
      return res.status(403).json({
        error: 'Prerequisites not met',
        message: 'Required dependencies are not completed',
        tool_slug: slug,
        missing_required: dependencyData.access.missingRequired,
        dependencies: dependencyData.dependencies.filter(d => d.is_required && d.is_locked),
      });
    }

    // Mark tool as in_progress if not already
    await markToolAsInProgress(userId, slug);

    // T028: Generate locked box HTML for dependencies
    // T029: Include locked state UI for incomplete dependencies
    const lockedBoxesHTML = generateLockedBoxesHTML(dependencyData.dependencies);

    // Return tool data with rendered locked boxes HTML
    // Frontend can inject this HTML into the tool's dependency container
    res.status(200).json({
      success: true,
      tool_slug: slug,
      user_id: userId,
      access: {
        allowed: true,
        status: 'in_progress',
      },
      dependencies: dependencyData.dependencies,
      meta: dependencyData.meta,
      // T028, T029: Rendered HTML for locked boxes (ready to inject)
      locked_boxes_html: lockedBoxesHTML,
      // Optional: Get tool HTML from job_artifacts and inject dependencies server-side
      // This would require mapping tool_slug -> job_id
      // html: injectedToolHTML,
    });
  } catch (error: any) {
    console.error('Serve tool error:', error);
    res.status(500).json({
      error: 'Failed to serve tool',
      message: error.message,
    });
  }
});

/**
 * GET /tools/:slug/access-check
 *
 * Quick access check for a tool (lighter than full tool serving)
 * Implements FR-009: Validate tool access
 * Implements SC-010: 1 second feedback for locked sprint access
 */
router.get('/tools/:slug/access-check', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const { user_id } = req.query;

    if (!user_id) {
      return res.status(400).json({
        error: 'Missing required parameter: user_id',
      });
    }

    const userId = user_id as string;
    const startTime = Date.now();

    // Check tool access
    const hasAccess = await hasToolAccess(userId, slug);

    if (!hasAccess) {
      return res.status(200).json({
        success: true,
        access: {
          allowed: false,
          reason: 'Tool is locked. Complete previous sprints to unlock.',
        },
        duration_ms: Date.now() - startTime,
      });
    }

    // Check dependencies
    const dependencyData = await getDependenciesWithValues(slug, userId);

    const duration_ms = Date.now() - startTime;

    res.status(200).json({
      success: true,
      access: {
        allowed: dependencyData.access.allowed,
        reason: dependencyData.access.allowed
          ? 'Access granted'
          : 'Required dependencies not completed',
        missing_required: dependencyData.access.missingRequired,
      },
      dependencies_summary: {
        total: dependencyData.meta.totalDependencies,
        required: dependencyData.meta.requiredCount,
        satisfied: dependencyData.meta.satisfiedCount,
      },
      duration_ms,
    });
  } catch (error: any) {
    console.error('Access check error:', error);
    res.status(500).json({
      error: 'Failed to check access',
      message: error.message,
    });
  }
});

export default router;
