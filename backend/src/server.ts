import type { Server } from 'http';
import { createApp } from './app';
import { env } from './config/env';
import { pool } from './database/pool';
import { runMigrations } from './database/migrate';
import { connectRedis, redisClient } from './cache/redisClient';
import { logger } from './utils/logger';

const MAX_RETRIES = 15;
const RETRY_DELAY_MS = 2000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/** Ждёт готовности PostgreSQL, чтобы backend не падал при старте до БД (например, в Docker). */
async function waitForPostgres(): Promise<void> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      await pool.query('SELECT 1');
      logger.info('PostgreSQL connection established');
      return;
    } catch {
      logger.warn(`PostgreSQL is not ready yet (attempt ${attempt}/${MAX_RETRIES})`);
      await delay(RETRY_DELAY_MS);
    }
  }
  throw new Error('Could not connect to PostgreSQL after multiple attempts');
}

/** Ждёт готовности Redis по тому же принципу, что и PostgreSQL. */
async function waitForRedis(): Promise<void> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      await connectRedis();
      await redisClient.ping();
      logger.info('Redis connection established');
      return;
    } catch {
      logger.warn(`Redis is not ready yet (attempt ${attempt}/${MAX_RETRIES})`);
      await delay(RETRY_DELAY_MS);
    }
  }
  throw new Error('Could not connect to Redis after multiple attempts');
}

function setupGracefulShutdown(server: Server): void {
  const shutdown = (signal: string): void => {
    logger.info(`${signal} received, shutting down gracefully`);
    server.close(() => {
      logger.info('HTTP server closed');
    });

    void Promise.allSettled([pool.end(), redisClient.isOpen ? redisClient.quit() : Promise.resolve()]).then(
      () => process.exit(0),
    );
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

async function bootstrap(): Promise<void> {
  await waitForPostgres();
  await runMigrations();
  await waitForRedis();

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info(`Server listening on port ${env.PORT}`);
  });

  setupGracefulShutdown(server);
}

bootstrap().catch((err: unknown) => {
  const stack = err instanceof Error ? err.stack : String(err);
  logger.error('Failed to start server', { error: stack });
  process.exit(1);
});
