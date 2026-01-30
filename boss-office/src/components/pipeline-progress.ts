// Pipeline Progress Component
// Shows real-time factory processing status with stages and estimated time

import type { JobStatus } from '../types/index.ts';

// Pipeline stages in order
export const PIPELINE_STAGES = [
  { id: 'secretary', name: 'SECRETARY', description: 'Analyzing request' },
  { id: 'templateDecider', name: 'TEMPLATE', description: 'Selecting template' },
  { id: 'toolBuilder', name: 'BUILDING', description: 'Generating tool' },
  { id: 'qaDepartment', name: 'QA CHECK', description: 'Quality review' },
  { id: 'complete', name: 'COMPLETE', description: 'Ready for review' }
] as const;

// Average times per stage (in seconds) - used for estimation
const STAGE_TIMES = {
  secretary: 5,
  templateDecider: 4,
  toolBuilder: 45,
  qaDepartment: 5,
  feedbackApplier: 25,
  revision: 30
};

// Total estimated time for full pipeline (without revisions)
const BASE_PIPELINE_TIME = 60; // seconds

// Interface for progress state
export interface PipelineState {
  currentStage: number;
  stageName: string;
  estimatedTimeLeft: number;
  progress: number;
  isProcessing: boolean;
  startedAt: number | null;
}

// Get pipeline state from job status
export function getPipelineState(status: JobStatus, createdAt?: string): PipelineState {
  const startedAt = createdAt ? new Date(createdAt).getTime() : null;
  const elapsedSeconds = startedAt ? Math.floor((Date.now() - startedAt) / 1000) : 0;

  switch (status) {
    case 'SENT':
    case 'PROCESSING':
      return {
        currentStage: 0,
        stageName: 'PROCESSING',
        estimatedTimeLeft: Math.max(0, BASE_PIPELINE_TIME - elapsedSeconds),
        progress: Math.min(95, Math.floor((elapsedSeconds / BASE_PIPELINE_TIME) * 100)),
        isProcessing: true,
        startedAt
      };
    case 'QA_IN_PROGRESS':
      return {
        currentStage: 3,
        stageName: 'QA CHECK',
        estimatedTimeLeft: Math.max(0, 10 - (elapsedSeconds - 50)),
        progress: 80,
        isProcessing: true,
        startedAt
      };
    case 'READY_FOR_REVIEW':
      return {
        currentStage: 4,
        stageName: 'COMPLETE',
        estimatedTimeLeft: 0,
        progress: 100,
        isProcessing: false,
        startedAt
      };
    case 'QA_FAILED':
      return {
        currentStage: 3,
        stageName: 'QA FAILED',
        estimatedTimeLeft: 0,
        progress: 100,
        isProcessing: false,
        startedAt
      };
    default:
      return {
        currentStage: 0,
        stageName: status,
        estimatedTimeLeft: 0,
        progress: 0,
        isProcessing: false,
        startedAt
      };
  }
}

// Render the pipeline progress bar
export function renderPipelineProgress(state: PipelineState): string {
  if (!state.isProcessing && state.progress === 0) {
    return '';
  }

  const stageIndicators = PIPELINE_STAGES.map((stage, index) => {
    let statusClass = 'pipeline__stage--pending';
    if (index < state.currentStage) {
      statusClass = 'pipeline__stage--complete';
    } else if (index === state.currentStage && state.isProcessing) {
      statusClass = 'pipeline__stage--active';
    }

    return `
      <div class="pipeline__stage ${statusClass}" title="${stage.description}">
        <div class="pipeline__stage-dot"></div>
        <span class="pipeline__stage-name">${stage.name}</span>
      </div>
    `;
  }).join('');

  const timeDisplay = state.isProcessing && state.estimatedTimeLeft > 0
    ? `~${formatTimeLeft(state.estimatedTimeLeft)} remaining`
    : state.isProcessing
    ? 'Processing...'
    : '';

  return `
    <div class="pipeline">
      <div class="pipeline__bar">
        <div class="pipeline__fill" style="width: ${state.progress}%"></div>
      </div>
      <div class="pipeline__stages">
        ${stageIndicators}
      </div>
      ${timeDisplay ? `<div class="pipeline__time">${timeDisplay}</div>` : ''}
    </div>
  `;
}

// Format time left as human readable
function formatTimeLeft(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
}

// Render compact progress for job card
export function renderCompactProgress(status: JobStatus, createdAt?: string): string {
  const state = getPipelineState(status, createdAt);

  if (!state.isProcessing) {
    return '';
  }

  return `
    <div class="pipeline-compact">
      <div class="pipeline-compact__bar">
        <div class="pipeline-compact__fill pipeline-compact__fill--animated" style="width: ${state.progress}%"></div>
      </div>
      <span class="pipeline-compact__status">${state.stageName}</span>
      ${state.estimatedTimeLeft > 0 ? `<span class="pipeline-compact__time">~${formatTimeLeft(state.estimatedTimeLeft)}</span>` : ''}
    </div>
  `;
}
