import winston from 'winston';
import { env } from '../config/env';

/**
 * Единый логгер приложения. Используется для HTTP-логов (через morgan),
 * логов кеша (CACHE HIT/MISS) и логирования ошибок.
 * Секреты и содержимое .env сюда никогда не передаются.
 */
export const logger = winston.createLogger({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
      return `[${String(timestamp)}] ${level.toUpperCase()}: ${String(message)}${metaStr}`;
    }),
  ),
  transports: [new winston.transports.Console()],
});
