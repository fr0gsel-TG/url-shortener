import morgan from 'morgan';
import { logger } from '../utils/logger';

/** Логирует method, URL, status и время обработки каждого HTTP-запроса. */
export const requestLogger = morgan(':method :url :status - :response-time ms', {
  stream: {
    write: (message: string) => logger.info(message.trim()),
  },
});
