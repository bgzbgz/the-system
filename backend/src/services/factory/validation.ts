/**
 * Validation Module
 * Feature: 017-bulletproof-factory
 *
 * Provides validation functions for the tool factory pipeline:
 * - validateExtraction: Validates Course Analyst output
 * - validateDesignAlignment: Validates Knowledge Architect output against extraction
 * - validateToolOutput: Validates generated HTML contains required content
 * - buildBuilderContext: Transforms analysis + design into structured BuilderContext
 */

import {
  ValidationResult,
  ValidationIssue,
  ValidationStage,
  ValidationErrorCode,
  BuilderContext
} from './types';
import { CourseAnalysis, ToolDesign } from './courseProcessor';
import logger from '../../utils/logger';
import { Phase, MIN_PHASES, MAX_PHASES, MAX_INPUTS_PER_PHASE } from '../../prompts/types';

// ========== EXTRACTION VALIDATION ==========

/**
 * Validate course analysis extraction
 *
 * Rules:
 * - MUST have either numberedFramework OR keyTerminology OR legacy framework.steps (at least one)
 * - If numberedFramework exists with items, use those
 * - If numberedFramework exists without items but has a name, treat as warning and allow legacy fallback
 * - MUST have moduleTitle
 */
export function validateExtraction(analysis: CourseAnalysis): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  const deepContent = analysis.deepContent;
  const hasNumberedFramework = deepContent?.numberedFramework?.items?.length && deepContent.numberedFramework.items.length > 0;
  const hasKeyTerminology = deepContent?.keyTerminology?.length && deepContent.keyTerminology.length >= 2;
  // Fallback: legacy framework.steps or formulas provide structure
  const hasLegacyFramework = analysis.framework?.steps?.length && analysis.framework.steps.length >= 2;
  const hasFormulas = analysis.formulas?.length && analysis.formulas.length >= 1;
  const hasDecisionCriteria = analysis.decisionCriteria?.goCondition && analysis.decisionCriteria?.noGoCondition;

  // Check for moduleTitle
  if (!analysis.moduleTitle || analysis.moduleTitle.trim().length === 0) {
    errors.push({
      code: 'MISSING_MODULE_TITLE',
      message: 'EXTRACTION FAILED: No module title found. The Course Analyst must extract a moduleTitle from the course content (e.g., "Sprint 6: Cashflow Story Part 1"). Check that the content contains identifiable sprint/module headings.',
      field: 'moduleTitle',
      expected: 'Non-empty string like "Sprint 6: Cashflow Story Part 1"',
      actual: analysis.moduleTitle || 'undefined/empty'
    });
  }

  // Check for ANY usable content structure
  const hasUsableContent = hasNumberedFramework || hasKeyTerminology || hasLegacyFramework || hasFormulas || hasDecisionCriteria;

  if (!hasUsableContent) {
    errors.push({
      code: 'MISSING_NUMBERED_FRAMEWORK',
      message: `EXTRACTION FAILED: No course-specific content found. The Course Analyst must extract AT LEAST ONE of:
  1. A numbered framework (deepContent.numberedFramework) with items like "7 Levers", "5 Steps", etc.
  2. At least 2 key terminology items (deepContent.keyTerminology) unique to this course.
  3. A legacy framework with at least 2 steps (framework.steps).
  4. At least 1 formula with variables (formulas[]).
  5. Decision criteria with go/no-go conditions (decisionCriteria).

Current extraction found:
  - Framework items: ${deepContent?.numberedFramework?.items?.length || 0}
  - Terminology items: ${deepContent?.keyTerminology?.length || 0}
  - Legacy framework steps: ${analysis.framework?.steps?.length || 0}
  - Formulas: ${analysis.formulas?.length || 0}
  - Decision criteria: ${hasDecisionCriteria ? 'yes' : 'no'}

This usually means:
  - The course content doesn't contain structured frameworks
  - The content may be too generic for tool generation
  - Try uploading content with clearer structure (numbered lists, steps, formulas)`,
      field: 'deepContent OR framework OR formulas OR decisionCriteria',
      expected: 'At least one structured content element',
      actual: `Framework: ${deepContent?.numberedFramework?.frameworkName || 'none'}, Items: ${deepContent?.numberedFramework?.items?.length || 0}, Terminology: ${deepContent?.keyTerminology?.length || 0}`
    });
  }

  // Check if framework exists but has no items - this is now a WARNING if other content exists
  if (deepContent?.numberedFramework?.frameworkName && (!deepContent.numberedFramework.items || deepContent.numberedFramework.items.length === 0)) {
    const hasOtherContent = hasKeyTerminology || hasLegacyFramework || hasFormulas || hasDecisionCriteria;

    if (hasOtherContent) {
      // Downgrade to warning - we can still build the tool with other content
      warnings.push({
        code: 'INCOMPLETE_FRAMEWORK_ITEMS',
        message: `Framework "${deepContent.numberedFramework.frameworkName}" was identified but items could not be extracted. The tool will be built using other available content (terminology, formulas, decision criteria).`,
        field: 'deepContent.numberedFramework.items',
        expected: 'Array of items with structure: { number, name, fullLabel, definition, toolInputLabel }',
        actual: `frameworkName: "${deepContent.numberedFramework.frameworkName}", items: []`
      });
    } else {
      // Still an error if no other content
      errors.push({
        code: 'INCOMPLETE_FRAMEWORK_ITEMS',
        message: `EXTRACTION INCOMPLETE: Framework "${deepContent.numberedFramework.frameworkName}" was identified but 0 items were extracted, and no other usable content was found. The Course Analyst must extract each individual item with: number, name, fullLabel, definition, toolInputLabel. Without these, the tool cannot implement the framework.`,
        field: 'deepContent.numberedFramework.items',
        expected: 'Array of items with structure: { number, name, fullLabel, definition, toolInputLabel }',
        actual: `frameworkName: "${deepContent.numberedFramework.frameworkName}", items: []`
      });
    }
  }

  // Warnings for optional but valuable content
  if (!deepContent?.expertWisdom?.length) {
    warnings.push({
      code: 'MISSING_KEY_TERMINOLOGY',
      message: 'No expert quotes extracted. Consider adding quotes for richer tool output.',
      field: 'deepContent.expertWisdom',
      expected: 'At least 1 expert quote',
      actual: '0 quotes'
    });
  }

  const result: ValidationResult = {
    passed: errors.length === 0,
    errors,
    warnings,
    stage: 'extraction',
    timestamp: new Date()
  };

  logger.info('[Validation] Extraction validation complete', {
    passed: result.passed,
    errorCount: errors.length,
    warningCount: warnings.length,
    hasFramework: hasNumberedFramework,
    hasTerminology: hasKeyTerminology
  });

  return result;
}

