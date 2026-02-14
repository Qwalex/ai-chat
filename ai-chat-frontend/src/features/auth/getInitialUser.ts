import type { UserInfo } from '@entities/user/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL;
const COOKIE_NAME = 'accessToken';

/**
 * Вызывается на сервере при рендере страницы. Если браузер отправил cookie accessToken
 * (например, при общем домене в проде), возвращаем пользователя без запроса с клиента.
 * Иначе возвращаем undefined — тогда клиент сделает GET /api/auth/me сам.
 */
export const getInitialUser = async (
  accessToken: string | undefined,
): Promise<UserInfo | null | undefined> => {
  if (!accessToken) return undefined;
  try {
    const res = await fetch(`${API_URL}/api/auth/me`, {
      headers: { Cookie: `${COOKIE_NAME}=${accessToken}` },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => ({}));
    const u = data?.user;
    if (u && typeof u.id === 'string' && typeof u.email === 'string') {
      return {
        id: u.id,
        email: u.email,
        tokenBalance: typeof u.tokenBalance === 'number' ? u.tokenBalance : 0,
        createdAt: typeof u.createdAt === 'string' ? u.createdAt : new Date().toISOString(),
      };
    }
    return null;
  } catch {
    return undefined;
  }
};
