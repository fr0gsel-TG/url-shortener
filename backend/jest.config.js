/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/tests/**/*.test.ts'],
  // Интеграционные тесты (реальные PostgreSQL/Redis через Testcontainers)
  // запускаются отдельно, командой `npm run test:integration` — им нужен
  // Docker, и они не должны ломать обычный `npm test`.
  testPathIgnorePatterns: ['<rootDir>/tests/integration/'],
  setupFiles: ['<rootDir>/tests/setupEnv.ts'],
  clearMocks: true,
};