// ========== DESIGN ALIGNMENT VALIDATION ==========

/**
 * Validate that tool design properly maps course elements
 *
 * Rules:
 * - If framework has N items, design MUST have at least N inputs
 * - Key terminology SHOULD appear in input labels (warning if not)
 * - If quotes exist, design SHOULD specify display location (warning if not)
 */
export function validateDesignAlignment(
  analysis: CourseAnalysis,
  design: ToolDesign
): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  const deepContent = analysis.deepContent;
  const frameworkItems = deepContent?.numberedFramework?.items || [];
  const designInputs = design.inputs || [];

  // Check framework item coverage
  if (frameworkItems.length > 0) {
    if (designInputs.length < frameworkItems.length) {
      // Find which items are missing (guard against undefined labels from AI output)
      const inputLabelsLower = designInputs.map(i => (i.label || '').toLowerCase());
      const missingItems = frameworkItems.filter(item => {
        const labelLower = (item.toolInputLabel || item.name || '').toLowerCase();
        const nameLower = (item.name || '').toLowerCase();
        return !inputLabelsLower.some(l => l.includes(labelLower) || l.includes(nameLower));
      });

      for (const missing of missingItems) {
        errors.push({
          code: 'FRAMEWORK_ITEM_NOT_MAPPED',
          message: `Framework item "${missing.name}" (#${missing.number}) not mapped to tool input. Design must include inputs for all ${frameworkItems.length} framework items.`,
          field: 'inputs',
          expected: missing.toolInputLabel,
          actual: 'No matching input found'
        });
      }
    }
  }

  // Check terminology usage (warning with detailed guidance)
  const terminology = deepContent?.keyTerminology || [];
  if (terminology.length > 0) {
    const allLabelsAndHelp = designInputs
      .map(i => `${i.label} ${i.helpText || ''}`.toLowerCase())
      .join(' ');

    const unusedTerms = terminology.filter(t =>
      t.term && !allLabelsAndHelp.includes(t.term.toLowerCase())
    );

    if (unusedTerms.length > 0) {
      warnings.push({
        code: 'TERMINOLOGY_NOT_USED',
        message: `DESIGN WARNING: Course-specific terminology not used in tool design.

Unused terms: ${unusedTerms.map(t => `"${t.term}"`).join(', ')}

Each term should appear in input labels or help text. Example:
- Instead of "Monthly Revenue" → use "${unusedTerms[0]?.term || 'Power of One'} - Monthly Revenue"
- Instead of generic tooltips → include term definitions from the course

Used: ${terminology.length - unusedTerms.length} of ${terminology.length} terms.`,
        field: 'inputs.label',
        expected: `All terms used: ${terminology.map(t => t.term).join(', ')}`,
        actual: `Unused: ${unusedTerms.map(t => t.term).join(', ')}`
      });
    }
  }

  // Check expert quote placement (warning with specific guidance)
  const quotes = deepContent?.expertWisdom || [];
  if (quotes.length > 0) {
    const hasQuoteIntegration = design.deepContentIntegration?.expertQuoteToDisplay;
    if (!hasQuoteIntegration) {
      const firstQuote = quotes[0];
      warnings.push({
        code: 'QUOTE_NOT_PLACED',
        message: `DESIGN WARNING: Expert quote not specified for display in tool.

Available quote: "${firstQuote.quote.substring(0, 60)}..." — ${firstQuote.source}

Add to deepContentIntegration.expertQuoteToDisplay:
{
  "quote": "${firstQuote.quote}",
  "source": "${firstQuote.source}",
  "displayLocation": "results section"
}

Expert quotes add credibility and reinforce course content.`,
        field: 'deepContentIntegration.expertQuoteToDisplay',
        expected: 'Quote display specification with location',
        actual: 'Not specified - quote will not appear in generated tool'
      });
    }
  }

  // Check reflection questions usage (warning)
  const reflectionQuestions = deepContent?.reflectionQuestions || [];
  if (reflectionQuestions.length > 0) {
    const inputsWithReflectionBasis = designInputs.filter(i => i.reflectionQuestionBasis);
    if (inputsWithReflectionBasis.length === 0) {
      warnings.push({
        code: 'TERMINOLOGY_NOT_USED', // Reusing code for now
        message: `DESIGN WARNING: ${reflectionQuestions.length} reflection questions from the course not mapped to tool inputs.

Available questions:
${reflectionQuestions.slice(0, 3).map(q => `- "${q.question.substring(0, 50)}..."`).join('\n')}

Consider mapping these to inputs via the reflectionQuestionBasis field.`,
        field: 'inputs.reflectionQuestionBasis',
        expected: 'At least some inputs should reference course reflection questions',
        actual: '0 inputs reference reflection questions'
      });
    }
  }

  const result: ValidationResult = {
    passed: errors.length === 0,
    errors,
    warnings,
    stage: 'design',
    timestamp: new Date()
  };

  logger.info('[Validation] Design alignment validation complete', {
    passed: result.passed,
    errorCount: errors.length,
    warningCount: warnings.length,
    frameworkItems: frameworkItems.length,
    designInputs: designInputs.length
  });

  return result;
}

