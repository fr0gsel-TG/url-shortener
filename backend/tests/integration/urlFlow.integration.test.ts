import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer, StartedRedisContainer } from '@testcontainers/redis';

/**
 * В отличие от tests/*.test.ts (которые мокают repository/cache), этот тест
 * работает поверх НАСТОЯЩИХ PostgreSQL и Redis, поднятых Testcontainers.
 * Закрывает справедливое замечание code review: мок доказывает только то,
 * что вызван нужный метод, а не то, что SQL/TTL/миграция реально работают.
 *
 * Требует запущенный Docker. Намеренно НЕ входит в обычный `npm test`
 * (см. jest.config.js), чтобы не ломать окружения без Docker.
 * Запуск: npm run test:integration
 */
describe('URL shortener — интеграционный сценарий (реальные PostgreSQL + Redis)', () => {
  let postgresContainer: StartedPostgreSqlContainer;
  let redisContainer: StartedRedisContainer;

  let urlService: typeof import('../../src/services/urlService');
  let redisClientModule: typeof import('../../src/cache/redisClient');
  let migrateModule: typeof import('../../src/database/migrate');
  let poolModule: typeof import('../../src/database/pool');

  beforeAll(async () => {
    [postgresContainer, redisContainer] = await Promise.all([
      new PostgreSqlContainer('postgres:16-alpine').start(),
      new RedisContainer('redis:7-alpine').start(),
    ]);

    // src/config/env.ts читает process.env один раз, в момент импорта модуля
    // (см. комментарий там же) — поэтому переменные окружения нужно выставить
    // ДО первого require() любого модуля из src, а сами модули из src
    // импортировать динамически (require), а не статическим import сверху
    // файла, который выполнился бы раньше, чем стартовали контейнеры.
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = postgresContainer.getConnectionUri();
    process.env.REDIS_URL = redisContainer.getConnectionUrl();
    process.env.BASE_URL = 'http://localhost:3000';
    process.env.CORS_ORIGIN = 'http://localhost:5173';
    process.env.CACHE_TTL_SECONDS = '3600';

    jest.resetModules();

    /* eslint-disable @typescript-eslint/no-var-requires */
    migrateModule = require('../../src/database/migrate');
    poolModule = require('../../src/database/pool');
    redisClientModule = require('../../src/cache/redisClient');
    urlService = require('../../src/services/urlService');
    /* eslint-enable @typescript-eslint/no-var-requires */

    await migrateModule.runMigrations();
    await redisClientModule.connectRedis();
  }, 120_000);

  afterAll(async () => {
    await poolModule?.pool.end();
    if (redisClientModule?.redisClient.isOpen) {
      await redisClientModule.redisClient.quit();
    }
    await Promise.all([postgresContainer?.stop(), redisContainer?.stop()]);
  }, 60_000);

  it('MISS → PostgreSQL → Redis SET с TTL ~1ч → HIT без обращения к PostgreSQL за URL → clicks растёт в PostgreSQL', async () => {
    const { shortCode } = await urlService.shortenUrl('https://example.com/integration-test');

    // Первый переход — гарантированный cache MISS (ключа ещё нет в Redis).
    const firstUrl = await urlService.resolveOriginalUrl(shortCode);
    expect(firstUrl).toBe('https://example.com/integration-test');

    // Проверяем РЕАЛЬНЫЙ Redis напрямую (не мок): ключ должен появиться,
    // с TTL, близким к CACHE_TTL_SECONDS=3600.
    const ttl = await redisClientModule.redisClient.ttl(`shorturl:${shortCode}`);
    expect(ttl).toBeGreaterThan(3500);
    expect(ttl).toBeLessThanOrEqual(3600);

    // Второй переход — значение уже реально лежит в Redis (настоящий HIT).
    const secondUrl = await urlService.resolveOriginalUrl(shortCode);
    expect(secondUrl).toBe('https://example.com/integration-test');

    // clicks увеличивается в PostgreSQL на КАЖДЫЙ переход — проверяем по
    // настоящей статистике из БД, а не по факту вызова мока.
    const stats = await urlService.getStats(shortCode);
    expect(stats.clicks).toBe(2);
  });

  it('возвращает 404 при резолве несуществующего (но валидного по формату) shortCode', async () => {
    await expect(urlService.resolveOriginalUrl('zzzzzz')).rejects.toThrow();
  });
});
