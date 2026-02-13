import { getBaseUrl } from '@shared/api/base';
import type { UserInfo } from '@entities/user/types';

export type { UserInfo } from '@entities/user/types';

const authFetchOptions: RequestInit = {
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
};

export const authRegister = async (
  email: string,
  password: string,
): Promise<{ user: UserInfo }> => {
  const res = await fetch(`${getBaseUrl()}/api/auth/register`, {
    ...authFetchOptions,
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json().catch(() => ({}));
  const errMsg = Array.isArray(data?.message) ? data.message[0] : data?.message ?? data?.error;
  if (!res.ok) throw new Error(errMsg ?? 'Ошибка регистрации');
  return data;
};

export const authLogin = async (
  email: string,
  password: string,
): Promise<{ user: UserInfo }> => {
  const res = await fetch(`${getBaseUrl()}/api/auth/login`, {
    ...authFetchOptions,
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json().catch(() => ({}));
  const errMsg = Array.isArray(data?.message) ? data.message[0] : data?.message ?? data?.error;
  if (!res.ok) throw new Error(errMsg ?? 'Ошибка входа');
  return data;
};

export const authMe = async (): Promise<{ user: UserInfo }> => {
  const res = await fetch(`${getBaseUrl()}/api/auth/me`, {
    credentials: 'include',
  });
  const data = await res.json().catch(() => ({}));
  const errMsg = Array.isArray(data?.message) ? data.message[0] : data?.message ?? data?.error;
  if (!res.ok) throw new Error(errMsg ?? 'Ошибка');
  return data;
};

export const authLogout = async (): Promise<void> => {
  await fetch(`${getBaseUrl()}/api/auth/logout`, {
    ...authFetchOptions,
    method: 'POST',
  });
};
