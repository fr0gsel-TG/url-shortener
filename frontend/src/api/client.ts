import type { ApiErrorResponse, ShortenResponse, StatsResponse } from '../types';

// URL backend-сервера берётся из переменной окружения, а не хардкодится.
const API_URL: string = import.meta.env.VITE_API_URL || 'http://localhost:3000';

async function extractErrorMessage(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as ApiErrorResponse;
    return data.message || 'Произошла ошибка';
  } catch {
    return 'Произошла ошибка';
  }
}

export async function shortenUrl(originalUrl: string): Promise<ShortenResponse> {
  const res = await fetch(`${API_URL}/api/shorten`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ originalUrl }),
  });

  if (!res.ok) {
    throw new Error(await extractErrorMessage(res));
  }

  return (await res.json()) as ShortenResponse;
}

export async function fetchStats(shortCode: string): Promise<StatsResponse> {
  const res = await fetch(`${API_URL}/api/stats/${encodeURIComponent(shortCode)}`);

  if (!res.ok) {
    throw new Error(await extractErrorMessage(res));
  }

  return (await res.json()) as StatsResponse;
}