// ========== OUTPUT VALIDATION ==========

/**
 * Validate that generated HTML contains required course content
 *
 * Rules:
 * - Each framework item label MUST appear in HTML
 * - Expert quote (if provided) MUST appear in HTML
 * - Key terminology SHOULD appear (warning if genericized)
 */
export function validateToolOutput(
  html: string,
  context: BuilderContext
): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  const htmlLower = html.toLowerCase();

  // Check framework items in HTML (skip items with missing labels from AI output)
  for (const item of context.frameworkItems) {
    if (!item.label) continue;
    // Check for the label (case-insensitive)
    const labelLower = item.label.toLowerCase();
    if (!htmlLower.includes(labelLower)) {
      // Also check for a partial match (just the key part)
      const keyPart = labelLower.split(':')[1]?.trim() || labelLower;
      if (!htmlLower.includes(keyPart)) {
        errors.push({
          code: 'FRAMEWORK_ITEM_MISSING_IN_HTML',
          message: `Framework item "${item.label}" not found in generated HTML. Tool must include all framework items with exact terminology.`,
          field: `frameworkItems[${item.number}]`,
          expected: item.label,
          actual: 'Not found in HTML'
        });
      }
    }
  }

  // Check expert quote in HTML
  if (context.expertQuote) {
    // Check first 50 chars of quote (in case of truncation)
    const quoteStart = context.expertQuote.quote.substring(0, 50).toLowerCase();
    if (!htmlLower.includes(quoteStart)) {
      errors.push({
        code: 'EXPERT_QUOTE_MISSING_IN_HTML',
        message: `Expert quote from ${context.expertQuote.source} not displayed in tool. Quotes should appear in results section.`,
        field: 'expertQuote',
        expected: `"${context.expertQuote.quote.substring(0, 50)}..."`,
        actual: 'Not found in HTML'
      });
    }
  }

  // Check slide layout pattern (mandatory scaffold)
  // The tool MUST use position:absolute slides with .active/.past classes
  // It MUST NOT use wide flex containers (e.g., width:800vw) which break the layout
  const hasWideContainer = /width\s*:\s*\d{3,}vw/i.test(html);
  const hasAbsoluteSlides = /\.slide\s*\{[^}]*position\s*:\s*absolute/i.test(html);
  const hasActiveClass = /\.slide\.active/i.test(html);
  const hasPastClass = /\.slide\.past/i.test(html);

  if (hasWideContainer) {
    errors.push({
      code: 'BROKEN_SLIDE_LAYOUT',
      message: 'Tool uses a wide container (e.g., width:800vw) which breaks the slide layout. Slides MUST use position:absolute with .active/.past CSS classes. DO NOT use display:flex with multi-viewport-width containers.',
      field: 'css',
      expected: '.slide { position: absolute; } with .slide.active and .slide.past classes',
      actual: 'Wide flex container detected'
    });
  }

  if (!hasAbsoluteSlides || !hasActiveClass || !hasPastClass) {
    errors.push({
      code: 'MISSING_SLIDE_SCAFFOLD',
      message: 'Tool is missing the mandatory slide CSS scaffold. Slides MUST use: .slide { position: absolute; } with .slide.active { opacity:1; transform:translateX(0); } and .slide.past { transform:translateX(-100%); }',
      field: 'css',
      expected: '.slide { position: absolute; } .slide.active { ... } .slide.past { ... }',
      actual: `position:absolute=${hasAbsoluteSlides}, .active=${hasActiveClass}, .past=${hasPastClass}`
    });
  }

  // Check terminology usage
  // Fix #4: Critical terms (those appearing in framework items) are ERRORS, not warnings
  for (const term of context.terminology) {
    if (!term.term) continue;
    const termLower = term.term.toLowerCase();
    if (!htmlLower.includes(termLower)) {
      // Check if term is critical (appears in framework item labels or definitions)
      const isCritical = context.frameworkItems.some(item =>
        (item.label || '').toLowerCase().includes(termLower) ||
        (item.definition || '').toLowerCase().includes(termLower)
      );

      if (isCritical) {
        errors.push({
          code: 'CRITICAL_TERMINOLOGY_MISSING',
          message: `Critical course term "${term.term}" not found in generated HTML. This term is required because it appears in the framework.`,
          field: `terminology.${term.term}`,
          expected: term.term,
          actual: 'Not found in HTML'
        });
      } else {
        warnings.push({
          code: 'TERMINOLOGY_GENERICIZED',
          message: `Course term "${term.term}" may have been genericized. Verify it appears in the tool.`,
          field: `terminology.${term.term}`,
          expected: term.term,
          actual: 'Term may be missing or genericized'
        });
      }
    }
  }

  const result: ValidationResult = {
    passed: errors.length === 0,
    errors,
    warnings,
    stage: 'output',
    timestamp: new Date()
  };

  logger.info('[Validation] Output validation complete', {
    passed: result.passed,
    errorCount: errors.length,
    warningCount: warnings.length,
    frameworkItemsChecked: context.frameworkItems.length,
    hasExpertQuote: !!context.expertQuote
  });

  return result;
}

