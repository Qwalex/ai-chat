const getBaseUrl = (): string =>
  typeof window !== 'undefined'
    ? (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001')
    : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001');

export type ModelItem = { id: string; label: string };

export const fetchModels = async (): Promise<ModelItem[]> => {
  const res = await fetch(`${getBaseUrl()}/api/models`, { cache: 'no-store' });
  const data = await res.json().catch(() => ({}));
  return data?.models ?? [];
};

export type ConversationListItem = {
  id: string;
  title: string;
  updatedAt: string;
  messageCount: number;
};

export const fetchConversations = async (): Promise<ConversationListItem[]> => {
  const res = await fetch(`${getBaseUrl()}/api/conversations`);
  const data = await res.json().catch(() => ({}));
  return data?.conversations ?? [];
};

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string | Array<{ type: string; text?: string; imageUrl?: { url: string } }>;
  meta?: { costUsd?: number; costRub?: number; costRubFinal?: number; rate?: number; usage?: unknown };
};

export type Conversation = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
};

export const fetchConversation = async (id: string): Promise<Conversation | null> => {
  const res = await fetch(`${getBaseUrl()}/api/conversations/${id}`);
  if (!res.ok) return null;
  const data = await res.json().catch(() => ({}));
  return data?.conversation ?? null;
};

export const createConversation = async (params: {
  title?: string;
  system?: string;
}): Promise<Conversation> => {
  const res = await fetch(`${getBaseUrl()}/api/conversations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: params.title ?? 'Новый диалог', system: params.system }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? data?.error ?? 'Не удалось создать диалог');
  return data.conversation;
};

export const sendMessageStream = async (
  conversationId: string,
  params: { message: string; model?: string; images?: string[] },
): Promise<ReadableStreamDefaultReader<Uint8Array> | null> => {
  const res = await fetch(`${getBaseUrl()}/api/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: params.message,
      model: params.model,
      images: params.images,
    }),
  });
  if (!res.ok) return null;
  const body = res.body;
  if (!body) return null;
  return body.getReader();
};

export const uploadImages = async (dataUrls: string[]): Promise<string[]> => {
  const res = await fetch(`${getBaseUrl()}/api/upload-images`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ images: dataUrls }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? data?.error ?? 'Ошибка загрузки изображений');
  return data?.urls ?? [];
};

export type BlogPostListItem = { slug: string; title: string };

export const fetchBlogPosts = async (): Promise<BlogPostListItem[]> => {
  const res = await fetch(`${getBaseUrl()}/api/blog`, { cache: 'no-store' });
  const data = await res.json().catch(() => ({}));
  return data?.posts ?? [];
};

export const fetchBlogPost = async (
  slug: string,
): Promise<{ title: string; html: string } | null> => {
  const res = await fetch(`${getBaseUrl()}/api/blog/${encodeURIComponent(slug)}`, {
    cache: 'no-store',
  });
  if (!res.ok) return null;
  const data = await res.json().catch(() => ({}));
  return data?.title != null ? { title: data.title, html: data.html ?? '' } : null;
};
