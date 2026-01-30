import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';
import type { FileType } from '../types/index.ts';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

// Detect file type from extension
export function detectFileType(filename: string): FileType | null {
  const extension = filename.toLowerCase().split('.').pop();
  switch (extension) {
    case 'pdf':
      return 'pdf';
    case 'docx':
      return 'docx';
    case 'md':
      return 'md';
    case 'txt':
      return 'txt';
    default:
      return null;
  }
}

// Extract text from PDF file
async function extractPdfText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const textParts: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ');
    textParts.push(pageText);
  }

  return textParts.join('\n\n');
}

// Extract text from DOCX file
async function extractDocxText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

// Extract text from plain text file (MD, TXT)
async function extractPlainText(file: File): Promise<string> {
  return await file.text();
}

// Main extraction function
export async function extractText(file: File): Promise<string> {
  const fileType = detectFileType(file.name);

  if (!fileType) {
    throw new Error(`Unsupported file type: ${file.name}`);
  }

  try {
    switch (fileType) {
      case 'pdf':
        return await extractPdfText(file);
      case 'docx':
        return await extractDocxText(file);
      case 'md':
      case 'txt':
        return await extractPlainText(file);
      default:
        throw new Error(`Unsupported file type: ${fileType}`);
    }
  } catch (error) {
    // Handle specific error cases
    if (error instanceof Error) {
      // Password-protected PDF
      if (error.message.includes('password')) {
        throw new Error('This PDF is password-protected. Please provide an unprotected file.');
      }
      // Corrupted file
      if (error.message.includes('Invalid') || error.message.includes('corrupt')) {
        throw new Error('The file appears to be corrupted. Please try a different file.');
      }
      throw error;
    }
    throw new Error('Failed to extract text from file');
  }
}

// Format file size for display
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
