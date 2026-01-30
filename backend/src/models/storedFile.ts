/**
 * Fast Track Upload - Stored File Model
 * Spec: 006-boss-office-upload
 * Per data-model.md
 */

// ========== INTERFACES ==========

/**
 * Stored file entity - represents a binary file in storage
 */
export interface StoredFile {
  storage_key: string;
  job_id: string;
  content_type: string;
  size_bytes: number;
  original_filename: string;
  uploaded_at: Date;
}

/**
 * Stored file creation input
 */
export interface CreateStoredFileInput {
  job_id: string;
  content_type: string;
  size_bytes: number;
  original_filename: string;
}

// ========== MIME TYPE MAPPING ==========

/**
 * File extension to MIME type mapping
 */
export const MIME_TYPES: Record<string, string> = {
  'pdf': 'application/pdf',
  'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'txt': 'text/plain',
  'md': 'text/markdown'
};

/**
 * Get MIME type from filename
 */
export function getMimeType(filename: string): string {
  const extension = filename.split('.').pop()?.toLowerCase() || '';
  return MIME_TYPES[extension] || 'application/octet-stream';
}

// ========== FACTORY FUNCTIONS ==========

/**
 * Generate storage key for a file
 * Format: uploads/{job_id}/{sanitized_filename}
 */
export function generateStorageKey(jobId: string, filename: string): string {
  // Sanitize filename for storage path
  const sanitized = filename
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .replace(/\.+$/, '');

  return `uploads/${jobId}/${sanitized}`;
}

/**
 * Create a new StoredFile entity
 */
export function createStoredFile(
  input: CreateStoredFileInput,
  storageKey: string
): StoredFile {
  return {
    storage_key: storageKey,
    job_id: input.job_id,
    content_type: input.content_type,
    size_bytes: input.size_bytes,
    original_filename: input.original_filename,
    uploaded_at: new Date()
  };
}
