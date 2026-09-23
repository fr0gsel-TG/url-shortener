import { ErrorRequestHandler } from 'express';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';

/**
 * Единая точка обработки ошибок.
 * Ожидаемые ошибки (AppError) отдаются клиенту как есть (statusCode + message).
 * Любая другая ошибка считается непредвиденной: клиенту уходит generic 500
 * без stack trace, а полная информация логируется на сервере.
 */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ message: err.message });
    return;
  }

  const stack = err instanceof Error ? err.stack : String(err);
  logger.error('Unhandled error', { error: stack, path: req.path, method: req.method });

  res.status(500).json({ message: 'Internal server error' });
};
