import { pointsToSelf } from '../src/services/selfReferenceGuard';

describe('pointsToSelf', () => {
  it('обнаруживает URL, указывающий на BASE_URL этого сервиса', () => {
    expect(pointsToSelf('http://localhost:3000/abc123')).toBe(true);
  });

  it('пропускает внешние URL', () => {
    expect(pointsToSelf('https://example.com')).toBe(false);
  });

  it('возвращает false для некорректного URL, не бросая исключение', () => {
    expect(pointsToSelf('not-a-url')).toBe(false);
  });
});
