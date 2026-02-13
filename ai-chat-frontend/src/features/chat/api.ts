import { getBaseUrl } from '@shared/api/base';

const jsonCredentialOptions: RequestInit = {
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
};

export const sendMessageStream = async (
  conversationId: string,
  params: { message: string; model?: string; images?: string[] },
): Promise<{ reader: ReadableStreamDefaultReader<Uint8Array> | null; ok: boolean; data?: unknown }> => {
  const res = await fetch(`${getBaseUrl()}/api/conversations/${conversationId}/messages`, {
    ...jsonCredentialOptions,
    method: 'POST',
    body: JSON.stringify({
      message: params.message,
      model: params.model,
      images: params.images,
    }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return { reader: null, ok: false, data };
  }
  const body = res.body;
  if (!body) return { reader: null, ok: false };
  return { reader: body.getReader(), ok: true };
};

export const uploadImages = async (dataUrls: string[]): Promise<string[]> => {
  const res = await fetch(`${getBaseUrl()}/api/upload-images`, {
    ...jsonCredentialOptions,
    method: 'POST',
    body: JSON.stringify({ images: dataUrls }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? data?.error ?? 'Ошибка загрузки изображений');
  return data?.urls ?? [];
};
