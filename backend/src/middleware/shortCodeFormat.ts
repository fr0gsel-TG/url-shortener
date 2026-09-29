import { RequestHandler } from 'express';
import { NotFoundError } from '../utils/errors';

const SHORT_CODE_PATTERN = /^[A-Za-z0-9]{6}$/;

/**
 * Отсекает заведомо невозможные shortCode (неверная длина/алфавит) ДО похода
 * в Redis и PostgreSQL — например, браузерные /favicon.ico, /robots.txt и
 * прочий мусор не должны долетать до кеша и БД.
 *
 * Намеренно возвращает 404, а не 400: с точки зрения клиента "такого кода
 * структурно не может существовать" неотличимо от "такого кода нет в базе" —
 * в обоих случаях это "ссылка не найдена". ТЗ явно ожидает 404 для любого
 * несуществующего shortCode (см. сценарий `GET /doesnotexist` → 404), и это
 * не валидация пользовательского ввода в смысле POST /api/shorten (там
 * пользователь осознанно вводит URL), а внутренняя оптимизация запроса.
 */
export const requireShortCodeFormat: RequestHandler = (req, _res, next) => {
  if (!SHORT_CODE_PATTERN.test(req.params.shortCode)) {
    next(new NotFoundError('Короткая ссылка не найдена'));
    return;
  }
  next();
};
