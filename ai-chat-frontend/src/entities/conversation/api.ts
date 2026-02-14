import type { Conversation, ConversationListItem } from './types';

export type { Conversation, ConversationListItem, ChatMessage } from './types';

const jsonCredentialOptions: RequestInit = {
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
};

export const fetchConversations = async (): Promise<ConversationListItem[]> => {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/conversations`, jsonCredentialOptions);
  const data = await res.json().catch(() => ({}));
  return data?.conversations ?? [];
};

export const fetchConversation = async (id: string): Promise<Conversation | null> => {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/conversations/${id}`, jsonCredentialOptions);
  if (!res.ok) return null;
  const data = await res.json().catch(() => ({}));
  return data?.conversation ?? null;
};

export const createConversation = async (
  params: { title?: string; system?: string },
): Promise<Conversation> => {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/conversations`, {
    ...jsonCredentialOptions,
    method: 'POST',
    body: JSON.stringify({ title: params.title ?? 'Новый диалог', system: params.system }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? data?.error ?? 'Не удалось создать диалог');
  return data.conversation;
};
