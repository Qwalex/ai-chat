import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { ALLOWED_MODELS, getSystemPromptForModel } from '../models/models.constants';
import { OpenRouterService } from '../openrouter/openrouter.service';
import { WriteLogService } from '../write-log/write-log.service';
import { ConversationEntity } from './entities/conversation.entity';
import { Message } from './entities/message.entity';

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
  /** Внутреннее: id владельца для диалогов из БД */
  _userId?: string;
}

const generateShortId = (): string => Math.random().toString(36).slice(2, 10);

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

const parseContent = (raw: string): string | unknown[] => {
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === 'string') return parsed;
    if (Array.isArray(parsed)) return parsed;
    return raw;
  } catch {
    return raw;
  }
};

const parseMeta = (raw: string | null): ChatMessage['meta'] | undefined => {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as ChatMessage['meta'];
  } catch {
    return undefined;
  }
};

@Injectable()
export class ConversationsService {
  private readonly guestConversations = new Map<string, Conversation>();

  constructor(
    @InjectRepository(ConversationEntity)
    private readonly convRepo: Repository<ConversationEntity>,
    @InjectRepository(Message)
    private readonly messageRepo: Repository<Message>,
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

  private entityToConversation = (entity: ConversationEntity, messageEntities: Message[]): Conversation => {
    const messages: ChatMessage[] = messageEntities
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((m) => ({
        role: m.role as ChatMessage['role'],
        content: parseContent(m.content),
        meta: parseMeta(m.meta),
      }));
    return {
      id: entity.id,
      title: entity.title,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
      messages,
      _userId: entity.userId,
    };
  };

  listConversations = async (userId?: string): Promise<{ id: string; title: string; updatedAt: string; messageCount: number }[]> => {
    if (userId) {
      const list = await this.convRepo.find({
        where: { userId },
        order: { updatedAt: 'DESC' },
        relations: ['messageEntities'],
      });
      return list.map((c) => ({
        id: c.id,
        title: c.title,
        updatedAt: c.updatedAt.toISOString(),
        messageCount: c.messageEntities?.length ?? 0,
      }));
    }
    const guestList = Array.from(this.guestConversations.values()).map((c) => ({
      id: c.id,
      title: c.title,
      updatedAt: c.updatedAt,
      messageCount: c.messages.length,
    }));
    return guestList.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  };

  createConversation = async (
    userId: string | undefined,
    dto: { title?: string; system?: string },
  ): Promise<Conversation> => {
    const defaultModel = this.getDefaultModel();
    const systemPrompt = getSystemPromptForModel(defaultModel);
    const now = new Date().toISOString();

    if (userId) {
      const conv = this.convRepo.create({
        userId,
        title: dto.title || 'Новый диалог',
      });
      const saved = await this.convRepo.save(conv);
      const systemContent = JSON.stringify(systemPrompt);
      await this.messageRepo.save(
        this.messageRepo.create({
          conversationId: saved.id,
          role: 'system',
          content: systemContent,
          sortOrder: 0,
        }),
      );
      if (dto.system && typeof dto.system === 'string') {
        await this.messageRepo.save(
          this.messageRepo.create({
            conversationId: saved.id,
            role: 'system',
            content: JSON.stringify(dto.system),
            sortOrder: 1,
          }),
        );
      }
      const loaded = await this.convRepo.findOne({
        where: { id: saved.id },
        relations: ['messageEntities'],
      });
      if (!loaded) throw new NotFoundException('Conversation not found');
      return this.entityToConversation(loaded, loaded.messageEntities ?? []);
    }

    const id = generateShortId();
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
    this.guestConversations.set(id, conversation);
    return conversation;
  };

  getConversation = async (id: string, userId?: string): Promise<Conversation | undefined> => {
    if (userId && id.length === 36) {
      const entity = await this.convRepo.findOne({
        where: { id, userId },
        relations: ['messageEntities'],
      });
      if (entity) {
        return this.entityToConversation(entity, entity.messageEntities ?? []);
      }
    }
    return this.guestConversations.get(id);
  };

  getOrThrow = async (id: string, userId?: string): Promise<Conversation> => {
    const c = await this.getConversation(id, userId);
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

  appendUserMessage = async (
    conversation: Conversation,
    userMessageContent: string | unknown[],
  ): Promise<void> => {
    const contentStr = typeof userMessageContent === 'string'
      ? userMessageContent
      : JSON.stringify(userMessageContent);
    if (conversation._userId) {
      const count = await this.messageRepo.count({ where: { conversationId: conversation.id } });
      const msg = this.messageRepo.create({
        conversationId: conversation.id,
        role: 'user',
        content: contentStr,
        sortOrder: count,
      });
      await this.messageRepo.save(msg);
      conversation.messages.push({ role: 'user', content: userMessageContent });
      return;
    }
    conversation.messages.push({ role: 'user', content: userMessageContent });
  };

  appendAssistantMessage = async (
    conversation: Conversation,
    text: string,
    meta: ChatMessage['meta'],
  ): Promise<void> => {
    if (conversation._userId) {
      const count = await this.messageRepo.count({ where: { conversationId: conversation.id } });
      const msg = this.messageRepo.create({
        conversationId: conversation.id,
        role: 'assistant',
        content: JSON.stringify(text),
        meta: meta ? JSON.stringify(meta) : null,
        sortOrder: count,
      });
      await this.messageRepo.save(msg);
      await this.convRepo.update(conversation.id, { title: conversation.title });
    }
    conversation.messages.push({ role: 'assistant', content: text, meta });
    conversation.updatedAt = new Date().toISOString();
  };

  popLastMessage = async (conversation: Conversation): Promise<void> => {
    if (conversation._userId && conversation.messages.length > 0) {
      const last = conversation.messages[conversation.messages.length - 1];
      if (last.role === 'user') {
        const toDelete = await this.messageRepo.findOne({
          where: { conversationId: conversation.id, role: 'user' },
          order: { sortOrder: 'DESC' },
        });
        if (toDelete) await this.messageRepo.remove(toDelete);
      }
    }
    conversation.messages.pop();
  };

  setTitle = async (conversation: Conversation, title: string): Promise<void> => {
    conversation.title = title;
    conversation.updatedAt = new Date().toISOString();
    if (conversation._userId) {
      await this.convRepo.update(conversation.id, { title });
    }
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

  scheduleTitleUpdate = async (
    conversation: Conversation,
    messageText: string,
  ): Promise<void> => {
    const titleSource = messageText.trim() || 'Изображение';
    const generated = await this.generateTitle(titleSource);
    if (generated) {
      await this.setTitle(conversation, generated);
    } else {
      await this.setTitle(conversation, titleFallbackFromMessage(titleSource));
    }
  };

  logUsage = (model: string, _messageText: string, costUsd: number, costRub: number, costRubFinal: number, rate: number): void => {
    this.writeLogService.writeLog(`Use ${model} | Cost: $${costUsd} → ${costRub}₽ → ${costRubFinal}₽ (rate: ${rate})`);
    this.writeLogService.writeLog('---');
  };
}
