import { RequestHandler } from 'express';
import { ZodSchema } from 'zod';
import { BadRequestError } from '../utils/errors';

/** Валидирует req.body по переданной Zod-схеме и заменяет его на распарсенные данные. */
export function validateBody(schema: ZodSchema): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const message = result.error.errors.map((e) => e.message).join('; ');
      next(new BadRequestError(message));
      return;
    }

    req.body = result.data;
    next();
  };
}
