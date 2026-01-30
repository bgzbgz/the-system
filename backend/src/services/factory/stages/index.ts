/**
 * Stage Registry
 * Spec: 021-tool-factory-engine
 *
 * Central export for all pipeline stages.
 */

import { secretaryStage } from './secretary';
import { toolBuilderStage } from './toolBuilder';
import { templateDeciderStage } from './templateDecider';
import { qaDepartmentStage } from './qaDepartment';
import { feedbackApplierStage } from './feedbackApplier';
// New enhanced stages
import { audienceProfilerStage } from './audienceProfiler';
import { exampleGeneratorStage } from './exampleGenerator';
import { copyWriterStage } from './copyWriter';
import { brandGuardianStage } from './brandGuardian';
import type { Stage, StageName } from '../types';

/**
 * All stages indexed by name
 */
export const stages: Partial<Record<StageName, Stage>> = {
  secretary: secretaryStage,
  toolBuilder: toolBuilderStage,
  templateDecider: templateDeciderStage,
  qaDepartment: qaDepartmentStage,
  feedbackApplier: feedbackApplierStage,
  // New enhanced stages
  audienceProfiler: audienceProfilerStage,
  exampleGenerator: exampleGeneratorStage,
  copyWriter: copyWriterStage,
  brandGuardian: brandGuardianStage
};

/**
 * Get a stage by name
 *
 * @param name - Stage identifier
 * @returns The stage implementation
 * @throws Error if stage not found
 */
export function getStage(name: StageName): Stage {
  const stage = stages[name];
  if (!stage) {
    throw new Error(`Unknown stage: ${name}`);
  }
  return stage;
}

/**
 * Get list of all stage names
 */
export function getStageNames(): StageName[] {
  return Object.keys(stages) as StageName[];
}

// Export individual stages for direct access
export {
  secretaryStage,
  toolBuilderStage,
  templateDeciderStage,
  qaDepartmentStage,
  feedbackApplierStage,
  // New enhanced stages
  audienceProfilerStage,
  exampleGeneratorStage,
  copyWriterStage,
  brandGuardianStage
};
