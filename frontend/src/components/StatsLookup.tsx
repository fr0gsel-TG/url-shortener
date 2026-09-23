import { useState } from 'react';
import type { FormEvent } from 'react';
import { fetchStats } from '../api/client';
import type { StatsResponse } from '../types';

export function StatsLookup() {
  const [shortCode, setShortCode] = useState('');
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    setStats(null);
    setLoading(true);

    try {
      const response = await fetchStats(shortCode.trim());
      setStats(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Короткая ссылка не найдена');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="card">
      <h2>Статистика ссылки</h2>
      <form onSubmit={(e) => void handleSubmit(e)} className="form-row">
        <input
          type="text"
          placeholder="abc123"
          value={shortCode}
          onChange={(e) => setShortCode(e.target.value)}
          disabled={loading}
          required
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Загрузка...' : 'Получить статистику'}
        </button>
      </form>

      {error && <p className="error-text">{error}</p>}

      {stats && (
        <dl className="stats-box">
          <dt>Оригинальный URL</dt>
          <dd>
            <a href={stats.originalUrl} target="_blank" rel="noopener noreferrer">
              {stats.originalUrl}
            </a>
          </dd>
          <dt>Количество переходов</dt>
          <dd>{stats.clicks}</dd>
          <dt>Дата создания</dt>
          <dd>{new Date(stats.createdAt).toLocaleString('ru-RU')}</dd>
        </dl>
      )}
    </section>
  );
}
