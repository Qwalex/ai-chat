export type ConversationListItem = {
  id: string;
  title: string;
  updatedAt: string;
  messageCount: number;
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
