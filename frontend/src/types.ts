export interface ShortenResponse {
  shortCode: string;
  shortUrl: string;
}

export interface StatsResponse {
  originalUrl: string;
  shortCode: string;
  clicks: number;
  createdAt: string;
}

export interface ApiErrorResponse {
  message: string;
}
