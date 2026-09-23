jest.mock('../src/repositories/urlRepository', () => ({
  existsByShortCode: jest.fn(),
  createUrl: jest.fn(),
  findByShortCode: jest.fn(),
  incrementClicks: jest.fn(),
}));

import request from 'supertest';
import { createApp } from '../src/app';
import * as repo from '../src/repositories/urlRepository';

const app = createApp();
const mockedFindByShortCode = repo.findByShortCode as jest.Mock;

describe('GET /api/stats/:shortCode', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('возвращает статистику для существующего shortCode', async () => {
    const createdAt = new Date('2026-09-23T10:00:00.000Z');
    mockedFindByShortCode.mockResolvedValue({
      id: 1,
      shortCode: 'abc123',
      originalUrl: 'https://example.com',
      clicks: 15,
      createdAt,
    });

    const res = await request(app).get('/api/stats/abc123');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      originalUrl: 'https://example.com',
      shortCode: 'abc123',
      clicks: 15,
      createdAt: createdAt.toISOString(),
    });
  });

  it('возвращает 404 для несуществующего shortCode', async () => {
    mockedFindByShortCode.mockResolvedValue(null);

    const res = await request(app).get('/api/stats/doesnotexist');

    expect(res.status).toBe(404);
  });
});
