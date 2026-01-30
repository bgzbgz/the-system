/**
 * QA Report Model
 * Spec: 017-mongodb-schema
 *
 * Per data-model.md QAReport interface
 * Embedded in Job document as qa_reports array
 */

// Re-export from job.ts for convenience
export { QAReport, QACriterionDetail } from './job';

/**
 * Input for creating a QA report
 */
export interface CreateQAReportInput {
  result: 'PASS' | 'FAIL';
  score: number;
  max_score: number;
  details: {
    criterion: string;
    passed: boolean;
    note?: string;
  }[];
}

/**
 * Create a QA report with timestamp
 *
 * @param attempt - The attempt number (1-indexed)
 * @param input - QA report input
 * @returns QAReport ready for insertion
 */
export function createQAReport(attempt: number, input: CreateQAReportInput): {
  attempt: number;
  result: 'PASS' | 'FAIL';
  score: number;
  max_score: number;
  details: { criterion: string; passed: boolean; note?: string }[];
  timestamp: Date;
} {
  return {
    attempt,
    result: input.result,
    score: input.score,
    max_score: input.max_score,
    details: input.details,
    timestamp: new Date()
  };
}

/**
 * Validate QA report input
 *
 * @param input - Input to validate
 * @returns Validation result
 */
export function validateQAReportInput(input: unknown): { valid: boolean; error?: string } {
  if (!input || typeof input !== 'object') {
    return { valid: false, error: 'QA report must be an object' };
  }

  const report = input as Record<string, unknown>;

  if (report.result !== 'PASS' && report.result !== 'FAIL') {
    return { valid: false, error: 'result must be PASS or FAIL' };
  }

  if (typeof report.score !== 'number' || report.score < 0) {
    return { valid: false, error: 'score must be a non-negative number' };
  }

  if (typeof report.max_score !== 'number' || report.max_score <= 0) {
    return { valid: false, error: 'max_score must be a positive number' };
  }

  if (!Array.isArray(report.details)) {
    return { valid: false, error: 'details must be an array' };
  }

  for (const detail of report.details) {
    if (!detail || typeof detail !== 'object') {
      return { valid: false, error: 'Each detail must be an object' };
    }

    const d = detail as Record<string, unknown>;

    if (typeof d.criterion !== 'string' || !d.criterion) {
      return { valid: false, error: 'Each detail must have a criterion string' };
    }

    if (typeof d.passed !== 'boolean') {
      return { valid: false, error: 'Each detail must have a passed boolean' };
    }
  }

  return { valid: true };
}
