import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

/**
 * Generic Zod validation middleware factory.
 *
 * @param schema - The Zod schema to validate against.
 * @param source - Which part of the request to validate (`body` or `query`). Defaults to `body`.
 */
export const validate = (schema: ZodSchema, source: 'body' | 'query' = 'body') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const data = schema.parse(source === 'query' ? req.query : req.body);

      // Replace the source with parsed (and potentially transformed) data
      if (source === 'query') {
        req.query = data;
      } else {
        req.body = data;
      }

      next();
    } catch (error) {
      if (
        error instanceof ZodError ||
        (error as any)?.name === 'ZodError' ||
        Array.isArray((error as any)?.issues)
      ) {
        const issues = (error as any).issues || (error as any).errors || [];
        const formattedErrors = issues.map((err: any) => ({
          field: Array.isArray(err.path) ? err.path.join('.') : String(err.path || ''),
          message: err.message,
        }));

        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: formattedErrors,
        });
        return;
      }

      next(error);
    }
  };
};
