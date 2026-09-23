import { env } from '../config/env';
import { getCachedUrl, setCachedUrl } from '../cache/urlCache';
import {
  createUrl,
  existsByShortCode,
  findByShortCode,
  incrementClicks,
} from '../repositories/urlRepository';
import { generateShortCode } from './shortCodeGenerator';
import { pointsToSelf } from './selfReferenceGuard';
import { BadRequestError, InternalError, NotFoundError } from '../utils/errors';
import { isUniqueViolation } from '../utils/dbErrors';
import { logger } from '../utils/logger';
import { CreateShortUrlResponse, ShortUrlStats, UrlRecord } from '../types';

const MAX_GENERATION_ATTEMPTS = 5;

/**
 * Создаёт короткую ссылку для originalUrl.
 * Генерирует shortCode, проверяет коллизии в БД и повторяет попытку при
 * их обнаружении (в том числе если UNIQUE constraint сработал из-за гонки
 * запросов между проверкой и вставкой).
 */
export async function shortenUrl(originalUrl: string): Promise<CreateShortUrlResponse> {
  if (pointsToSelf(originalUrl)) {
    throw new BadRequestError('originalUrl не может указывать на этот же сервис сокращения ссылок');
  }

  for (let attempt = 1; attempt <= MAX_GENERATION_ATTEMPTS; attempt += 1) {
    const candidate = generateShortCode();

    const alreadyExists = await existsByShortCode(candidate);
    if (alreadyExists) {
      logger.warn(`shortCode collision detected, regenerating (attempt ${attempt})`, { candidate });
      continue;
    }

    try {
      const record: UrlRecord = await createUrl(candidate, originalUrl);
      return {
        shortCode: record.shortCode,
        shortUrl: `${env.BASE_URL}/${record.shortCode}`,
      };
    } catch (err) {
      if (isUniqueViolation(err)) {
        logger.warn(`unique constraint race on shortCode, regenerating (attempt ${attempt})`, {
          candidate,
        });
        continue;
      }
      throw err;
    }
  }

  throw new InternalError('Не удалось сгенерировать уникальный shortCode, попробуйте ещё раз');
}

/**
 * Реализует cache-aside стратегию чтения оригинального URL:
 *  - Redis HIT  -> URL берётся из Redis, SELECT original_url к PostgreSQL НЕ выполняется.
 *  - Redis MISS -> URL читается из PostgreSQL, кладётся в Redis с TTL, затем возвращается.
 * В обоих случаях clicks инкрементируется в PostgreSQL (кеш не хранит счётчик).
 */
export async function resolveOriginalUrl(shortCode: string): Promise<string> {
  const cachedUrl = await getCachedUrl(shortCode);

  if (cachedUrl) {
    await incrementClicks(shortCode);
    return cachedUrl;
  }

  const record = await findByShortCode(shortCode);
  if (!record) {
    throw new NotFoundError('Короткая ссылка не найдена');
  }

  await setCachedUrl(shortCode, record.originalUrl);
  await incrementClicks(shortCode);

  return record.originalUrl;
}

/**
 * Возвращает статистику по shortCode. Читает напрямую из PostgreSQL
 * (без кеша), чтобы clicks всегда отражал актуальное значение.
 */
export async function getStats(shortCode: string): Promise<ShortUrlStats> {
  const record = await findByShortCode(shortCode);
  if (!record) {
    throw new NotFoundError('Короткая ссылка не найдена');
  }

  return {
    originalUrl: record.originalUrl,
    shortCode: record.shortCode,
    clicks: record.clicks,
    createdAt: record.createdAt.toISOString(),
  };
}
