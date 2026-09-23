import { createClient, RedisClientType } from 'redis';
import { env } from '../config/env';
import { logger } from '../utils/logger';

export const redisClient: RedisClientType = createClient({ url: env.REDIS_URL });

redisClient.on('error', (err: Error) => {
  logger.error('Redis client error', { error: err.message });
});

redisClient.on('connect', () => {
  logger.info('Redis connected');
});

export async function connectRedis(): Promise<void> {
  if (!redisClient.isOpen) {
    await redisClient.connect();
  }
}
