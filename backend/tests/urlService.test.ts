jest.mock('../src/repositories/urlRepository');

import * as repo from '../src/repositories/urlRepository';
import { shortenUrl } from '../src/services/urlService';

const mockedExists = repo.existsByShortCode as jest.Mock;
const mockedCreate = repo.createUrl as jest.Mock;

describe('shortenUrl — обработка коллизий', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('перегенерирует shortCode при обнаружении коллизии', async () => {
    // Первая попытка "занята", вторая — свободна.
    mockedExists.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    mockedCreate.mockResolvedValue({
      id: 1,
      shortCode: 'xxxxxx',
      originalUrl: 'https://example.com',
      clicks: 0,
      createdAt: new Date(),
    });

    const result = await shortenUrl('https://example.com');

    expect(mockedExists).toHaveBeenCalledTimes(2);
    expect(mockedCreate).toHaveBeenCalledTimes(1);
    expect(result.shortCode).toHaveLength(6);
    expect(result.shortUrl).toContain(result.shortCode);
  });

  it('отклоняет URL, указывающий на этот же сервис (защита от циклов)', async () => {
    await expect(shortenUrl('http://localhost:3000/abc123')).rejects.toThrow();
    expect(mockedExists).not.toHaveBeenCalled();
  });

  it('регенерирует код при гонке запросов (unique_violation на INSERT)', async () => {
    mockedExists.mockResolvedValue(false);
    mockedCreate
      .mockRejectedValueOnce(Object.assign(new Error('duplicate key'), { code: '23505' }))
      .mockResolvedValueOnce({
        id: 2,
        shortCode: 'yyyyyy',
        originalUrl: 'https://example.com',
        clicks: 0,
        createdAt: new Date(),
      });

    const result = await shortenUrl('https://example.com');

    expect(mockedCreate).toHaveBeenCalledTimes(2);
    expect(result.shortCode).toBe('yyyyyy');
  });
});
