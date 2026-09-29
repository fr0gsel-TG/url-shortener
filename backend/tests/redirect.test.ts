jest.mock('../src/repositories/urlRepository', () => ({
  existsByShortCode: jest.fn(),
  createUrl: jest.fn(),
  findByShortCode: jest.fn(),
  incrementClicks: jest.fn().mockResolvedValue(true),
}));

jest.mock('../src/cache/urlCache', () => ({
  getCachedUrl: jest.fn(),
  setCachedUrl: jest.fn().mockResolvedValue(undefined),
  deleteCachedUrl: jest.fn().mockResolvedValue(undefined),
}));

import request from 'supertest';
import { createApp } from '../src/app';
import * as repo from '../src/repositories/urlRepository';
import * as cache from '../src/cache/urlCache';

const app = createApp();

const mockedGetCachedUrl = cache.getCachedUrl as jest.Mock;
const mockedSetCachedUrl = cache.setCachedUrl as jest.Mock;
const mockedDeleteCachedUrl = cache.deleteCachedUrl as jest.Mock;
const mockedFindByShortCode = repo.findByShortCode as jest.Mock;
const mockedIncrementClicks = repo.incrementClicks as jest.Mock;

describe('GET /:shortCode', () => {
  afterEach(() => {
    jest.clearAllMocks();
    mockedIncrementClicks.mockResolvedValue(true);
  });

  it('cache MISS: читает из PostgreSQL, кладёт в Redis, редиректит и увеличивает clicks', async () => {
    mockedGetCachedUrl.mockResolvedValue(null);
    mockedFindByShortCode.mockResolvedValue({
      id: 1,
      shortCode: 'abc123',
      originalUrl: 'https://example.com',
      clicks: 0,
      createdAt: new Date(),
    });

    const res = await request(app).get('/abc123');

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('https://example.com');
    expect(mockedFindByShortCode).toHaveBeenCalledWith('abc123');
    expect(mockedSetCachedUrl).toHaveBeenCalledWith('abc123', 'https://example.com');
    expect(mockedIncrementClicks).toHaveBeenCalledWith('abc123');
  });

  it('cache HIT: НЕ обращается к PostgreSQL за original_url, но clicks увеличивает', async () => {
    mockedGetCachedUrl.mockResolvedValue('https://cached.example.com');

    const res = await request(app).get('/abc123');

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('https://cached.example.com');
    expect(mockedFindByShortCode).not.toHaveBeenCalled();
    expect(mockedIncrementClicks).toHaveBeenCalledWith('abc123');
  });

  it('cache HIT, но запись уже удалена из PostgreSQL: инвалидирует протухший кеш и возвращает 404', async () => {
    mockedGetCachedUrl.mockResolvedValue('https://cached-but-deleted.example.com');
    mockedIncrementClicks.mockResolvedValue(false); // UPDATE затронул 0 строк

    const res = await request(app).get('/abc123');

    expect(res.status).toBe(404);
    expect(mockedDeleteCachedUrl).toHaveBeenCalledWith('abc123');
  });

  it('cache MISS + валидный по формату, но не существующий в PostgreSQL shortCode → 404', async () => {
    mockedGetCachedUrl.mockResolvedValue(null);
    mockedFindByShortCode.mockResolvedValue(null);

    const res = await request(app).get('/zzzzzz');

    expect(res.status).toBe(404);
    expect(mockedIncrementClicks).not.toHaveBeenCalled();
  });

  it('возвращает 404 сразу, НЕ обращаясь к Redis/PostgreSQL, если shortCode структурно некорректен', async () => {
    // "doesnotexist" длиннее 6 символов — не может быть валидным shortCode в принципе.
    const res = await request(app).get('/doesnotexist');

    expect(res.status).toBe(404);
    expect(mockedGetCachedUrl).not.toHaveBeenCalled();
    expect(mockedFindByShortCode).not.toHaveBeenCalled();
  });
});
