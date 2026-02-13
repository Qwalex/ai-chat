'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@features/auth/context/AuthProvider';
import { fetchBalanceHistory, type BalanceHistoryItem } from '../api';

const formatDate = (iso: string): string => {
  const d = new Date(iso);
  return d.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const BalanceHistoryView = () => {
  const { user } = useAuth();
  const [history, setHistory] = useState<BalanceHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      setHistory([]);
      return;
    }
    setLoading(true);
    setError(null);
    fetchBalanceHistory()
      .then((data) => setHistory(data.history))
      .catch((err) => setError(err instanceof Error ? err.message : 'Ошибка'))
      .finally(() => setLoading(false));
  }, [user]);

  if (!user) {
    return (
      <main className="container container--blog">
        <nav className="blog-nav">
          <Link href="/">Главная</Link> · <Link href="/history">История расходов</Link>
        </nav>
        <div className="blog-content">
          <h1>История расходов</h1>
          <p>Войдите в аккаунт, чтобы видеть историю списания токенов.</p>
          <p>
            <Link href="/">Перейти на главную</Link>
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="container container--blog">
      <nav className="blog-nav">
        <Link href="/">Главная</Link> · <Link href="/history">История расходов</Link>
      </nav>
      <div className="blog-content">
        <h1>История расходов</h1>
        <p className="balance-history-balance">
          Текущий баланс: <strong>{user.tokenBalance}</strong> токенов
        </p>
        {loading && <p>Загрузка...</p>}
        {error && <p className="auth-form-error">{error}</p>}
        {!loading && !error && history.length === 0 && (
          <p>История пуста. Расходы появятся после использования платных моделей.</p>
        )}
        {!loading && !error && history.length > 0 && (
          <div className="balance-history-table-wrap">
            <table className="balance-history-table">
              <thead>
                <tr>
                  <th>Дата и время</th>
                  <th>Модель</th>
                  <th>Списано токенов</th>
                </tr>
              </thead>
              <tbody>
                {history.map((row) => (
                  <tr key={row.id}>
                    <td>{formatDate(row.createdAt)}</td>
                    <td>{row.modelLabel}</td>
                    <td>{row.tokensSpent}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
};
