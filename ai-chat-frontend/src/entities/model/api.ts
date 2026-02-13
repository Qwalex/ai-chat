import { getBaseUrl } from '@shared/api/base';
import type { ModelItem } from './types';

export type { ModelItem } from './types';

export const fetchModels = async (): Promise<ModelItem[]> => {
  const res = await fetch(`${getBaseUrl()}/api/models`);
  const data = await res.json().catch(() => ({}));
  return data?.models ?? [];
};