// ========== PHASE VALIDATION (019-multistep-wizard-tools) ==========

/**
 * Validation result for phase structure
 */
export interface PhaseValidationResult {
  valid: boolean;
  issues: string[];
}

/**
 * Validate multi-phase wizard structure
 *
 * Rules:
 * - Phase count must be between MIN_PHASES (3) and MAX_PHASES (5)
 * - Each phase must have a unique ID
 * - Each phase can have at most MAX_INPUTS_PER_PHASE (6) inputs
 * - All inputs must belong to exactly one phase (no orphans)
 * - At least one branch condition should exist (warning)
 * - summaryTemplate must only reference inputs from that phase
 */
export function validatePhases(
  phases: Phase[],
  allInputIds: string[]
): PhaseValidationResult {
  const issues: string[] = [];

  // Check phase count (T036)
  if (phases.length < MIN_PHASES) {
    issues.push(`Minimum ${MIN_PHASES} phases required, got ${phases.length}`);
  }
  if (phases.length > MAX_PHASES) {
    issues.push(`Maximum ${MAX_PHASES} phases allowed, got ${phases.length}`);
  }

  // Check unique phase IDs (T037)
  const phaseIds = phases.map(p => p.id);
  const uniqueIds = new Set(phaseIds);
  if (uniqueIds.size !== phaseIds.length) {
    const duplicates = phaseIds.filter((id, i) => phaseIds.indexOf(id) !== i);
    issues.push(`Phase IDs must be unique. Duplicates found: ${Array.from(new Set(duplicates)).join(', ')}`);
  }

  // Track which inputs are assigned to phases
  const assignedInputIds = new Set<string>();

  for (const phase of phases) {
    // Check inputs per phase (T035)
    if (phase.inputs && phase.inputs.length > MAX_INPUTS_PER_PHASE) {
      issues.push(`Phase "${phase.name}" has ${phase.inputs.length} inputs, maximum is ${MAX_INPUTS_PER_PHASE}`);
    }

    // Track assigned inputs
    if (phase.inputs) {
      for (const input of phase.inputs) {
        assignedInputIds.add(input.name);
      }
    }

    // Check summaryTemplate references (T042)
    if (phase.summaryTemplate) {
      const templateVars = phase.summaryTemplate.match(/\{\{(\w+)\}\}/g) || [];
      const phaseInputNames = (phase.inputs || []).map(i => i.name);

      for (const varMatch of templateVars) {
        const varName = varMatch.replace(/\{\{|\}\}/g, '');
        if (!phaseInputNames.includes(varName)) {
          issues.push(`Phase "${phase.name}" summaryTemplate references "{{${varName}}}" but this input is not in this phase`);
        }
      }
    } else {
      issues.push(`Phase "${phase.name}" is missing a summaryTemplate`);
    }
  }

  // Check for orphan inputs (T038)
  for (const inputId of allInputIds) {
    if (!assignedInputIds.has(inputId)) {
      issues.push(`Input "${inputId}" is not assigned to any phase (orphan input)`);
    }
  }

  // Check for at least one branch condition (T058 - warning, not error)
  const hasBranchCondition = phases.some(p => p.branchConditions && p.branchConditions.length > 0);
  if (!hasBranchCondition) {
    // This is a warning, not a blocking issue - log it but don't fail validation
    logger.warn('[Validation] No branch conditions defined in any phase. Consider adding conditional paths for a better user experience.');
  }

  const result: PhaseValidationResult = {
    valid: issues.length === 0,
    issues
  };

  logger.info('[Validation] Phase validation complete', {
    valid: result.valid,
    issueCount: issues.length,
    phaseCount: phases.length,
    inputCount: assignedInputIds.size,
    hasBranchConditions: hasBranchCondition
  });

  return result;
}

