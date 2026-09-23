import { useState } from 'react';
import type { FormEvent } from 'react';
import { shortenUrl } from '../api/client';
import type { ShortenResponse } from '../types';

export function ShortenForm() {
  const [url, setUrl] = useState('');
  const [result, setResult] = useState<ShortenResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    setResult(null);
    setCopied(false);
    setLoading(true);

    try {
      const response = await shortenUrl(url.trim());
      setResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Введите корректный URL');
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy(): Promise<void> {
    if (!result) return;

    try {
      await navigator.clipboard.writeText(result.shortUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Не удалось скопировать ссылку');
    }
  }

  return (
    <section className="card">
      <h2>Сократить ссылку</h2>
      <form onSubmit={(e) => void handleSubmit(e)} className="form-row">
        <input
          type="text"
          placeholder="https://example.com/some/very/long/url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={loading}
          required
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Загрузка...' : 'Сократить'}
        </button>
      </form>

      {error && <p className="error-text">{error}</p>}

      {result && (
        <div className="result-box">
          <a href={result.shortUrl} target="_blank" rel="noopener noreferrer">
            {result.shortUrl}
          </a>
          <button type="button" onClick={() => void handleCopy()} className="secondary-button">
            {copied ? 'Скопировано' : 'Копировать в буфер обмена'}
          </button>
        </div>
      )}
    </section>
  );
}
