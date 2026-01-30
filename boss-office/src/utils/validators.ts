import type { Category, Questionnaire, FileUpload } from '../types/index.ts';

// Character limits for questionnaire fields
export const CHAR_LIMITS = {
  decision: 200,
  teachingPoint: 500,
  inputs: 500,
  verdictCriteria: 500,
} as const;

// File validation limits
export const FILE_LIMITS = {
  maxSize: 10 * 1024 * 1024, // 10MB
  allowedExtensions: ['.pdf', '.docx', '.md', '.txt'] as const,
  allowedMimeTypes: [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/markdown',
    'text/plain',
  ] as const,
} as const;

// Revision notes limits
export const REVISION_LIMITS = {
  minLength: 10,
  maxLength: 2000,
} as const;

// Valid categories
const VALID_CATEGORIES: Category[] = [
  'B2B_PRODUCT',
  'B2B_SERVICE',
  'B2C_PRODUCT',
  'B2C_SERVICE',
];

// Validation result
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

// Validate category
export function validateCategory(category: unknown): ValidationResult {
  if (!category) {
    return { valid: false, error: 'Please select a category' };
  }
  if (!VALID_CATEGORIES.includes(category as Category)) {
    return { valid: false, error: 'Invalid category selected' };
  }
  return { valid: true };
}

// Validate text field with character limit
export function validateTextField(
  value: string | undefined,
  fieldName: string,
  maxLength: number
): ValidationResult {
  if (!value || value.trim().length === 0) {
    return { valid: false, error: `${fieldName} is required` };
  }
  if (value.length > maxLength) {
    return {
      valid: false,
      error: `${fieldName} must be ${maxLength} characters or less`,
    };
  }
  return { valid: true };
}

// Validate full questionnaire
export function validateQuestionnaire(
  questionnaire: Partial<Questionnaire>
): Record<keyof Questionnaire, ValidationResult> {
  return {
    category: validateCategory(questionnaire.category),
    decision: validateTextField(
      questionnaire.decision,
      'Decision question',
      CHAR_LIMITS.decision
    ),
    teachingPoint: validateTextField(
      questionnaire.teachingPoint,
      'Teaching point',
      CHAR_LIMITS.teachingPoint
    ),
    inputs: validateTextField(
      questionnaire.inputs,
      'User inputs',
      CHAR_LIMITS.inputs
    ),
    verdictCriteria: validateTextField(
      questionnaire.verdictCriteria,
      'Verdict criteria',
      CHAR_LIMITS.verdictCriteria
    ),
  };
}

// Check if questionnaire is completely valid
export function isQuestionnaireValid(
  questionnaire: Partial<Questionnaire>
): boolean {
  const results = validateQuestionnaire(questionnaire);
  return Object.values(results).every((r) => r.valid);
}

// Get file extension from filename
function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1) return '';
  return filename.slice(lastDot).toLowerCase();
}

// Validate file
export function validateFile(file: File): ValidationResult {
  // Check file size
  if (file.size > FILE_LIMITS.maxSize) {
    const maxMB = FILE_LIMITS.maxSize / (1024 * 1024);
    return {
      valid: false,
      error: `File size must be less than ${maxMB}MB`,
    };
  }

  // Check extension
  const extension = getFileExtension(file.name);
  const validExtensions = FILE_LIMITS.allowedExtensions as readonly string[];
  if (!validExtensions.includes(extension)) {
    return {
      valid: false,
      error: `File type not supported. Allowed: ${FILE_LIMITS.allowedExtensions.join(', ')}`,
    };
  }

  // Check MIME type (with fallback for unknown types)
  const validMimeTypes = FILE_LIMITS.allowedMimeTypes as readonly string[];
  if (file.type && !validMimeTypes.includes(file.type)) {
    // Some browsers report empty or incorrect MIME types
    // Fall back to extension check if MIME is suspicious but extension is valid
    console.warn(`MIME type mismatch: ${file.type} for ${file.name}`);
  }

  return { valid: true };
}

// Check if file upload is ready for submission
export function isFileUploadReady(fileUpload: FileUpload | null): boolean {
  if (!fileUpload) return false;
  return (
    fileUpload.status === 'ready' &&
    fileUpload.extractedText !== null &&
    fileUpload.extractedText.trim().length > 0
  );
}

// Validate revision notes
export function validateRevisionNotes(notes: string): ValidationResult {
  if (!notes || notes.trim().length === 0) {
    return { valid: false, error: 'Revision notes are required' };
  }
  if (notes.trim().length < REVISION_LIMITS.minLength) {
    return {
      valid: false,
      error: `Please provide at least ${REVISION_LIMITS.minLength} characters`,
    };
  }
  if (notes.length > REVISION_LIMITS.maxLength) {
    return {
      valid: false,
      error: `Revision notes must be ${REVISION_LIMITS.maxLength} characters or less`,
    };
  }
  return { valid: true };
}

// Character count helper with status
export function getCharCountStatus(
  current: number,
  max: number
): 'normal' | 'warning' | 'error' {
  const ratio = current / max;
  if (ratio > 1) return 'error';
  if (ratio > 0.9) return 'warning';
  return 'normal';
}

// Format character count display
export function formatCharCount(current: number, max: number): string {
  return `${current}/${max}`;
}
