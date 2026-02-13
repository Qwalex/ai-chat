import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ALLOWED_MODELS, getSystemPromptForModel } from '../models/models.constants';
import { OpenRouterService } from '../openrouter/openrouter.service';
import { WriteLogService } from '../write-log/write-log.service';

const ALLOWED_MODEL_IDS = ALLOWED_MODELS.map((m) => m.id);

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | unknown[];
  meta?: { costUsd?: number; costRub?: number; costRubFinal?: number; rate?: number; usage?: unknown };
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
}

const generateId = (): string => Math.random().toString(36).slice(2, 10);

const dropLeadingSystemMessages = (messages: ChatMessage[]): ChatMessage[] => {
  let i = 0;
  while (i < messages.length && messages[i].role === 'system') i++;
  return messages.slice(i);
};

export const buildUserMessageContent = (messageText: string, imageUrls: string[]): string | unknown[] => {
  if (!imageUrls?.length) return messageText;
  const parts: unknown[] = [{ type: 'text', text: messageText || '' }];
  for (const url of imageUrls) {
    if (url && typeof url === 'string') {
      parts.push({ type: 'image_url', imageUrl: { url } });
    }
  }
  return parts;
};

const normalizeMessageContent = (content: unknown): string => {
  if (typeof content === 'string') return content;
  if (Array.isArray(content) && content.length > 0) {
    const first = content[0] as { text?: string };
    if (typeof first === 'string') return first;
    if (first?.text) return first.text;
  }
  return '';
};

const normalizeTitle = (value: unknown): string | null => {
  if (!value) return null;
  const cleaned = String(value)
    .replaceAll(/[`*_#>\n\r]/g, ' ')
    .replaceAll(/\s+/g, ' ')
    .trim();
  if (!cleaned) return null;
  return cleaned.slice(0, 40);
};

const titleFallbackFromMessage = (message: string): string =>
  normalizeTitle(message)?.slice(0, 40) || 'Новый диалог';

@Injectable()
export class ConversationsService {
  private readonly conversations = new Map<string, Conversation>();

  constructor(
    private readonly openRouter: OpenRouterService,
    private readonly config: ConfigService,
    private readonly writeLogService: WriteLogService,
  ) {}

  private getDefaultModel = (): string =>
    this.config.get<string>('OPENROUTER_MODEL') || 'moonshotai/kimi-k2.5';

  getModel = (modelFromRequest?: string): string => {
    if (modelFromRequest && ALLOWED_MODEL_IDS.includes(modelFromRequest)) {
      return modelFromRequest;
    }
    return this.getDefaultModel();
  };

  listConversations = (): { id: string; title: string; updatedAt: string; messageCount: number }[] =>
    Array.from(this.conversations.values()).map((c) => ({
      id: c.id,
      title: c.title,
      updatedAt: c.updatedAt,
      messageCount: c.messages.length,
    }));

  createConversation = (dto: { title?: string; system?: string }): Conversation => {
    const id = generateId();
    const now = new Date().toISOString();
    const defaultModel = this.getDefaultModel();
    const systemPrompt = getSystemPromptForModel(defaultModel);
    const messages: ChatMessage[] = [{ role: 'system', content: systemPrompt }];
    if (dto.system && typeof dto.system === 'string') {
      messages.push({ role: 'system', content: dto.system });
    }
    const conversation: Conversation = {
      id,
      title: dto.title || 'Новый диалог',
      createdAt: now,
      updatedAt: now,
      messages,
    };
    this.conversations.set(id, conversation);
    return conversation;
  };

  getConversation = (id: string): Conversation | undefined => this.conversations.get(id);

  getOrThrow = (id: string): Conversation => {
    const c = this.getConversation(id);
    if (!c) throw new NotFoundException('Conversation not found');
    return c;
  };

  hasUserMessages = (conversation: Conversation): boolean =>
    conversation.messages.some((m) => m.role === 'user');

  buildMessagesPayload = (
    conversation: Conversation,
    userMessageContent: string | unknown[],
    modelId: string,
  ): unknown[] => {
    const systemPrompt = getSystemPromptForModel(modelId);
    const withoutLeading = dropLeadingSystemMessages(conversation.messages);
    return [
      { role: 'system', content: systemPrompt },
      ...withoutLeading,
      { role: 'user', content: userMessageContent },
    ];
  };

  appendUserMessage = (conversation: Conversation, userMessageContent: string | unknown[]): void => {
    conversation.messages.push({ role: 'user', content: userMessageContent });
  };

  appendAssistantMessage = (
    conversation: Conversation,
    text: string,
    meta: ChatMessage['meta'],
  ): void => {
    conversation.messages.push({ role: 'assistant', content: text, meta });
    conversation.updatedAt = new Date().toISOString();
  };

  popLastMessage = (conversation: Conversation): void => {
    conversation.messages.pop();
  };

  setTitle = (conversation: Conversation, title: string): void => {
    conversation.title = title;
    conversation.updatedAt = new Date().toISOString();
  };

  generateTitle = async (message: string): Promise<string | null> => {
    const client = this.openRouter.getClient();
    if (!client) return null;
    try {
      const result = await client.chat.send({
        chatGenerationParams: {
          model: 'arcee-ai/trinity-large-preview:free',
          messages: [
            {
              role: 'user',
              content: `Сформулируй короткое название диалога (3-6 слов, до 40 символов). Одна строка. Без кавычек и точек. По фразе: "${message}"`,
            },
          ],
          temperature: 0.2,
          stream: false,
        },
      });
      const content = result?.choices?.[0]?.message?.content;
      return normalizeTitle(normalizeMessageContent(content));
    } catch {
      return null;
    }
  };

  scheduleTitleUpdate = (
    conversation: Conversation,
    messageText: string,
  ): void => {
    const titleSource = messageText.trim() || 'Изображение';
    this.generateTitle(titleSource)
      .then((generated) => {
        if (generated) this.setTitle(conversation, generated);
        else this.setTitle(conversation, titleFallbackFromMessage(titleSource));
      })
      .catch(() => {});
  };

  logUsage = (model: string, messageText: string, costUsd: number, costRub: number, costRubFinal: number, rate: number): void => {
    this.writeLogService.writeLog(`Use ${model} to generate response: ${messageText}`);
    this.writeLogService.writeLog(`Cost: $${costUsd} → ${costRub}₽ → ${costRubFinal}₽ (rate: ${rate})`);
    this.writeLogService.writeLog('---');
  };
}
