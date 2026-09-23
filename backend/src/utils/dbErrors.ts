/**
 * PostgreSQL код ошибки "unique_violation".
 * https://www.postgresql.org/docs/current/errcodes-appendix.html
 */
const UNIQUE_VIOLATION_CODE = '23505';

interface PgLikeError {
  code?: string;
}

function hasErrorCode(err: unknown): err is PgLikeError {
  return typeof err === 'object' && err !== null && 'code' in err;
}

/**
 * Является ли ошибка нарушением UNIQUE constraint (например, short_code уже занят).
 * Используется как последний рубеж защиты от коллизий при гонке запросов.
 */
export function isUniqueViolation(err: unknown): boolean {
  return hasErrorCode(err) && err.code === UNIQUE_VIOLATION_CODE;
}
