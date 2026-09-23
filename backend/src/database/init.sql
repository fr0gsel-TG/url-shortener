-- Схема БД для URL shortener MVP.
-- Выполняется автоматически при старте backend (см. src/database/migrate.ts),
-- поэтому написана идемпотентно (IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS urls (
  id SERIAL PRIMARY KEY,
  short_code VARCHAR(10) UNIQUE NOT NULL,
  original_url TEXT NOT NULL,
  clicks INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- short_code уже имеет уникальный индекс благодаря UNIQUE, но явный индекс
-- по нему ускоряет SELECT по short_code (основной паттерн доступа).
CREATE INDEX IF NOT EXISTS idx_urls_short_code ON urls (short_code);
