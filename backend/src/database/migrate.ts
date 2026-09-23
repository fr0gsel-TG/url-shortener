import fs from 'fs';
import path from 'path';
import { pool } from './pool';
import { logger } from '../utils/logger';

/**
 * Применяет init.sql (идемпотентная схема) к базе данных.
 * Вынесено отдельным шагом, чтобы при старте контейнера/процесса
 * не требовалась ручная миграция.
 */
export async function runMigrations(): Promise<void> {
  const sqlPath = path.join(__dirname, 'init.sql');
  const sql = fs.readFileSync(sqlPath, 'utf-8');
  await pool.query(sql);
  logger.info('Database schema is ready');
}
