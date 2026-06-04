import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

export function validate(schema: ZodSchema, source: 'body' | 'query' | 'params' = 'body') {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      return next({ statusCode: 400, code: 'VALIDATION_ERROR', message: 'Validation failed', details: result.error.errors, name: 'AppError' });
    }
    req[source] = result.data;
    next();
  };
}
