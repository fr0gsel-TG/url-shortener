import { env } from '../config/env';
import { deleteCachedUrl, getCachedUrl, setCachedUrl } from '../cache/urlCache';
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
 *
 * ВАЖНЫЙ КОМПРОМИСС (осознанный, не забытый): clicks инкрементируется в
 * PostgreSQL при КАЖДОМ переходе — и при HIT, и при MISS, — то есть кеш
 * экономит только чтение original_url, но не запись счётчика. Это прямо
 * следует из ТЗ: диаграмма "Повторный переход" явно требует
 * `PostgreSQL → clicks + 1` даже после `Redis HIT`. Буферизовать clicks в
 * Redis (INCR + периодический flush в БД) и тем самым разгрузить PostgreSQL
 * ещё сильнее — возможное дальнейшее развитие для реального
 * высоконагруженного сервиса, но для MVP это осознанно не сделано: такая
 * буферизация рискует потерять часть счётчика при падении процесса между
 * INCR и flush, а платим мы за это дополнительной сложностью, не
 * предусмотренной техническим заданием.
 */
export async function resolveOriginalUrl(shortCode: string): Promise<string> {
  const cachedUrl = await getCachedUrl(shortCode);

  if (cachedUrl) {
    const wasUpdated = await incrementClicks(shortCode);

    if (!wasUpdated) {
      // Redis ещё хранит значение, но соответствующей записи в PostgreSQL
      // уже нет (например, её удалили напрямую из БД в обход сервиса).
      // Источник истины — PostgreSQL, поэтому инвалидируем протухший кеш и
      // сообщаем клиенту, что ссылки не существует, вместо того чтобы молча
      // редиректить на данные, которых по факту уже нет.
      await deleteCachedUrl(shortCode);
      throw new NotFoundError('Короткая ссылка не найдена');
    }

    return cachedUrl;
  }

  const record = await findByShortCode(shortCode);
  if (!record) {
    throw new NotFoundError('Короткая ссылка не найдена');
  }

  await setCachedUrl(shortCode, record.originalUrl);

  const wasUpdated = await incrementClicks(shortCode);
  if (!wasUpdated) {
    // Крайне маловероятная гонка: запись удалили в промежутке между
    // findByShortCode и UPDATE. originalUrl мы всё равно только что легитимно
    // прочитали, поэтому не отказываем в редиректе — просто логируем аномалию.
    logger.warn('incrementClicks affected 0 rows right after findByShortCode', { shortCode });
  }

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
