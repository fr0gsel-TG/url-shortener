import { Pool } from 'pg';
import { env } from '../config/env';
import { logger } from '../utils/logger';

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
});

// Ошибки на неиспользуемых (idle) клиентах пула не должны валить процесс,
// но обязаны попадать в лог для диагностики.
pool.on('error', (err) => {
  logger.error('Unexpected PostgreSQL pool error', { error: err.message });
});
