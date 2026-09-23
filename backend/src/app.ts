import express, { Application } from 'express';
import cors from 'cors';
import { env } from './config/env';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler } from './middleware/errorHandler';
import urlRoutes from './routes/urlRoutes';

/**
 * Фабрика Express-приложения. Вынесена отдельно от server.ts,
 * чтобы приложение можно было создавать в тестах без реального listen().
 */
export function createApp(): Application {
  const app = express();

  app.use(cors({ origin: env.CORS_ORIGIN }));
  app.use(express.json());
  app.use(requestLogger);

  // Health-check для Docker/оркестрации, обрабатывается до основных роутов,
  // чтобы не создавать лишнюю нагрузку на БД/Redis.
  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  app.use(urlRoutes);

  // Любой не найденный маршрут (кроме /:shortCode, который обработан в urlRoutes)
  // должен возвращать предсказуемый JSON, а не HTML по умолчанию от Express.
  app.use((_req, res) => {
    res.status(404).json({ message: 'Not found' });
  });

  app.use(errorHandler);

  return app;
}
