/**
 * Zod Validation Middleware
 * Spec: 016-backend-api (FR-002, FR-018)
 *
 * Middleware factory for validating request body, query, and params with Zod schemas
 */

import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { sendValidationError } from '../utils/response';
import logger from '../utils/logger';

// ========== TYPES ==========

/**
 * Validation target - which part of request to validate
 */
export type ValidationTarget = 'body' | 'query' | 'params';

/**
 * Validation options
 */
export interface ValidateOptions {
  /** Strip unknown properties (default: true) */
  stripUnknown?: boolean;
}

// ========== ERROR FORMATTING ==========

/**
 * Convert Zod error to field-level error details
 * Returns Record<field, string[]> format per FR-018
 */
function formatZodError(error: ZodError): Record<string, string[]> {
  const details: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const field = issue.path.join('.') || '_root';

    if (!details[field]) {
      details[field] = [];
    }

    details[field].push(issue.message);
  }

  return details;
}

// ========== MIDDLEWARE FACTORY ==========

/**
 * Create validation middleware for request body
 *
 * @param schema - Zod schema to validate against
 * @param options - Validation options
 * @returns Express middleware
 *
 * @example
 * ```typescript
 * router.post('/jobs', validateBody(jobSubmissionSchema), async (req, res) => {
 *   // req.body is typed and validated
 *   const data: JobSubmissionInput = req.body;
 * });
 * ```
 */
export function validateBody<T>(
  schema: ZodSchema<T>,
  options: ValidateOptions = {}
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = schema.safeParse(req.body);

      if (!result.success) {
        const details = formatZodError(result.error);
        logger.debug('Validation failed', {
          path: req.path,
          target: 'body',
          errors: details
        });
        return sendValidationError(res, 'Validation failed', details);
      }

      // Replace body with parsed/transformed data
      req.body = result.data;
      next();
    } catch (error) {
      logger.logError('Validation middleware error', error as Error, {
        path: req.path,
        target: 'body'
      });
      return sendValidationError(res, 'Validation error occurred');
    }
  };
}

/**
 * Create validation middleware for query parameters
 *
 * @param schema - Zod schema to validate against
 * @returns Express middleware
 *
 * @example
 * ```typescript
 * router.get('/jobs', validateQuery(jobListQuerySchema), async (req, res) => {
 *   // req.query is typed and validated
 *   const { status, limit, offset } = req.query;
 * });
 * ```
 */
export function validateQuery<T>(schema: ZodSchema<T>) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = schema.safeParse(req.query);

      if (!result.success) {
        const details = formatZodError(result.error);
        logger.debug('Query validation failed', {
          path: req.path,
          target: 'query',
          errors: details
        });
        return sendValidationError(res, 'Invalid query parameters', details);
      }

      // Replace query with parsed/transformed data
      (req as any).validatedQuery = result.data;
      next();
    } catch (error) {
      logger.logError('Query validation error', error as Error, {
        path: req.path,
        target: 'query'
      });
      return sendValidationError(res, 'Query validation error occurred');
    }
  };
}

/**
 * Create validation middleware for path parameters
 *
 * @param schema - Zod schema to validate against
 * @returns Express middleware
 *
 * @example
 * ```typescript
 * router.get('/jobs/:jobId', validateParams(jobIdParamSchema), async (req, res) => {
 *   // req.params is typed and validated
 *   const { jobId } = req.params;
 * });
 * ```
 */
export function validateParams<T>(schema: ZodSchema<T>) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = schema.safeParse(req.params);

      if (!result.success) {
        const details = formatZodError(result.error);
        logger.debug('Params validation failed', {
          path: req.path,
          target: 'params',
          errors: details
        });
        return sendValidationError(res, 'Invalid path parameters', details);
      }

      // Replace params with parsed data
      (req as any).validatedParams = result.data;
      next();
    } catch (error) {
      logger.logError('Params validation error', error as Error, {
        path: req.path,
        target: 'params'
      });
      return sendValidationError(res, 'Parameter validation error occurred');
    }
  };
}

/**
 * Combined validation middleware
 * Validates body, query, and/or params in one call
 *
 * @example
 * ```typescript
 * router.post('/jobs/:jobId/action',
 *   validate({
 *     body: actionSchema,
 *     params: jobIdParamSchema
 *   }),
 *   async (req, res) => {
 *     // Both are validated
 *   }
 * );
 * ```
 */
export function validate<
  TBody = unknown,
  TQuery = unknown,
  TParams = unknown
>(schemas: {
  body?: ZodSchema<TBody>;
  query?: ZodSchema<TQuery>;
  params?: ZodSchema<TParams>;
}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const errors: Record<string, Record<string, string[]>> = {};

    // Validate body
    if (schemas.body) {
      const result = schemas.body.safeParse(req.body);
      if (!result.success) {
        errors.body = formatZodError(result.error);
      } else {
        req.body = result.data;
      }
    }

    // Validate query
    if (schemas.query) {
      const result = schemas.query.safeParse(req.query);
      if (!result.success) {
        errors.query = formatZodError(result.error);
      } else {
        (req as any).validatedQuery = result.data;
      }
    }

    // Validate params
    if (schemas.params) {
      const result = schemas.params.safeParse(req.params);
      if (!result.success) {
        errors.params = formatZodError(result.error);
      } else {
        (req as any).validatedParams = result.data;
      }
    }

    // If any errors, return combined error response
    if (Object.keys(errors).length > 0) {
      // Flatten errors for response
      const flatErrors: Record<string, string[]> = {};
      for (const [target, targetErrors] of Object.entries(errors)) {
        for (const [field, messages] of Object.entries(targetErrors)) {
          const key = `${target}.${field}`;
          flatErrors[key] = messages;
        }
      }

      logger.debug('Combined validation failed', {
        path: req.path,
        errors: flatErrors
      });

      return sendValidationError(res, 'Validation failed', flatErrors);
    }

    next();
  };
}
