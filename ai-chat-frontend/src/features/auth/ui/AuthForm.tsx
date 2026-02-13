'use client';

import { useState } from 'react';
import { useAuth } from '../context/AuthProvider';

type Mode = 'login' | 'register';

export const AuthForm = ({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess?: () => void;
}) => {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      if (mode === 'login') {
        await login(email.trim(), password);
      } else {
        await register(email.trim(), password);
      }
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="auth-form-overlay" onClick={onClose}>
      <div className="auth-form" onClick={(e) => e.stopPropagation()}>
        <div className="auth-form-header">
          <h3>{mode === 'login' ? 'Вход' : 'Регистрация'}</h3>
          <button type="button" className="auth-form-close" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          {error && <p className="auth-form-error">{error}</p>}
          <label className="field">
            Email
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label className="field">
            Пароль (не менее 8 символов)
            <input
              type="password"
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </label>
          <button type="submit" disabled={pending}>
            {pending ? '...' : mode === 'login' ? 'Войти' : 'Зарегистрироваться'}
          </button>
        </form>
        <p className="auth-form-switch">
          {mode === 'login' ? (
            <>
              Нет аккаунта?{' '}
              <button type="button" onClick={() => setMode('register')}>
                Регистрация
              </button>
            </>
          ) : (
            <>
              Есть аккаунт?{' '}
              <button type="button" onClick={() => setMode('login')}>
                Вход
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
};
