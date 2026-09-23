import { z } from 'zod';

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return ALLOWED_PROTOCOLS.has(url.protocol);
  } catch {
    return false;
  }
}

/** Схема тела запроса POST /api/shorten. */
export const createShortUrlSchema = z.object({
  originalUrl: z
    .string({ required_error: 'originalUrl обязателен' })
    .min(1, 'originalUrl обязателен')
    .refine(isValidHttpUrl, {
      message: 'originalUrl должен быть корректным http или https URL',
    }),
});

export type CreateShortUrlInput = z.infer<typeof createShortUrlSchema>;
