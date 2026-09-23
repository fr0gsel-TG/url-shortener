jest.mock('../src/repositories/urlRepository', () => ({
  existsByShortCode: jest.fn().mockResolvedValue(false),
  createUrl: jest.fn().mockImplementation((shortCode: string, originalUrl: string) =>
    Promise.resolve({
      id: 1,
      shortCode,
      originalUrl,
      clicks: 0,
      createdAt: new Date(),
    }),
  ),
  findByShortCode: jest.fn(),
  incrementClicks: jest.fn(),
}));

import request from 'supertest';
import { createApp } from '../src/app';

const app = createApp();

describe('POST /api/shorten', () => {
  it('создаёт короткую ссылку для валидного URL (201)', async () => {
    const res = await request(app)
      .post('/api/shorten')
      .send({ originalUrl: 'https://example.com/some/very/long/url' });

    expect(res.status).toBe(201);
    expect(res.body.shortCode).toHaveLength(6);
    expect(res.body.shortCode).toMatch(/^[A-Za-z0-9]{6}$/);
    expect(res.body.shortUrl).toBe(`http://localhost:3000/${String(res.body.shortCode)}`);
  });

  it('отклоняет невалидный URL с 400', async () => {
    const res = await request(app).post('/api/shorten').send({ originalUrl: 'google.com' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBeDefined();
  });

  it('отклоняет запрос без originalUrl с 400', async () => {
    const res = await request(app).post('/api/shorten').send({});
    expect(res.status).toBe(400);
  });

  it('отвечает JSON, а не HTML/stack trace, при ошибке валидации', async () => {
    const res = await request(app).post('/api/shorten').send({ originalUrl: 'not-a-url' });
    expect(res.type).toBe('application/json');
    expect(res.body.message).not.toMatch(/at\s+.*\(.*:\d+:\d+\)/); // похоже на JS stack trace
  });
});
