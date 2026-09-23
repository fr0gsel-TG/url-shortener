import { Router } from 'express';
import { redirectController, shortenController, statsController } from '../controllers/urlController';
import { validateBody } from '../middleware/validate';
import { createShortUrlSchema } from '../utils/validation';

const router = Router();

// /api/* роуты регистрируются раньше catch-all /:shortCode для наглядности,
// хотя по количеству сегментов пути и HTTP-методам конфликтов между ними нет.
router.post('/api/shorten', validateBody(createShortUrlSchema), shortenController);
router.get('/api/stats/:shortCode', statsController);
router.get('/:shortCode', redirectController);

export default router;
