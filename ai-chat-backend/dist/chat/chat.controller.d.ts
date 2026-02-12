import { OpenRouterService } from '../openrouter/openrouter.service';
import { ConversationsService } from '../conversations/conversations.service';
export declare class ChatController {
    private readonly openRouter;
    private readonly conversations;
    constructor(openRouter: OpenRouterService, conversations: ConversationsService);
    chat(body: {
        message?: string;
        system?: string;
        model?: string;
    }): Promise<unknown>;
}
