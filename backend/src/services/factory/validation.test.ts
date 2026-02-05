/**
 * Brutal Test Suite for Tool Depth Bug Fixes
 * Tests Fix #1, #2, #3, #4 for tool depth system
 *
 * Uses Node.js built-in test runner
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';

import {
  validateToolOutput,
  validateDesignAlignment,
  validateExtraction,
  buildBuilderContext,
  formatValidationResult
} from './validation';
import { BuilderContext } from './types';
import { CourseAnalysis, ToolDesign } from './courseProcessor';

// ========== TEST UTILITIES ==========

function createMockBuilderContext(overrides: Partial<BuilderContext> = {}): BuilderContext {
  return {
    tool: {
      name: 'Test Tool',
      tagline: 'A test tool',
      moduleReference: 'Sprint 1: Test Module'
    },
    frameworkItems: [
      { number: 1, label: 'Revenue Growth', definition: 'Increase in revenue', inputType: 'number', placeholder: 'e.g., 10000' },
      { number: 2, label: 'Cost Reduction', definition: 'Decrease in costs', inputType: 'number', placeholder: 'e.g., 5000' },
      { number: 3, label: 'Profit Margin', definition: 'Profit as percentage of revenue', inputType: 'number', placeholder: 'e.g., 15' }
    ],
    terminology: [
      { term: 'Revenue Growth', useIn: 'label' },
      { term: 'Cost Reduction', useIn: 'label' },
      { term: 'Profit Margin', useIn: 'label' },
      { term: 'Cash Flow', useIn: 'helpText' },  // Non-critical term
      { term: 'Working Capital', useIn: 'resultSection' }  // Non-critical term
    ],
    expertQuote: {
      quote: 'The best businesses focus on sustainable growth rather than quick wins.',
      source: 'John Smith, Business Expert'
    },
    calculation: {
      formula: 'revenue - costs = profit',
      verdictCriteria: {
        go: 'Profit margin above 10%',
        noGo: 'Profit margin below 5%'
      }
    },
    ...overrides
  };
}

function createMockCourseAnalysis(overrides: Partial<CourseAnalysis> = {}): CourseAnalysis {
  return {
    moduleTitle: 'Sprint 1: Revenue Optimization',
    learningObjective: 'Understand revenue growth strategies',
    framework: {
      name: '3 Pillars of Growth',
      steps: ['Analyze', 'Implement', 'Measure'],
      inputs: ['revenue', 'costs'],
      outputs: ['profit']
    },
    deepContent: {
      keyTerminology: [
        { term: 'Revenue Growth', definition: 'Increase in revenue', howToUseInTool: 'Use in input label' },
        { term: 'Cost Reduction', definition: 'Decrease in costs', howToUseInTool: 'Use in input label' }
      ],
      numberedFramework: {
        frameworkName: '3 Pillars Framework',
        items: [
          { number: 1, name: 'Revenue', fullLabel: 'Revenue Growth', definition: 'Increase revenue', toolInputLabel: 'Revenue Growth' },
          { number: 2, name: 'Costs', fullLabel: 'Cost Reduction', definition: 'Reduce costs', toolInputLabel: 'Cost Reduction' },
          { number: 3, name: 'Margin', fullLabel: 'Profit Margin', definition: 'Improve margin', toolInputLabel: 'Profit Margin' }
        ]
      },
      reflectionQuestions: [],
      expertWisdom: [
        { quote: 'Focus on sustainable growth', source: 'John Smith', principle: 'Long-term thinking' }
      ],
      bookReferences: [],
      sprintChecklist: [],
      conceptsToLearn: [],
      decisionsToMake: [],
      processesToImplement: [],
      capabilitiesToDevelop: []
    },
    ...overrides
  };
}

function createMockToolDesign(overrides: Partial<ToolDesign> = {}): ToolDesign {
  return {
    toolDesign: {
      name: 'Revenue Calculator',
      tagline: 'Calculate your revenue potential'
    },
    inputs: [
      { label: 'Revenue Growth', type: 'number', placeholder: '10000', helpText: 'Enter growth amount' },
      { label: 'Cost Reduction', type: 'number', placeholder: '5000', helpText: 'Enter cost savings' },
      { label: 'Profit Margin', type: 'number', placeholder: '15', helpText: 'Enter margin %' }
    ],
    processing: {
      formula: 'revenue - costs'
    },
    output: {
      decision: {
        goThreshold: 'Above 10%',
        noGoThreshold: 'Below 5%',
        criteria: 'Profit margin percentage'
      }
    },
    deepContentIntegration: {
      expertQuoteToDisplay: {
        quote: 'Focus on sustainable growth',
        source: 'John Smith',
        displayLocation: 'results section'
      }
    },
    ...overrides
  };
}

// ========== FIX #2 TESTS: Framework Items Must Be Blocking Errors ==========

describe('Fix #2: Framework Items Required (Blocking Errors)', () => {

  it('should FAIL validation when framework items are missing from design', () => {
    const analysis = createMockCourseAnalysis();
    const incompleteDesign = createMockToolDesign({
      inputs: [
        { label: 'Revenue Growth', type: 'number', placeholder: '10000' }
        // Missing: Cost Reduction, Profit Margin
      ]
    });

    const result = validateDesignAlignment(analysis, incompleteDesign);

    // MUST fail - this is a blocking error
    assert.strictEqual(result.passed, false, 'Validation should fail when framework items are missing');
    assert.ok(result.errors.length > 0, 'Should have errors');

    // Check for specific error codes
    const frameworkErrors = result.errors.filter(e => e.code === 'FRAMEWORK_ITEM_NOT_MAPPED');
    assert.strictEqual(frameworkErrors.length, 2, 'Should have 2 missing framework errors (Cost Reduction and Profit Margin)');

    console.log('Fix #2 Test - Missing framework items correctly produce ERRORS:');
    console.log(formatValidationResult(result));
  });

  it('should PASS validation when all framework items are mapped', () => {
    const analysis = createMockCourseAnalysis();
    const completeDesign = createMockToolDesign();

    const result = validateDesignAlignment(analysis, completeDesign);

    assert.strictEqual(result.passed, true, 'Validation should pass when all framework items are mapped');
    assert.strictEqual(result.errors.length, 0, 'Should have no errors');

    console.log('Fix #2 Test - All framework items mapped:');
    console.log(formatValidationResult(result));
  });

  it('should detect partially mapped framework items', () => {
    const analysis = createMockCourseAnalysis();
    const partialDesign = createMockToolDesign({
      inputs: [
        { label: 'Revenue Growth', type: 'number', placeholder: '10000' },
        { label: 'Cost Reduction', type: 'number', placeholder: '5000' }
        // Missing: Profit Margin
      ]
    });

    const result = validateDesignAlignment(analysis, partialDesign);

    assert.strictEqual(result.passed, false, 'Should fail with partial mapping');
    const missingItems = result.errors.filter(e => e.code === 'FRAMEWORK_ITEM_NOT_MAPPED');
    assert.strictEqual(missingItems.length, 1, 'Should have 1 missing framework error');
    // Note: Error uses short name "Margin" from framework item, not full "Profit Margin"
    assert.ok(missingItems[0].message.includes('Margin'), 'Error should mention Margin');

    console.log('Fix #2 Test - Partial mapping detected:');
    console.log(formatValidationResult(result));
  });
});

// ========== FIX #4 TESTS: Critical Terminology Must Be Errors ==========

describe('Fix #4: Critical Terminology Required (Blocking Errors)', () => {

  it('should produce ERROR when critical terminology (in framework) is missing from HTML', () => {
    const context = createMockBuilderContext();

    // HTML missing "Revenue Growth" which IS in framework items
    const htmlMissingCriticalTerm = `
      <html>
        <head><title>Test Tool</title></head>
        <body>
          <h1>Calculator</h1>
          <label>Income Increase</label>
          <label>Cost Reduction</label>
          <label>Profit Margin</label>
          <blockquote>The best businesses focus on sustainable growth rather than quick wins.</blockquote>
          <cite>John Smith, Business Expert</cite>
        </body>
      </html>
    `;

    const result = validateToolOutput(htmlMissingCriticalTerm, context);

    // MUST fail because "Revenue Growth" is critical (appears in framework)
    assert.strictEqual(result.passed, false, 'Should fail when critical terminology is missing');

    const criticalErrors = result.errors.filter(e => e.code === 'CRITICAL_TERMINOLOGY_MISSING');
    assert.ok(criticalErrors.length > 0, 'Should have critical terminology errors');
    assert.ok(criticalErrors.some(e => e.message.includes('Revenue Growth')), 'Should mention Revenue Growth');

    console.log('Fix #4 Test - Critical terminology missing produces ERROR:');
    console.log(formatValidationResult(result));
  });

  it('should produce WARNING (not error) when non-critical terminology is missing', () => {
    const context = createMockBuilderContext();

    // HTML has all framework terms but missing non-critical terms
    const htmlMissingNonCriticalTerm = `
      <html>
        <head><title>Test Tool</title></head>
        <body>
          <h1>Calculator</h1>
          <label>Revenue Growth</label>
          <label>Cost Reduction</label>
          <label>Profit Margin</label>
          <blockquote>The best businesses focus on sustainable growth rather than quick wins.</blockquote>
          <cite>John Smith, Business Expert</cite>
        </body>
      </html>
    `;

    const result = validateToolOutput(htmlMissingNonCriticalTerm, context);

    // Should PASS (no blocking errors) but have warnings
    assert.strictEqual(result.passed, true, 'Should pass when only non-critical terms are missing');
    assert.strictEqual(result.errors.length, 0, 'Should have no errors');

    const terminologyWarnings = result.warnings.filter(e => e.code === 'TERMINOLOGY_GENERICIZED');
    assert.ok(terminologyWarnings.length > 0, 'Should have terminology warnings');

    console.log('Fix #4 Test - Non-critical terminology missing produces WARNING:');
    console.log(formatValidationResult(result));
  });

  it('should correctly distinguish critical vs non-critical terms', () => {
    const context = createMockBuilderContext({
      frameworkItems: [
        { number: 1, label: 'Power of One', definition: 'Single focus strategy', inputType: 'text', placeholder: '' }
      ],
      terminology: [
        { term: 'Power of One', useIn: 'label' },      // Critical - in framework
        { term: 'Leverage', useIn: 'helpText' },       // Non-critical
        { term: 'Compound Growth', useIn: 'resultSection' }  // Non-critical
      ]
    });

    // HTML missing all terms
    const htmlMissingAll = `
      <html>
        <head><title>Test</title></head>
        <body>
          <h1>Tool</h1>
          <p>Some generic content</p>
        </body>
      </html>
    `;

    const result = validateToolOutput(htmlMissingAll, context);

    // Should fail due to critical term "Power of One"
    assert.strictEqual(result.passed, false, 'Should fail due to critical term missing');

    const criticalErrors = result.errors.filter(e => e.code === 'CRITICAL_TERMINOLOGY_MISSING');
    const nonCriticalWarnings = result.warnings.filter(e => e.code === 'TERMINOLOGY_GENERICIZED');

    assert.strictEqual(criticalErrors.length, 1, 'Should have 1 critical error');
    assert.ok(criticalErrors[0].message.includes('Power of One'), 'Critical error should mention Power of One');

    assert.strictEqual(nonCriticalWarnings.length, 2, 'Should have 2 non-critical warnings (Leverage and Compound Growth)');

    console.log('Fix #4 Test - Critical vs non-critical distinction:');
    console.log(formatValidationResult(result));
  });
});

// ========== FIX #1 TESTS: Output Validation Retry Logic ==========

describe('Fix #1: Output Validation Blocking with Retry', () => {

  it('buildOutputFixInstructions should generate correct fix instructions', async () => {
    // Import the factory to test the helper method
    const { ToolFactory } = await import('./index');
    const factory = new ToolFactory();

    const errors = [
      {
        code: 'FRAMEWORK_ITEM_MISSING_IN_HTML' as const,
        message: 'Framework item "Revenue Growth" not found',
        field: 'frameworkItems[1]',
        expected: 'Revenue Growth',
        actual: 'Not found'
      },
      {
        code: 'EXPERT_QUOTE_MISSING_IN_HTML' as const,
        message: 'Expert quote missing',
        field: 'expertQuote',
        expected: 'The best businesses focus on...',
        actual: 'Not found'
      },
      {
        code: 'CRITICAL_TERMINOLOGY_MISSING' as const,
        message: 'Critical term missing',
        field: 'terminology.PowerOfOne',
        expected: 'Power of One',
        actual: 'Not found'
      }
    ];

    // Access private method for testing
    const fixInstructions = (factory as any).buildOutputFixInstructions(errors);

    assert.ok(fixInstructions.includes('MISSING FRAMEWORK ITEM'), 'Should include framework item instruction');
    assert.ok(fixInstructions.includes('Revenue Growth'), 'Should mention Revenue Growth');
    assert.ok(fixInstructions.includes('MISSING EXPERT QUOTE'), 'Should include quote instruction');
    assert.ok(fixInstructions.includes('MISSING CRITICAL TERM'), 'Should include critical term instruction');
    assert.ok(fixInstructions.includes('Power of One'), 'Should mention Power of One');

    console.log('Fix #1 Test - Generated fix instructions:');
    console.log(fixInstructions);
  });

  it('validateToolOutput should fail when framework items missing', () => {
    const context = createMockBuilderContext();

    const htmlMissingFrameworkItems = `
      <html>
        <head><title>Test</title></head>
        <body>
          <h1>Calculator</h1>
          <label>Some Generic Label</label>
        </body>
      </html>
    `;

    const result = validateToolOutput(htmlMissingFrameworkItems, context);

    assert.strictEqual(result.passed, false, 'Should fail when framework items are missing');
    const frameworkErrors = result.errors.filter(e => e.code === 'FRAMEWORK_ITEM_MISSING_IN_HTML');
    assert.strictEqual(frameworkErrors.length, 3, 'All 3 framework items should be missing');

    console.log('Fix #1 Test - Framework items missing in HTML:');
    console.log(formatValidationResult(result));
  });

  it('validateToolOutput should fail when expert quote missing', () => {
    const context = createMockBuilderContext();

    const htmlMissingQuote = `
      <html>
        <head><title>Test</title></head>
        <body>
          <h1>Calculator</h1>
          <label>Revenue Growth</label>
          <label>Cost Reduction</label>
          <label>Profit Margin</label>
        </body>
      </html>
    `;

    const result = validateToolOutput(htmlMissingQuote, context);

    assert.strictEqual(result.passed, false, 'Should fail when expert quote is missing');
    const quoteErrors = result.errors.filter(e => e.code === 'EXPERT_QUOTE_MISSING_IN_HTML');
    assert.strictEqual(quoteErrors.length, 1, 'Should have 1 quote error');

    console.log('Fix #1 Test - Expert quote missing in HTML:');
    console.log(formatValidationResult(result));
  });

  it('validateToolOutput should PASS when all required content present', () => {
    const context = createMockBuilderContext();

    const completeHtml = `
      <html>
        <head><title>Revenue Calculator</title></head>
        <body>
          <h1>Revenue Calculator</h1>
          <div class="input-group">
            <label>Revenue Growth</label>
            <input type="number" placeholder="e.g., 10000">
          </div>
          <div class="input-group">
            <label>Cost Reduction</label>
            <input type="number" placeholder="e.g., 5000">
          </div>
          <div class="input-group">
            <label>Profit Margin</label>
            <input type="number" placeholder="e.g., 15">
          </div>
          <div class="results">
            <blockquote>
              "The best businesses focus on sustainable growth rather than quick wins."
              <cite>— John Smith, Business Expert</cite>
            </blockquote>
          </div>
          <p>Consider your Cash Flow and Working Capital</p>
        </body>
      </html>
    `;

    const result = validateToolOutput(completeHtml, context);

    assert.strictEqual(result.passed, true, 'Should pass with all content present');
    assert.strictEqual(result.errors.length, 0, 'Should have no errors');

    console.log('Fix #1 Test - Complete HTML passes validation:');
    console.log(formatValidationResult(result));
  });
});

// ========== FIX #3 TESTS: CourseContext Endpoint ==========

describe('Fix #3: CourseContext Retrieval', () => {

  it('buildCourseContext should correctly build context from analysis and design', () => {
    const analysis = createMockCourseAnalysis();
    const design = createMockToolDesign();

    const context = buildBuilderContext(analysis, design);

    // Verify framework items are built
    assert.strictEqual(context.frameworkItems.length, 3, 'Should have 3 framework items');
    assert.ok(context.frameworkItems[0].label.includes('Revenue'), 'First item should contain Revenue');

    // Verify terminology is built
    assert.ok(context.terminology.length > 0, 'Should have terminology');

    // Verify expert quote is captured
    assert.ok(context.expertQuote, 'Should have expert quote');
    assert.ok(context.expertQuote?.quote.includes('sustainable growth'), 'Quote should contain expected text');

    console.log('Fix #3 Test - BuilderContext correctly built:');
    console.log(JSON.stringify(context, null, 2));
  });

  it('buildBuilderContext should handle missing deep content gracefully', () => {
    const minimalAnalysis: CourseAnalysis = {
      moduleTitle: 'Test Module',
      learningObjective: 'Learn stuff'
    };

    const minimalDesign: ToolDesign = {
      toolDesign: { name: 'Test', tagline: 'Test' },
      inputs: [],
      processing: {},
      output: {}
    };

    const context = buildBuilderContext(minimalAnalysis, minimalDesign);

    assert.deepStrictEqual(context.frameworkItems, [], 'Should have empty framework items');
    assert.deepStrictEqual(context.terminology, [], 'Should have empty terminology');
    assert.strictEqual(context.expertQuote, undefined, 'Should have no expert quote');

    console.log('Fix #3 Test - Handles missing deep content:');
    console.log(JSON.stringify(context, null, 2));
  });
});

// ========== EXTRACTION VALIDATION TESTS ==========

describe('Extraction Validation', () => {

  it('should fail when module title is missing', () => {
    const analysis: CourseAnalysis = {
      moduleTitle: '',
      learningObjective: 'Some objective'
    };

    const result = validateExtraction(analysis);

    assert.strictEqual(result.passed, false, 'Should fail with missing module title');
    assert.ok(result.errors.some(e => e.code === 'MISSING_MODULE_TITLE'), 'Should have module title error');

    console.log('Extraction Test - Missing module title:');
    console.log(formatValidationResult(result));
  });

  it('should fail when no framework or terminology', () => {
    const analysis: CourseAnalysis = {
      moduleTitle: 'Test Module',
      learningObjective: 'Some objective',
      deepContent: {
        keyTerminology: [],
        numberedFramework: null,
        reflectionQuestions: [],
        expertWisdom: [],
        bookReferences: [],
        sprintChecklist: [],
        conceptsToLearn: [],
        decisionsToMake: [],
        processesToImplement: [],
        capabilitiesToDevelop: []
      }
    };

    const result = validateExtraction(analysis);

    assert.strictEqual(result.passed, false, 'Should fail with no framework or terminology');
    assert.ok(result.errors.some(e => e.code === 'MISSING_NUMBERED_FRAMEWORK'), 'Should have framework error');

    console.log('Extraction Test - Missing framework and terminology:');
    console.log(formatValidationResult(result));
  });

  it('should pass with valid numbered framework', () => {
    const analysis = createMockCourseAnalysis();

    const result = validateExtraction(analysis);

    assert.strictEqual(result.passed, true, 'Should pass with valid framework');

    console.log('Extraction Test - Valid framework:');
    console.log(formatValidationResult(result));
  });
});

// ========== INTEGRATION TEST ==========

describe('Integration: Full Validation Pipeline', () => {

  it('should catch all types of errors in a bad tool', () => {
    const context = createMockBuilderContext();

    // HTML that fails everything
    const terribleHtml = `
      <html>
        <head><title>Bad Tool</title></head>
        <body>
          <h1>Generic Calculator</h1>
          <label>Enter Number 1</label>
          <label>Enter Number 2</label>
          <label>Enter Number 3</label>
          <p>No quotes, no framework terms, nothing course-specific</p>
        </body>
      </html>
    `;

    const result = validateToolOutput(terribleHtml, context);

    assert.strictEqual(result.passed, false, 'Should fail with all errors');

    // Should have framework errors
    const frameworkErrors = result.errors.filter(e => e.code === 'FRAMEWORK_ITEM_MISSING_IN_HTML');
    assert.strictEqual(frameworkErrors.length, 3, 'Should have 3 framework errors');

    // Should have quote error
    const quoteErrors = result.errors.filter(e => e.code === 'EXPERT_QUOTE_MISSING_IN_HTML');
    assert.strictEqual(quoteErrors.length, 1, 'Should have 1 quote error');

    // Should have critical terminology errors (terms in framework)
    const criticalErrors = result.errors.filter(e => e.code === 'CRITICAL_TERMINOLOGY_MISSING');
    assert.ok(criticalErrors.length > 0, 'Should have critical terminology errors');

    console.log('Integration Test - All errors caught:');
    console.log(formatValidationResult(result));
    console.log(`\nTotal errors: ${result.errors.length}`);
    console.log(`Total warnings: ${result.warnings.length}`);
  });

  it('should pass a well-formed tool', () => {
    const context = createMockBuilderContext();

    const goodHtml = `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <title>Revenue Growth Calculator - Sprint 1</title>
        </head>
        <body>
          <header>
            <h1>Revenue Growth Calculator</h1>
            <p class="tagline">A test tool for Sprint 1: Test Module</p>
          </header>

          <main>
            <form id="calculator">
              <div class="input-section">
                <label for="revenue">Revenue Growth</label>
                <input type="number" id="revenue" placeholder="e.g., 10000">
                <span class="help">Track your increase in revenue</span>
              </div>

              <div class="input-section">
                <label for="costs">Cost Reduction</label>
                <input type="number" id="costs" placeholder="e.g., 5000">
                <span class="help">Track your decrease in costs</span>
              </div>

              <div class="input-section">
                <label for="margin">Profit Margin</label>
                <input type="number" id="margin" placeholder="e.g., 15">
                <span class="help">Profit as percentage of revenue</span>
              </div>

              <button type="submit">Calculate</button>
            </form>

            <div class="results" hidden>
              <h2>Your Results</h2>
              <div class="verdict"></div>

              <blockquote class="expert-quote">
                "The best businesses focus on sustainable growth rather than quick wins."
                <footer>— John Smith, Business Expert</footer>
              </blockquote>

              <div class="tips">
                <p>Consider your Cash Flow and Working Capital when planning.</p>
              </div>
            </div>
          </main>
        </body>
      </html>
    `;

    const result = validateToolOutput(goodHtml, context);

    assert.strictEqual(result.passed, true, 'Should pass with well-formed HTML');
    assert.strictEqual(result.errors.length, 0, 'Should have no errors');

    console.log('Integration Test - Good tool passes:');
    console.log(formatValidationResult(result));
  });
});

// ========== EDGE CASE TESTS ==========

describe('Edge Cases: Brutal Stress Tests', () => {

  it('should handle case-insensitive matching for framework items', () => {
    const context = createMockBuilderContext({
      frameworkItems: [
        { number: 1, label: 'REVENUE GROWTH', definition: 'Increase in revenue', inputType: 'number', placeholder: '' }
      ],
      terminology: [],
      expertQuote: undefined  // No quote to check
    });

    // HTML has lowercase version
    const html = `
      <html><body>
        <label>revenue growth</label>
      </body></html>
    `;

    const result = validateToolOutput(html, context);

    // Should pass - case insensitive matching
    assert.strictEqual(result.passed, true, 'Should pass with case-insensitive match');
  });

  it('should handle partial framework label matching', () => {
    const context = createMockBuilderContext({
      frameworkItems: [
        { number: 1, label: 'Lever 1: Revenue Growth', definition: 'Increase revenue', inputType: 'number', placeholder: '' }
      ],
      terminology: [],
      expertQuote: undefined  // No quote to check
    });

    // HTML has only the key part after the colon
    const html = `
      <html><body>
        <label>Revenue Growth</label>
      </body></html>
    `;

    const result = validateToolOutput(html, context);

    // Should pass - partial matching after colon
    assert.strictEqual(result.passed, true, 'Should pass with partial match after colon');
  });

  it('should catch expert quote that is truncated', () => {
    const context = createMockBuilderContext({
      frameworkItems: [],
      terminology: [],
      expertQuote: {
        quote: 'This is a very long expert quote that should appear in the tool completely without being cut off or modified in any way.',
        source: 'Expert Name'
      }
    });

    // HTML has only first 30 chars (less than validation checks 50)
    const html = `
      <html><body>
        <p>This is a very short quote</p>
      </body></html>
    `;

    const result = validateToolOutput(html, context);

    // Should fail - quote not found
    assert.strictEqual(result.passed, false, 'Should fail when quote is truncated');
    assert.ok(result.errors.some(e => e.code === 'EXPERT_QUOTE_MISSING_IN_HTML'), 'Should have quote error');
  });

  it('should handle empty framework items array', () => {
    const context = createMockBuilderContext({
      frameworkItems: [],
      terminology: [],
      expertQuote: undefined
    });

    const html = `<html><body><p>Any content</p></body></html>`;

    const result = validateToolOutput(html, context);

    // Should pass - nothing to validate
    assert.strictEqual(result.passed, true, 'Should pass with empty validation context');
    assert.strictEqual(result.errors.length, 0, 'Should have no errors');
  });

  it('should detect multiple critical terms missing', () => {
    const context = createMockBuilderContext({
      frameworkItems: [
        { number: 1, label: 'Power of One', definition: 'Focus strategy', inputType: 'number', placeholder: '' },
        { number: 2, label: 'Seven Levers', definition: 'Levers for growth', inputType: 'number', placeholder: '' },
        { number: 3, label: 'Cash Conversion Cycle', definition: 'Cash timing', inputType: 'number', placeholder: '' }
      ],
      terminology: [
        { term: 'Power of One', useIn: 'label' },
        { term: 'Seven Levers', useIn: 'label' },
        { term: 'Cash Conversion Cycle', useIn: 'label' }
      ],
      expertQuote: undefined
    });

    // HTML missing all critical terms
    const html = `
      <html><body>
        <label>Input 1</label>
        <label>Input 2</label>
        <label>Input 3</label>
      </body></html>
    `;

    const result = validateToolOutput(html, context);

    assert.strictEqual(result.passed, false, 'Should fail with multiple critical terms missing');

    const frameworkErrors = result.errors.filter(e => e.code === 'FRAMEWORK_ITEM_MISSING_IN_HTML');
    const criticalErrors = result.errors.filter(e => e.code === 'CRITICAL_TERMINOLOGY_MISSING');

    assert.strictEqual(frameworkErrors.length, 3, 'Should have 3 framework errors');
    assert.strictEqual(criticalErrors.length, 3, 'Should have 3 critical terminology errors');

    console.log('Edge Case Test - Multiple critical terms:');
    console.log(formatValidationResult(result));
  });

  it('should handle terminology that appears in definition but not label', () => {
    const context = createMockBuilderContext({
      frameworkItems: [
        { number: 1, label: 'Revenue Input', definition: 'Measures Power of One metric', inputType: 'number', placeholder: '' }
      ],
      terminology: [
        { term: 'Power of One', useIn: 'helpText' }  // Term is in definition, should be critical
      ],
      expertQuote: undefined
    });

    // HTML missing the term
    const html = `
      <html><body>
        <label>Revenue Input</label>
      </body></html>
    `;

    const result = validateToolOutput(html, context);

    // Should fail because "Power of One" appears in framework definition
    assert.strictEqual(result.passed, false, 'Should fail when term in definition is missing');

    const criticalErrors = result.errors.filter(e => e.code === 'CRITICAL_TERMINOLOGY_MISSING');
    assert.ok(criticalErrors.length > 0, 'Should have critical error for term in definition');

    console.log('Edge Case Test - Term in definition:');
    console.log(formatValidationResult(result));
  });

  it('should count all error types correctly in complex scenario', () => {
    const context = createMockBuilderContext();

    // Completely empty HTML
    const html = `<html><body></body></html>`;

    const result = validateToolOutput(html, context);

    assert.strictEqual(result.passed, false, 'Should fail empty HTML');

    // Count all error types
    const errorsByType: Record<string, number> = {};
    for (const err of result.errors) {
      errorsByType[err.code] = (errorsByType[err.code] || 0) + 1;
    }

    console.log('Edge Case Test - Error counts by type:');
    console.log(JSON.stringify(errorsByType, null, 2));

    // Verify we have framework, quote, and critical terminology errors
    assert.ok(errorsByType['FRAMEWORK_ITEM_MISSING_IN_HTML'] >= 1, 'Should have framework errors');
    assert.ok(errorsByType['EXPERT_QUOTE_MISSING_IN_HTML'] >= 1, 'Should have quote error');
    assert.ok(errorsByType['CRITICAL_TERMINOLOGY_MISSING'] >= 1, 'Should have critical terminology errors');
  });
});

// ========== RETRY MECHANISM SIMULATION ==========

describe('Retry Mechanism Simulation', () => {

  it('should generate progressively specific fix instructions', async () => {
    const { ToolFactory } = await import('./index');
    const factory = new ToolFactory();

    // First failure - multiple issues
    const firstErrors = [
      { code: 'FRAMEWORK_ITEM_MISSING_IN_HTML' as const, message: 'Missing', field: 'f1', expected: 'Revenue Growth', actual: '' },
      { code: 'FRAMEWORK_ITEM_MISSING_IN_HTML' as const, message: 'Missing', field: 'f2', expected: 'Cost Reduction', actual: '' },
      { code: 'EXPERT_QUOTE_MISSING_IN_HTML' as const, message: 'Missing', field: 'q', expected: 'Focus on growth', actual: '' }
    ];

    const firstInstructions = (factory as any).buildOutputFixInstructions(firstErrors);

    // Verify instructions mention all missing items
    assert.ok(firstInstructions.includes('Revenue Growth'), 'First instructions should mention Revenue Growth');
    assert.ok(firstInstructions.includes('Cost Reduction'), 'First instructions should mention Cost Reduction');
    assert.ok(firstInstructions.includes('EXPERT QUOTE'), 'First instructions should mention quote');

    // Second failure - fewer issues (simulating partial fix)
    const secondErrors = [
      { code: 'FRAMEWORK_ITEM_MISSING_IN_HTML' as const, message: 'Missing', field: 'f2', expected: 'Cost Reduction', actual: '' }
    ];

    const secondInstructions = (factory as any).buildOutputFixInstructions(secondErrors);

    assert.ok(!secondInstructions.includes('Revenue Growth'), 'Second instructions should NOT mention Revenue Growth (fixed)');
    assert.ok(secondInstructions.includes('Cost Reduction'), 'Second instructions should mention remaining issue');

    console.log('Retry Simulation - First attempt instructions:');
    console.log(firstInstructions);
    console.log('\nRetry Simulation - Second attempt instructions:');
    console.log(secondInstructions);
  });
});

console.log('\n' + '='.repeat(60));
console.log('BRUTAL TEST SUITE FOR TOOL DEPTH BUG FIXES');
console.log('='.repeat(60) + '\n');
