import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema, ZodError } from 'zod';
import { BadRequestError } from '../errors';

/**
 * Validation middleware factory that validates request data using Zod schemas
 * Supports validation of params, query, and body separately or together
 */
export function validateRequest(schema: { params?: ZodSchema; query?: ZodSchema; body?: ZodSchema }) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate params
      if (schema.params) {
        req.params = schema.params.parse(req.params) as typeof req.params;
      }

      // Validate query
      if (schema.query) {
        req.query = schema.query.parse(req.query) as typeof req.query;
      }

      // Validate body
      if (schema.body) {
        req.body = schema.body.parse(req.body);
      }

      next();
    } catch (error) {
      if (error instanceof ZodError && 'errors' in error && Array.isArray(error.errors)) {
        const errorMessages = error.errors.map(err => {
          const path = (err.path as string[]).join('.');
          return `${path}: ${err.message}`;
        });

        throw new BadRequestError(`Validation failed: ${errorMessages.join(', ')}`);
      }
      next(error);
    }
  };
}

/**
 * Helper to create pagination query schema
 */
export const paginationQuerySchema = z.object({
  skip: z.preprocess(
    (val) => (val === undefined ? '0' : String(val)),
    z.string().regex(/^\d+$/).transform(Number)
  ),
  limit: z.preprocess(
    (val) => (val === undefined ? '20' : String(val)),
    z.string().regex(/^\d+$/).transform(Number)
  )
});

/**
 * Helper to create MongoDB ObjectId param schema
 */
export const mongoIdParamSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid MongoDB ObjectId')
});

/**
 * Helper to create optional MongoDB ObjectId param schema
 */
export const optionalMongoIdParamSchema = z.object({
  id: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid MongoDB ObjectId')
    .optional()
});
