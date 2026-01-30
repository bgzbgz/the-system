/**
 * Context Loader
 * Spec: 020-system-prompts (FR-002)
 *
 * Loads context documents (approach, criteria, feedback) at runtime.
 * Uses synchronous loading per NFR-001 (< 100ms startup).
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * Available context document names
 */
export type ContextName = 'approach' | 'criteria' | 'feedback';

/**
 * Context document file paths (relative to this directory)
 */
const CONTEXT_FILES: Record<ContextName, string> = {
  approach: 'approach.md',
  criteria: 'criteria.md',
  feedback: 'feedback.md'
};

/**
 * Cache for loaded context documents
 */
const contextCache: Map<ContextName, string> = new Map();

/**
 * Load a context document by name
 *
 * @param name - Context document name ('approach', 'criteria', or 'feedback')
 * @returns Content of the context document as string
 * @throws Error if context document not found
 */
export function loadContext(name: ContextName): string {
  // Check cache first
  if (contextCache.has(name)) {
    return contextCache.get(name)!;
  }

  const filename = CONTEXT_FILES[name];
  if (!filename) {
    throw new Error(`Unknown context document: ${name}`);
  }

  const filePath = path.join(__dirname, filename);

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    contextCache.set(name, content);
    return content;
  } catch (error) {
    throw new Error(`Failed to load context document '${name}': ${(error as Error).message}`);
  }
}

/**
 * Preload all context documents into cache
 * Call at startup for faster access during requests
 */
export function preloadAllContext(): void {
  const names: ContextName[] = ['approach', 'criteria', 'feedback'];
  for (const name of names) {
    loadContext(name);
  }
}

/**
 * Get all available context names
 */
export function getAvailableContextNames(): ContextName[] {
  return Object.keys(CONTEXT_FILES) as ContextName[];
}

/**
 * Check if a context document exists and is loadable
 */
export function isContextAvailable(name: ContextName): boolean {
  try {
    loadContext(name);
    return true;
  } catch {
    return false;
  }
}