/**
 * Validate that default path reaches all required phases
 */
export function validateDefaultPath(
  phases: Phase[],
  defaultPhasePath: string[]
): PhaseValidationResult {
  const issues: string[] = [];
  const phaseIds = phases.map(p => p.id);

  // Check that all phases in defaultPhasePath exist
  for (const pathId of defaultPhasePath) {
    if (!phaseIds.includes(pathId)) {
      issues.push(`Default path references non-existent phase: "${pathId}"`);
    }
  }

  // Check that defaultPhasePath includes at least context, analysis, and decision phases
  // (or equivalent first and last phases)
  if (defaultPhasePath.length < MIN_PHASES) {
    issues.push(`Default path must include at least ${MIN_PHASES} phases`);
  }

  return {
    valid: issues.length === 0,
    issues
  };
}

// ========== BUILDER CONTEXT CONSTRUCTION ==========

/**
 * Build structured context for Tool Builder from analysis and design
 */
export function buildBuilderContext(
  analysis: CourseAnalysis,
  design: ToolDesign
): BuilderContext {
  const deepContent = analysis.deepContent;
  const numberedFramework = deepContent?.numberedFramework;
  const terminology = deepContent?.keyTerminology || [];
  const quotes = deepContent?.expertWisdom || [];
  const checklist = deepContent?.sprintChecklist || [];

  // Build framework items
  const frameworkItems: BuilderContext['frameworkItems'] = [];
  if (numberedFramework?.items) {
    for (const item of numberedFramework.items) {
      // Skip malformed items from AI output
      if (!item.name && !item.toolInputLabel) continue;
      // Try to find matching input from design (guard against undefined fields)
      const matchingInput = (design.inputs || []).find(i =>
        (i.label || '').toLowerCase().includes((item.name || '').toLowerCase()) ||
        (i.label || '').toLowerCase().includes((item.toolInputLabel || '').toLowerCase())
      );

      frameworkItems.push({
        number: item.number,
        label: item.toolInputLabel || item.fullLabel || item.name || `Item ${item.number}`,
        definition: item.definition || '',
        inputType: (matchingInput?.type as 'number' | 'text' | 'select') || 'number',
        placeholder: matchingInput?.placeholder || `e.g., ${item.number * 1000}`
      });
    }
  }

  // Build terminology list (filter out entries with no term from AI output)
  const terminologyList: BuilderContext['terminology'] = terminology
    .filter(t => t.term)
    .map(t => ({
      term: t.term,
      useIn: t.howToUseInTool?.includes('label') ? 'label' as const :
             t.howToUseInTool?.includes('result') ? 'resultSection' as const :
             'helpText' as const
    }));

  // Get expert quote if available
  const expertQuote = quotes.length > 0 ? {
    quote: quotes[0].quote,
    source: quotes[0].source
  } : undefined;

  // Get checklist items
  const checklistItems = checklist.map(c => c.item);

  // Build verdict criteria
  const decision = design.output?.decision;
  const verdictCriteria = {
    go: decision?.goThreshold || decision?.criteria || 'Positive indicators outweigh negative',
    noGo: decision?.noGoThreshold || 'Negative indicators outweigh positive'
  };

  const context: BuilderContext = {
    tool: {
      name: design.toolDesign?.name || 'Decision Tool',
      tagline: design.toolDesign?.tagline || 'Make informed decisions',
      moduleReference: analysis.moduleTitle || 'Course Module'
    },
    frameworkItems,
    terminology: terminologyList,
    expertQuote,
    checklist: checklistItems.length > 0 ? checklistItems : undefined,
    calculation: {
      formula: design.processing?.formula || 'Weighted analysis of inputs',
      verdictCriteria
    }
  };

  logger.info('[Validation] BuilderContext created', {
    toolName: context.tool.name,
    frameworkItemCount: frameworkItems.length,
    terminologyCount: terminologyList.length,
    hasQuote: !!expertQuote,
    hasChecklist: !!context.checklist?.length
  });

  return context;
}

// ========== HELPER FUNCTIONS ==========

/**
 * Format validation result for logging/display
 */
export function formatValidationResult(result: ValidationResult): string {
  const lines: string[] = [];
  lines.push(`Validation [${result.stage}]: ${result.passed ? 'PASSED' : 'FAILED'}`);

  if (result.errors.length > 0) {
    lines.push('Errors:');
    for (const err of result.errors) {
      lines.push(`  - [${err.code}] ${err.message}`);
    }
  }

  if (result.warnings.length > 0) {
    lines.push('Warnings:');
    for (const warn of result.warnings) {
      lines.push(`  - [${warn.code}] ${warn.message}`);
    }
  }

  return lines.join('\n');
}
