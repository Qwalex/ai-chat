import { ConfigService } from '@nestjs/config';
import { OpenRouter } from '@openrouter/sdk';
export declare class OpenRouterService {
    private readonly config;
    private client;
    constructor(config: ConfigService);
    getClient: () => OpenRouter | null;
}
