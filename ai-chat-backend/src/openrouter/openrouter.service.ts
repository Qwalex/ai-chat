import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenRouter } from '@openrouter/sdk';

@Injectable()
export class OpenRouterService {
  private client: OpenRouter | null = null;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('OPENROUTER_API_KEY');
    if (!apiKey) return;
    const httpReferer = this.config.get<string>('OPENROUTER_HTTP_REFERER');
    const xTitle = this.config.get<string>('OPENROUTER_X_TITLE');
    this.client = new OpenRouter({ apiKey, httpReferer, xTitle });
  }

  getClient = (): OpenRouter | null => this.client;
}
