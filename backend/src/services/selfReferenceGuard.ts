import { env } from '../config/env';

/**
 * Проверяет, указывает ли originalUrl на этот же сервис (по хосту из BASE_URL).
 * Защищает от потенциального цикла short -> short -> short -> ...
 * Намеренно простая проверка по host, без глубокого анализа пути —
 * этого достаточно для целей MVP и не усложняет реализацию.
 */
export function pointsToSelf(originalUrl: string): boolean {
  try {
    const target = new URL(originalUrl);
    const base = new URL(env.BASE_URL);
    return target.host === base.host;
  } catch {
    return false;
  }
}
