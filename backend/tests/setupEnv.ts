// Устанавливаем env-переменные ДО импорта src/config/env.ts в тестах,
// иначе zod-валидация обязательных полей (DATABASE_URL, REDIS_URL) провалится
// и process.exit(1) убьёт тестовый процесс.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.BASE_URL = 'http://localhost:3000';
process.env.CORS_ORIGIN = 'http://localhost:5173';
process.env.PORT = '3000';
process.env.CACHE_TTL_SECONDS = '3600';
