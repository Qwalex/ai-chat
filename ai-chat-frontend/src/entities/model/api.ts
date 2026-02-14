import type { ModelItem } from './types';

export type { ModelItem } from './types';

export const fetchModels = async (): Promise<ModelItem[]> => {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/models`);
  const data = await res.json().catch(() => ({}));
  return data?.models ?? [];
};
