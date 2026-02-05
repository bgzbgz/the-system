// PipelineVisualizer Component - Factory Stage Progress
// Feature: Boss Office Redesign

import type { PipelineStage, StageStatus, JobStatus } from '../types/index.ts';
import { PIPELINE_STAGES } from '../types/index.ts';

/**
 * Map job status to pipeline stage progress
 */
export function mapJobStatusToPipeline(jobStatus: JobStatus): PipelineStage[] {
  // Define which stages are complete based on job status
  const statusToStageMap: Record<JobStatus, { completed: string[]; active: string | null; failed?: string }> = {
    'DRAFT': { completed: [], active: null },
    'SENT': { completed: [], active: 'secretary' },
    'PROCESSING': { completed: ['secretary'], active: 'audience' },
    'QA_IN_PROGRESS': { completed: ['secretary', 'audience', 'examples', 'copy', 'builder', 'brand'], active: 'qa' },
    'QA_FAILED': { completed: ['secretary', 'audience', 'examples', 'copy', 'builder', 'brand'], active: null, failed: 'qa' },
    'READY_FOR_REVIEW': { completed: ['secretary', 'audience', 'examples', 'copy', 'builder', 'brand', 'qa'], active: 'review' },
    'REVISION_REQUESTED': { completed: ['secretary', 'audience', 'examples', 'copy'], active: 'builder' },
    'DEPLOYING': { completed: ['secretary', 'audience', 'examples', 'copy', 'builder', 'brand', 'qa', 'review'], active: null },
    'DEPLOYED': { completed: ['secretary', 'audience', 'examples', 'copy', 'builder', 'brand', 'qa', 'review'], active: null },
    'DEPLOY_FAILED': { completed: ['secretary', 'audience', 'examples', 'copy', 'builder', 'brand', 'qa'], active: null, failed: 'review' },
    'REJECTED': { completed: ['secretary', 'audience', 'examples', 'copy', 'builder', 'brand', 'qa'], active: null, failed: 'review' },
    'FAILED_SEND': { completed: [], active: null, failed: 'secretary' },
    'FACTORY_FAILED': { completed: ['secretary'], active: null, failed: 'builder' },
    'ESCALATED': { completed: ['secretary', 'audience', 'examples', 'copy', 'builder', 'brand', 'qa'], active: 'review' },
    'DEPLOY_REQUESTED': { completed: ['secretary', 'audience', 'examples', 'copy', 'builder', 'brand', 'qa', 'review'], active: null },
  };

  const mapping = statusToStageMap[jobStatus] || { completed: [], active: null };

  return PIPELINE_STAGES.map((stage) => {
    let status: StageStatus = 'pending';

    if (mapping.completed.includes(stage.id)) {
      status = 'completed';
    } else if (mapping.failed === stage.id) {
      status = 'failed';
    } else if (mapping.active === stage.id) {
      status = 'active';
    }

    return {
      ...stage,
      status,
    };
  });
}

interface PipelineVisualizerProps {
  stages: PipelineStage[];
  compact?: boolean;
  onStageClick?: (stageId: string) => void;
}

/**
 * Render the pipeline visualizer
 */
export function renderPipelineVisualizer(
  container: HTMLElement,
  props: PipelineVisualizerProps
): void {
  const { stages, compact = false, onStageClick } = props;

  container.innerHTML = `
    <div class="pipeline ${compact ? 'pipeline--compact' : ''}">
      <div class="pipeline__track">
        ${stages.map((stage, index) => {
          const isLast = index === stages.length - 1;
          const statusIcon = getStatusIcon(stage.status);
          const statusClass = `pipeline__stage--${stage.status}`;
          const clickable = onStageClick && (stage.status === 'completed' || stage.status === 'failed');

          return `
            <div class="pipeline__stage ${statusClass} ${clickable ? 'pipeline__stage--clickable' : ''}" data-stage-id="${stage.id}">
              <div class="pipeline__indicator">
                ${stage.status === 'active' ? `
                  <div class="pipeline__spinner"></div>
                ` : `
                  <span class="pipeline__icon">${statusIcon}</span>
                `}
              </div>
              <span class="pipeline__label">${stage.shortName}</span>
              ${!compact ? `<span class="pipeline__name">${stage.name}</span>` : ''}
            </div>
            ${!isLast ? `
              <div class="pipeline__connector ${stage.status === 'completed' ? 'pipeline__connector--completed' : ''}"></div>
            ` : ''}
          `;
        }).join('')}
      </div>

      ${!compact ? `
        <div class="pipeline__legend">
          <span class="pipeline__legend-item">
            <span class="pipeline__legend-icon pipeline__legend-icon--completed">✓</span> Completed
          </span>
          <span class="pipeline__legend-item">
            <span class="pipeline__legend-icon pipeline__legend-icon--active">▶</span> In Progress
          </span>
          <span class="pipeline__legend-item">
            <span class="pipeline__legend-icon pipeline__legend-icon--pending">○</span> Pending
          </span>
          <span class="pipeline__legend-item">
            <span class="pipeline__legend-icon pipeline__legend-icon--failed">✗</span> Failed
          </span>
        </div>
      ` : ''}
    </div>
  `;

  // Attach click handlers
  if (onStageClick) {
    const clickableStages = container.querySelectorAll<HTMLElement>('.pipeline__stage--clickable');
    clickableStages.forEach((el) => {
      el.addEventListener('click', () => {
        const stageId = el.dataset.stageId;
        if (stageId) onStageClick(stageId);
      });
    });
  }
}

/**
 * Get icon for stage status
 */
function getStatusIcon(status: StageStatus): string {
  switch (status) {
    case 'completed':
      return '✓';
    case 'active':
      return '▶';
    case 'failed':
      return '✗';
    case 'skipped':
      return '–';
    default:
      return '○';
  }
}

/**
 * Get stage by ID
 */
export function getStageById(stageId: string): typeof PIPELINE_STAGES[0] | undefined {
  return PIPELINE_STAGES.find((s) => s.id === stageId);
}

/**
 * Calculate progress percentage
 */
export function calculateProgress(stages: PipelineStage[]): number {
  const completed = stages.filter((s) => s.status === 'completed').length;
  return Math.round((completed / stages.length) * 100);
}
