import { generateShortCode } from '../src/services/shortCodeGenerator';

describe('generateShortCode', () => {
  it('генерирует код длиной ровно 6 символов', () => {
    const code = generateShortCode();
    expect(code).toHaveLength(6);
  });

  it('использует только латиницу и цифры', () => {
    const code = generateShortCode();
    expect(code).toMatch(/^[A-Za-z0-9]{6}$/);
  });

  it('генерирует разные коды при повторных вызовах', () => {
    const codes = new Set(Array.from({ length: 100 }, () => generateShortCode()));
    // При 100 генерациях из пространства 62^6 совпадений практически быть не должно.
    expect(codes.size).toBeGreaterThan(95);
  });
});
