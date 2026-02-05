/**
 * Principles API Routes
 *
 * Serves the Fast Track principle documents from the "three principles" folder.
 */

import { Router, Request, Response } from 'express';
import fs from 'fs/promises';
import path from 'path';

const router = Router();

// Path to the principles folder (inside backend directory for deployment)
const PRINCIPLES_PATH = path.resolve(__dirname, '../../the three principles');

interface PrincipleDocument {
  id: string;
  filename: string;
  title: string;
  size: number;
  category: string;
}

/**
 * GET /api/principles
 * List all principle documents
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const files = await fs.readdir(PRINCIPLES_PATH);

    const documents: PrincipleDocument[] = [];

    for (const filename of files) {
      if (!filename.endsWith('.md')) continue;

      const filepath = path.join(PRINCIPLES_PATH, filename);
      const stats = await fs.stat(filepath);

      // Create a clean title from filename
      const title = filename
        .replace('.md', '')
        .replace(/^\d+\s*/, '') // Remove leading numbers
        .replace(/\(\d+\)/, '') // Remove (1) style suffixes
        .trim();

      // Categorize documents
      let category = 'General';
      if (filename.toLowerCase().includes('criteria') || filename.toLowerCase().includes('point')) {
        category = '8-Point Criteria';
      } else if (filename.toLowerCase().includes('guide')) {
        category = 'Guides';
      } else if (filename.toLowerCase().includes('brand') || filename.toLowerCase().includes('fundamental')) {
        category = 'Brand & Fundamentals';
      } else if (filename.toLowerCase().includes('friction') || filename.toLowerCase().includes('blind')) {
        category = 'Client Experience';
      } else if (filename.toLowerCase().includes('definition') || filename.toLowerCase().includes('context')) {
        category = 'Tool Definition';
      }

      documents.push({
        id: Buffer.from(filename).toString('base64'),
        filename,
        title,
        size: stats.size,
        category
      });
    }

    // Sort by category, then by title
    documents.sort((a, b) => {
      const categoryOrder = ['8-Point Criteria', 'Tool Definition', 'Guides', 'Brand & Fundamentals', 'Client Experience', 'General'];
      const catA = categoryOrder.indexOf(a.category);
      const catB = categoryOrder.indexOf(b.category);
      if (catA !== catB) return catA - catB;
      return a.title.localeCompare(b.title);
    });

    res.json({
      success: true,
      data: documents
    });
  } catch (error) {
    console.error('[Principles] Error listing documents:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list principle documents'
    });
  }
});

/**
 * GET /api/principles/:id
 * Get a specific principle document content
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Decode the filename from base64
    const filename = Buffer.from(id, 'base64').toString('utf8');

    // Validate filename (prevent path traversal)
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      res.status(400).json({
        success: false,
        error: 'Invalid document ID'
      });
      return;
    }

    const filepath = path.join(PRINCIPLES_PATH, filename);

    // Check if file exists
    try {
      await fs.access(filepath);
    } catch {
      res.status(404).json({
        success: false,
        error: 'Document not found'
      });
      return;
    }

    // Read the file content
    const content = await fs.readFile(filepath, 'utf8');

    // Create title from filename
    const title = filename
      .replace('.md', '')
      .replace(/^\d+\s*/, '')
      .replace(/\(\d+\)/, '')
      .trim();

    res.json({
      success: true,
      data: {
        id,
        filename,
        title,
        content
      }
    });
  } catch (error) {
    console.error('[Principles] Error reading document:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to read principle document'
    });
  }
});

export default router;
