import { createShortUrlSchema } from '../src/utils/validation';

describe('createShortUrlSchema', () => {
  it.each(['https://google.com', 'http://example.com', 'https://example.com/test', 'https://example.com/path?q=123'])(
    'принимает валидный URL: %s',
    (url) => {
      expect(createShortUrlSchema.safeParse({ originalUrl: url }).success).toBe(true);
    },
  );

  it.each(['google.com', 'ftp://example.com', 'hello', 'not-a-url', ''])(
    'отклоняет невалидный URL: %s',
    (url) => {
      expect(createShortUrlSchema.safeParse({ originalUrl: url }).success).toBe(false);
    },
  );

  it('отклоняет запрос без originalUrl', () => {
    expect(createShortUrlSchema.safeParse({}).success).toBe(false);
  });
});
