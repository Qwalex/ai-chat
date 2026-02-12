import { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { ALLOWED_MODELS } from '../models/models.constants';
import { OpenRouterService } from '../openrouter/openrouter.service';
import { ConversationsService } from './conversations.service';
export declare class ConversationsController {
    private readonly conversations;
    private readonly openRouter;
    private readonly config;
    constructor(conversations: ConversationsService, openRouter: OpenRouterService, config: ConfigService);
    getModels(): {
        models: typeof ALLOWED_MODELS;
    };
    listConversations(): {
        conversations: {
            id: string;
            title: string;
            updatedAt: string;
            messageCount: number;
        }[];
    };
    createConversation(body: {
        title?: string;
        system?: string;
    }): {
        conversation: import("./conversations.service").Conversation;
    };
    getConversation(id: string): {
        conversation: import("./conversations.service").Conversation;
    };
    streamMessage(id: string, body: {
        message?: string;
        model?: string;
        images?: string[];
    }, res: Response): Promise<void>;
}
