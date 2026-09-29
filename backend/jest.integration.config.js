/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/tests/integration/**/*.integration.test.ts'],
  // Контейнерам нужно время на первый pull образов и старт — тестовый
  // таймаут увеличен по сравнению с дефолтными 5 секундами Jest.
  testTimeout: 120_000,
};
