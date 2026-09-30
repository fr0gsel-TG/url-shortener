/**
 * Раньше config/env.ts вызывал process.exit(1) прямо при импорте, если
 * переменные окружения были невалидны — это убивало Jest-воркер и сделать
 * такой тест было невозможно. После рефакторинга (см. src/config/env.ts)
 * loadEnv() просто бросает Error, поэтому её можно спокойно тестировать.
 */
describe('loadEnv', () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('бросает описательную ошибку, если обязательные переменные отсутствуют', () => {
    delete process.env.DATABASE_URL;
    delete process.env.REDIS_URL;

    // env вычисляется eagerly при импорте модуля (см. `export const env`
    // в src/config/env.ts), поэтому ошибку бросает уже сам require(), а не
    // последующий явный вызов loadEnv() — именно require() и нужно
    // оборачивать в expect(...).toThrow().
    expect(() => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      require('../src/config/env');
    }).toThrow(/Invalid environment variables/);
  });

  it('возвращает распарсенный конфиг, если все обязательные переменные заданы', () => {
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
    process.env.REDIS_URL = 'redis://localhost:6379';

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { loadEnv } = require('../src/config/env') as typeof import('../src/config/env');
    const env = loadEnv();

    expect(env.DATABASE_URL).toBe(process.env.DATABASE_URL);
    expect(env.REDIS_URL).toBe(process.env.REDIS_URL);
    expect(env.PORT).toBe(3000); // значение по умолчанию
  });
});
