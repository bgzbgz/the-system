/**
 * System Prompts - Central Export
 * Spec: 020-system-prompts (FR-001)
 *
 * Exports all agent prompts and types for use throughout the application.
 */

// Re-export all types
export * from './types';

// Import individual prompts
import { secretaryPrompt } from './secretary';
import { toolBuilderPrompt } from './toolBuilder';
import { templateDeciderPrompt } from './templateDecider';
import { qaDepartmentPrompt } from './qaDepartment';
import { feedbackApplierPrompt } from './feedbackApplier';
// Course-to-Tool pipeline agents
import { courseAnalystPrompt } from './courseAnalyst';
import { knowledgeArchitectPrompt } from './knowledgeArchitect';
import { contentSummarizerPrompt } from './contentSummarizer';
// Pre-submission context agents
import { contextInterviewerPrompt } from './contextInterviewer';
import { audienceProfilerPrompt } from './audienceProfiler';
import { exampleGeneratorPrompt } from './exampleGenerator';
// Quality enhancement agents
import { copyWriterPrompt } from './copyWriter';
import { brandGuardianPrompt } from './brandGuardian';
import { edgeCaseTesterPrompt } from './edgeCaseTester';

// Import types for record
import { AgentName, AgentPrompt } from './types';

/**
 * All agent prompts indexed by name
 */
export const prompts: Record<AgentName, AgentPrompt> = {
  secretary: secretaryPrompt,
  toolBuilder: toolBuilderPrompt,
  templateDecider: templateDeciderPrompt,
  qaDepartment: qaDepartmentPrompt,
  feedbackApplier: feedbackApplierPrompt,
  // Course-to-Tool pipeline agents
  courseAnalyst: courseAnalystPrompt,
  knowledgeArchitect: knowledgeArchitectPrompt,
  contentSummarizer: contentSummarizerPrompt,
  // Pre-submission context agents
  contextInterviewer: contextInterviewerPrompt,
  audienceProfiler: audienceProfilerPrompt,
  exampleGenerator: exampleGeneratorPrompt,
  // Quality enhancement agents
  copyWriter: copyWriterPrompt,
  brandGuardian: brandGuardianPrompt,
  edgeCaseTester: edgeCaseTesterPrompt
};

/**
 * Get a specific agent's prompt by name
 *
 * @param name - Agent identifier
 * @returns The agent's prompt configuration
 */
export function getPrompt(name: AgentName): AgentPrompt {
  const prompt = prompts[name];
  if (!prompt) {
    throw new Error(`Unknown agent: ${name}`);
  }
  return prompt;
}

/**
 * Get list of all available agent names
 */
export function getAgentNames(): AgentName[] {
  return Object.keys(prompts) as AgentName[];
}

/**
 * Initialize prompts module (log status at startup)
 */
export function initializePrompts(): void {
  const agentNames = getAgentNames();
  console.log(`[Prompts] Loaded ${agentNames.length} agent prompts: ${agentNames.join(', ')}`);
}

// Export individual prompts for direct access
export {
  secretaryPrompt,
  toolBuilderPrompt,
  templateDeciderPrompt,
  qaDepartmentPrompt,
  feedbackApplierPrompt,
  // Course-to-Tool pipeline agents
  courseAnalystPrompt,
  knowledgeArchitectPrompt,
  contentSummarizerPrompt,
  // Pre-submission context agents
  contextInterviewerPrompt,
  audienceProfilerPrompt,
  exampleGeneratorPrompt,
  // Quality enhancement agents
  copyWriterPrompt,
  brandGuardianPrompt,
  edgeCaseTesterPrompt
};
