'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { authLogin, authMe, authRegister, authLogout } from '../api';
import type { UserInfo } from '@entities/user/types';

type AuthContextValue = {
  user: UserInfo | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

type AuthProviderProps = {
  children: ReactNode;
  /** Пользователь, полученный на сервере при рендере (по cookie). Если передан, запрос GET /api/auth/me с клиента не выполняется. */
  initialUser?: UserInfo | null;
};

export const AuthProvider = ({ children, initialUser }: AuthProviderProps) => {
  const [user, setUser] = useState<UserInfo | null>(initialUser ?? null);
  const [loading, setLoading] = useState(initialUser === undefined);

  const refreshUser = useCallback(async () => {
    setLoading(true);
    try {
      const { user: u } = await authMe();
      setUser(u);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialUser === undefined) {
      refreshUser();
    } else {
      setLoading(false);
    }
  }, [initialUser, refreshUser]);

  const login = useCallback(
    async (email: string, password: string) => {
      const { user: u } = await authLogin(email, password);
      setUser(u);
    },
    [],
  );

  const register = useCallback(
    async (email: string, password: string) => {
      const { user: u } = await authRegister(email, password);
      setUser(u);
    },
    [],
  );

  const logout = useCallback(async () => {
    await authLogout();
    setUser(null);
  }, []);

  const value: AuthContextValue = {
    user,
    loading,
    login,
    register,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
