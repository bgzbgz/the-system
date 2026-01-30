/**
 * Fast Track Upload - File Storage Service
 * Spec: 006-boss-office-upload
 * Per data-model.md
 *
 * Handles storing and retrieving uploaded files
 * Default: Local filesystem storage
 * Can be extended for cloud storage (Azure Blob, AWS S3)
 */

import * as fs from 'fs';
import * as path from 'path';
import { StoredFile, generateStorageKey, getMimeType } from '../models/storedFile';

// ========== CONFIGURATION ==========

/**
 * Base directory for file storage
 * Override with UPLOAD_STORAGE_PATH environment variable
 */
const STORAGE_BASE_PATH = process.env.UPLOAD_STORAGE_PATH || './uploads';

// ========== INITIALIZATION ==========

/**
 * Ensure storage directory exists
 */
function ensureStorageDirectory(): void {
  if (!fs.existsSync(STORAGE_BASE_PATH)) {
    fs.mkdirSync(STORAGE_BASE_PATH, { recursive: true });
  }
}

// Initialize on module load
ensureStorageDirectory();

// ========== STORAGE FUNCTIONS ==========

/**
 * Store a file and return storage metadata
 *
 * @param jobId - The job ID to associate with the file
 * @param filename - Original filename
 * @param buffer - File content as Buffer
 * @returns StoredFile metadata
 * @throws Error if storage fails
 */
export async function storeFile(
  jobId: string,
  filename: string,
  buffer: Buffer
): Promise<StoredFile> {
  // Generate storage key
  const storageKey = generateStorageKey(jobId, filename);

  // Create job directory
  const jobDir = path.join(STORAGE_BASE_PATH, jobId);
  if (!fs.existsSync(jobDir)) {
    fs.mkdirSync(jobDir, { recursive: true });
  }

  // Full path for the file
  const filePath = path.join(STORAGE_BASE_PATH, storageKey.replace(`uploads/${jobId}/`, ''));
  const fullPath = path.join(jobDir, path.basename(filePath));

  try {
    // Write file to disk
    await fs.promises.writeFile(fullPath, buffer);

    // Create stored file metadata
    const storedFile: StoredFile = {
      storage_key: storageKey,
      job_id: jobId,
      content_type: getMimeType(filename),
      size_bytes: buffer.length,
      original_filename: filename,
      uploaded_at: new Date()
    };

    return storedFile;

  } catch (error) {
    throw new Error(`Storage unavailable. Try again later.`);
  }
}

/**
 * Retrieve a file by storage key
 *
 * @param storageKey - The storage key from StoredFile
 * @returns File content as Buffer
 * @throws Error if file not found
 */
export async function retrieveFile(storageKey: string): Promise<Buffer> {
  // Parse storage key to get path
  // Format: uploads/{job_id}/{filename}
  const parts = storageKey.split('/');
  if (parts.length < 3) {
    throw new Error('Invalid storage key');
  }

  const jobId = parts[1];
  const filename = parts.slice(2).join('/');
  const fullPath = path.join(STORAGE_BASE_PATH, jobId, filename);

  try {
    return await fs.promises.readFile(fullPath);
  } catch (error) {
    throw new Error('File not found');
  }
}

/**
 * Delete a file by storage key
 *
 * @param storageKey - The storage key to delete
 * @returns true if deleted, false if not found
 */
export async function deleteFile(storageKey: string): Promise<boolean> {
  const parts = storageKey.split('/');
  if (parts.length < 3) {
    return false;
  }

  const jobId = parts[1];
  const filename = parts.slice(2).join('/');
  const fullPath = path.join(STORAGE_BASE_PATH, jobId, filename);

  try {
    await fs.promises.unlink(fullPath);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Check if a file exists
 *
 * @param storageKey - The storage key to check
 * @returns true if exists
 */
export async function fileExists(storageKey: string): Promise<boolean> {
  const parts = storageKey.split('/');
  if (parts.length < 3) {
    return false;
  }

  const jobId = parts[1];
  const filename = parts.slice(2).join('/');
  const fullPath = path.join(STORAGE_BASE_PATH, jobId, filename);

  return fs.existsSync(fullPath);
}

/**
 * Get file metadata without retrieving content
 *
 * @param storageKey - The storage key
 * @returns File stats or null if not found
 */
export async function getFileStats(storageKey: string): Promise<{ size: number; modified: Date } | null> {
  const parts = storageKey.split('/');
  if (parts.length < 3) {
    return null;
  }

  const jobId = parts[1];
  const filename = parts.slice(2).join('/');
  const fullPath = path.join(STORAGE_BASE_PATH, jobId, filename);

  try {
    const stats = await fs.promises.stat(fullPath);
    return {
      size: stats.size,
      modified: stats.mtime
    };
  } catch (error) {
    return null;
  }
}
