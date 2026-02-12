import { ConfigService } from '@nestjs/config';
import { OpenRouterService } from '../openrouter/openrouter.service';
import { WriteLogService } from '../write-log/write-log.service';
export interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string | unknown[];
    meta?: {
        costUsd?: number;
        costRub?: number;
        costRubFinal?: number;
        rate?: number;
        usage?: unknown;
    };
}
export interface Conversation {
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    messages: ChatMessage[];
}
export declare const buildUserMessageContent: (messageText: string, imageUrls: string[]) => string | unknown[];
export declare class ConversationsService {
    private readonly openRouter;
    private readonly config;
    private readonly writeLogService;
    private readonly conversations;
    constructor(openRouter: OpenRouterService, config: ConfigService, writeLogService: WriteLogService);
    private getDefaultModel;
    getModel: (modelFromRequest?: string) => string;
    listConversations: () => {
        id: string;
        title: string;
        updatedAt: string;
        messageCount: number;
    }[];
    createConversation: (dto: {
        title?: string;
        system?: string;
    }) => Conversation;
    getConversation: (id: string) => Conversation | undefined;
    getOrThrow: (id: string) => Conversation;
    hasUserMessages: (conversation: Conversation) => boolean;
    buildMessagesPayload: (conversation: Conversation, userMessageContent: string | unknown[], modelId: string) => unknown[];
    appendUserMessage: (conversation: Conversation, userMessageContent: string | unknown[]) => void;
    appendAssistantMessage: (conversation: Conversation, text: string, meta: ChatMessage["meta"]) => void;
    popLastMessage: (conversation: Conversation) => void;
    setTitle: (conversation: Conversation, title: string) => void;
    generateTitle: (message: string) => Promise<string | null>;
    scheduleTitleUpdate: (conversation: Conversation, messageText: string) => void;
    logUsage: (model: string, messageText: string, costUsd: number, costRub: number, costRubFinal: number, rate: number) => void;
}
