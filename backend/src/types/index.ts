/**
 * Доменная модель записи в таблице urls.
 */
export interface UrlRecord {
  id: number;
  shortCode: string;
  originalUrl: string;
  clicks: number;
  createdAt: Date;
}

/** Тело запроса POST /api/shorten */
export interface CreateShortUrlRequest {
  originalUrl: string;
}

/** Ответ POST /api/shorten */
export interface CreateShortUrlResponse {
  shortCode: string;
  shortUrl: string;
}

/** Ответ GET /api/stats/:shortCode */
export interface ShortUrlStats {
  originalUrl: string;
  shortCode: string;
  clicks: number;
  createdAt: string;
}

/** Единый формат ошибки, отдаваемый клиенту */
export interface ApiErrorBody {
  message: string;
}
