import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
  BASE_URL: z.string().url().default('http://localhost:3000'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(3600),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Валидирует process.env по envSchema и возвращает типизированный конфиг.
 * Намеренно бросает обычную Error, а НЕ вызывает process.exit(): модуль
 * конфигурации не должен решать за вызывающий код, как реагировать на
 * невалидные данные, и не должен незаметно убивать процесс при импорте —
 * это делало модуль неудобным для тестирования (импорт с "плохим" env убивал
 * тестовый воркер). Теперь loadEnv() можно вызвать в try/catch или проверить
 * через expect(() => loadEnv()).toThrow() (см. tests/env.test.ts).
 */
export function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const details = JSON.stringify(parsed.error.flatten().fieldErrors);
    throw new Error(`Invalid environment variables: ${details}`);
  }

  return parsed.data;
}

// Вычисляется один раз при первом импорте модуля — большинству файлов
// проекта удобнее готовый объект `env`, а не вызов loadEnv() в каждом месте
// (протаскивать env через dependency injection во все модули было бы
// избыточным рефакторингом для MVP такого масштаба).
//
// Если переменные окружения невалидны, ошибка вылетает уже на этапе
// импорта — до того, как отработает try/catch в bootstrap() из server.ts.
// Node в этом случае печатает полный stack trace в stderr и завершает
// процесс с ненулевым кодом сам, без нашего вмешательства. Поведение
// "упасть с понятным сообщением при плохом конфиге" сохранено, но теперь
// оно не спрятано внутри случайного модуля в виде побочного эффекта
// process.exit(), а выражено как обычная (пусть и не пойманная здесь) ошибка.
export const env: Env = loadEnv();
