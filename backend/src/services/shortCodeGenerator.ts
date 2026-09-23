import { randomBytes } from 'crypto';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
export const SHORT_CODE_LENGTH = 6;

/**
 * Генерирует случайный shortCode фиксированной длины из [A-Za-z0-9],
 * используя криптографически стойкий генератор случайных байт.
 * Небольшое смещение распределения от modulo (256 % 62 != 0) в данном
 * масштабе задачи несущественно и осознанно принято ради простоты.
 */
export function generateShortCode(): string {
  const bytes = randomBytes(SHORT_CODE_LENGTH);
  let code = '';
  for (let i = 0; i < SHORT_CODE_LENGTH; i += 1) {
    code += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return code;
}
