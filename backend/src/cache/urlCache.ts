import { redisClient } from './redisClient';
import { env } from '../config/env';
import { logger } from '../utils/logger';

const CACHE_KEY_PREFIX = 'shorturl:';

function cacheKey(shortCode: string): string {
  return `${CACHE_KEY_PREFIX}${shortCode}`;
}

/**
 * Возвращает оригинальный URL из Redis, если он там есть.
 * Явно логирует CACHE HIT / CACHE MISS, чтобы работу кеша можно было
 * проверить по логам, как того требует ТЗ.
 */
export async function getCachedUrl(shortCode: string): Promise<string | null> {
  const value = await redisClient.get(cacheKey(shortCode));

  if (value) {
    logger.info(`CACHE HIT: ${shortCode}`);
    return value;
  }

  logger.info(`CACHE MISS: ${shortCode}`);
  return null;
}

/** Кладёт originalUrl в Redis с TTL = 1 час (настраивается через CACHE_TTL_SECONDS). */
export async function setCachedUrl(shortCode: string, originalUrl: string): Promise<void> {
  await redisClient.set(cacheKey(shortCode), originalUrl, { EX: env.CACHE_TTL_SECONDS });
}
