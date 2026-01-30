/**
 * System Context Model
 * Spec: 017-mongodb-schema
 *
 * Per data-model.md System Context Collection schema
 * Configuration documents used by AI factory agents
 */

import { ObjectId } from 'mongodb';

/**
 * System context document
 * Per data-model.md SystemContext interface
 */
export interface SystemContext {
  _id?: ObjectId;
  key: string;                        // Unique identifier
  title: string;                      // Display name
  content: string;                    // Markdown content
  version: number;                    // Increments on update
  updated_at: Date;
}

/**
 * Input for updating system context content
 */
export interface UpdateContextInput {
  content: string;
}

/**
 * System context API response
 */
export interface SystemContextResponse {
  key: string;
  title: string;
  content: string;
  version: number;
  updated_at: string;
}

/**
 * Convert system context to response format
 */
export function systemContextToResponse(context: SystemContext): SystemContextResponse {
  return {
    key: context.key,
    title: context.title,
    content: context.content,
    version: context.version,
    updated_at: context.updated_at.toISOString()
  };
}

/**
 * System context list response
 */
export interface SystemContextListResponse {
  contexts: SystemContextResponse[];
}
