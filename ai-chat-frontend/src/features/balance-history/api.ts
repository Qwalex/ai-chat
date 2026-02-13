import { getBaseUrl } from '@shared/api/base';

export type BalanceHistoryItem = {
  id: string;
  modelId: string;
  modelLabel: string;
  tokensSpent: number;
  createdAt: string;
};

export type BalanceHistoryResponse = {
  history: BalanceHistoryItem[];
};

export const fetchBalanceHistory = async (): Promise<BalanceHistoryResponse> => {
  const res = await fetch(`${getBaseUrl()}/api/balance-history`, {
    credentials: 'include',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.message ?? data?.error ?? 'Не удалось загрузить историю');
  }
  const data = await res.json().catch(() => ({}));
  return { history: data?.history ?? [] };
};
