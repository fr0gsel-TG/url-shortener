import { Router } from 'express';
import { redirectController, shortenController, statsController } from '../controllers/urlController';
import { requireShortCodeFormat } from '../middleware/shortCodeFormat';
import { validateBody } from '../middleware/validate';
import { createShortUrlSchema } from '../utils/validation';

const router = Router();

// Конкретные /api/* маршруты — выше catch-all по /:shortCode.
router.post('/api/shorten', validateBody(createShortUrlSchema), shortenController);
router.get('/api/stats/:shortCode', requireShortCodeFormat, statsController);

// GET /:shortCode — catch-all для одного сегмента пути: ловит всё, что не
// подошло под маршруты выше. ДОЛЖЕН оставаться последним в файле: если сюда
// в будущем добавят ещё один одно-сегментный GET-маршрут (например, случайно
// объявят его ниже этой строки), Express молча отдаст такие запросы сюда
// вместо нужного обработчика. Порядок — это инвариант, а не деталь на один раз.
router.get('/:shortCode', requireShortCodeFormat, redirectController);

export default router;
