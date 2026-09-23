import { pool } from '../database/pool';
import { UrlRecord } from '../types';

/** Сырая строка из PostgreSQL (snake_case, как в таблице). */
interface UrlRow {
  id: number;
  short_code: string;
  original_url: string;
  clicks: number;
  created_at: Date;
}

function mapRowToRecord(row: UrlRow): UrlRecord {
  return {
    id: row.id,
    shortCode: row.short_code,
    originalUrl: row.original_url,
    clicks: row.clicks,
    createdAt: row.created_at,
  };
}

/** Проверяет, существует ли уже запись с таким short_code (для проверки коллизий). */
export async function existsByShortCode(shortCode: string): Promise<boolean> {
  const result = await pool.query<{ exists: boolean }>(
    'SELECT EXISTS(SELECT 1 FROM urls WHERE short_code = $1) AS exists',
    [shortCode],
  );
  return result.rows[0]?.exists ?? false;
}

/** Ищет запись по short_code. Возвращает null, если ничего не найдено. */
export async function findByShortCode(shortCode: string): Promise<UrlRecord | null> {
  const result = await pool.query<UrlRow>('SELECT * FROM urls WHERE short_code = $1', [shortCode]);
  const row = result.rows[0];
  return row ? mapRowToRecord(row) : null;
}

/**
 * Создаёт новую запись. Может выбросить ошибку unique_violation (23505),
 * если между проверкой existsByShortCode и вставкой произошла гонка запросов —
 * это последний рубеж защиты от коллизий, обрабатывается в сервисном слое.
 */
export async function createUrl(shortCode: string, originalUrl: string): Promise<UrlRecord> {
  const result = await pool.query<UrlRow>(
    `INSERT INTO urls (short_code, original_url)
     VALUES ($1, $2)
     RETURNING *`,
    [shortCode, originalUrl],
  );
  return mapRowToRecord(result.rows[0]);
}

/**
 * Атомарно увеличивает счётчик переходов на 1.
 * Используется как при cache MISS, так и при cache HIT — кешируется только
 * originalUrl, а не clicks, поэтому счётчик всегда актуален в БД.
 */
export async function incrementClicks(shortCode: string): Promise<void> {
  await pool.query('UPDATE urls SET clicks = clicks + 1 WHERE short_code = $1', [shortCode]);
}
