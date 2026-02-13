import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { ALLOWED_MODELS, isModelFree, getModelLabel, USD_TO_TOKENS_RATE } from '../models/models.constants';
import { OpenRouterService } from '../openrouter/openrouter.service';
import { OptionalJwtGuard } from '../auth/optional-jwt.guard';
import { User } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { BalanceHistoryService } from '../balance-history/balance-history.service';
import { buildUserMessageContent } from './conversations.service';
import { ConversationsService } from './conversations.service';

/** Лимит: 40 сообщений в минуту с одного IP (гости и пользователи), защита от спама бесплатных моделей */
const MESSAGES_THROTTLE = { default: { limit: 40, ttl: 60_000 } };

const USD_TO_RUB_RATE = Number(process.env.USD_TO_RUB_RATE) || 90;
const USD_RATE_API = process.env.USD_RATE_API || 'https://open.er-api.com/v6/latest/USD';
const USD_RATE_CACHE_MS = Number(process.env.USD_RATE_CACHE_MS) || 10 * 60 * 1000;
const COMMISSION_MULTIPLIER = Number(process.env.COMMISSION_MULTIPLIER) || 1.5;

const normalizeMessageContent = (content: unknown): string => {
  if (typeof content === 'string') return content;
  if (Array.isArray(content) && content.length > 0) {
    const first = content[0] as { text?: string };
    if (typeof first === 'string') return first;
    if (first?.text) return first.text;
  }
  return '';
};

let usdRateCache: { value: number | null; expiresAt: number } = { value: null, expiresAt: 0 };

const getUsdToRubRate = async (): Promise<number> => {
  const now = Date.now();
  if (usdRateCache.value != null && now < usdRateCache.expiresAt) {
    return usdRateCache.value;
  }
  try {
    const response = await fetch(USD_RATE_API);
    const data = await response.json().catch(() => ({}));
    const rate = data?.rates?.RUB;
    if (typeof rate === 'number' && !Number.isNaN(rate)) {
      usdRateCache = { value: rate, expiresAt: now + USD_RATE_CACHE_MS };
      return rate;
    }
  } catch {
    // fallback
  }
  usdRateCache = { value: USD_TO_RUB_RATE, expiresAt: now + USD_RATE_CACHE_MS };
  return USD_TO_RUB_RATE;
};

const calculateRub = (
  costUsd: number | null,
  rate: number,
  multiplier: number,
): { costRub: number | null; costRubFinal: number | null } => {
  if (typeof costUsd !== 'number' || Number.isNaN(costUsd)) {
    return { costRub: null, costRubFinal: null };
  }
  const costRub = costUsd * rate;
  return { costRub, costRubFinal: costRub * multiplier };
};

const sendSSE = (res: Response, event: string, data: unknown): void => {
  const payload = typeof data === 'string' ? data : JSON.stringify(data);
  res.write(`event: ${event}\ndata: ${payload}\n\n`);
};

const openRouterErrorJson = (message: string) => ({ error: message, source: 'openrouter' });

@Controller('api')
@UseGuards(OptionalJwtGuard)
export class ConversationsController {
  constructor(
    private readonly conversations: ConversationsService,
    private readonly openRouter: OpenRouterService,
    private readonly config: ConfigService,
    private readonly users: UsersService,
    private readonly balanceHistory: BalanceHistoryService,
  ) {}

  @Get('models')
  getModels(): { models: typeof ALLOWED_MODELS } {
    return { models: ALLOWED_MODELS };
  }

  @Get('conversations')
  async listConversations(@Req() req: Request & { user?: User }) {
    const userId = req.user?.id;
    const conversations = await this.conversations.listConversations(userId);
    return { conversations };
  }

  @Post('conversations')
  @HttpCode(HttpStatus.CREATED)
  async createConversation(
    @Req() req: Request & { user?: User },
    @Body() body: { title?: string; system?: string },
  ) {
    const userId = req.user?.id;
    const conversation = await this.conversations.createConversation(userId, {
      title: body.title,
      system: body.system,
    });
    return { conversation };
  }

  @Get('conversations/:id')
  async getConversation(
    @Param('id') id: string,
    @Req() req: Request & { user?: User },
  ) {
    const userId = req.user?.id;
    const conversation = await this.conversations.getOrThrow(id, userId);
    return { conversation };
  }

  @Post('conversations/:id/messages')
  @Throttle(MESSAGES_THROTTLE)
  async streamMessage(
    @Param('id') id: string,
    @Body()
    body: { message?: string; model?: string; images?: string[] },
    @Req() req: Request & { user?: User },
    @Res() res: Response,
  ): Promise<void> {
    const userId = req.user?.id;
    const conversation = await this.conversations.getOrThrow(id, userId);
    const messageText = typeof body.message === 'string' ? body.message : '';
    const imageUrls = Array.isArray(body.images) ? body.images : [];
    if (!messageText.trim() && imageUrls.length === 0) {
      res.status(HttpStatus.BAD_REQUEST).json({ error: 'message or images required' });
      return;
    }

    const client = this.openRouter.getClient();
    if (!client) {
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        error: 'OPENROUTER_API_KEY is not set',
      });
      return;
    }

    const model = this.conversations.getModel(body.model);
    const user = req.user;

    if (!isModelFree(model)) {
      if (!user) {
        res.status(HttpStatus.UNAUTHORIZED).json({
          error: 'Для платных моделей необходима авторизация',
          code: 'AUTH_REQUIRED',
        });
        return;
      }
      const balance = await this.users.getBalance(user.id);
      if (balance < 1) {
        res.status(HttpStatus.FORBIDDEN).json({
          error: 'Недостаточно токенов на балансе. Пополните баланс.',
          code: 'INSUFFICIENT_BALANCE',
        });
        return;
      }
    }
    const userMessageContent = buildUserMessageContent(messageText, imageUrls);
    const messages = this.conversations.buildMessagesPayload(
      conversation,
      userMessageContent,
      model,
    );
    const isFirstUserMessage = !this.conversations.hasUserMessages(conversation);
    await this.conversations.appendUserMessage(conversation, userMessageContent);

    const apiKey = this.config.get<string>('OPENROUTER_API_KEY');
    const openRouterHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    };
    const referer = this.config.get<string>('OPENROUTER_HTTP_REFERER');
    if (referer) openRouterHeaders['HTTP-Referer'] = referer;
    const title = this.config.get<string>('OPENROUTER_X_TITLE');
    if (title) openRouterHeaders['X-Title'] = title;

    let openRouterRes: Response | globalThis.Response;
    try {
      openRouterRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: openRouterHeaders,
        body: JSON.stringify({
          model,
          messages,
          stream: true,
          provider: { sort: 'latency' },
          reasoning: { enabled: true },
        }),
      });
    } catch (error: unknown) {
      await this.conversations.popLastMessage(conversation);
      const errMessage = error instanceof Error ? error.message : 'Request failed';
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(openRouterErrorJson(errMessage));
      return;
    }

    if (!openRouterRes.ok) {
      await this.conversations.popLastMessage(conversation);
      const errBody = await openRouterRes.text();
      let errMessage = 'Request failed';
      try {
        const errJson = JSON.parse(errBody);
        errMessage = errJson?.error?.message ?? errMessage;
      } catch {
        // ignore
      }
      res.status(openRouterRes.status).json(openRouterErrorJson(errMessage));
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    let fullContent = '';
    let lastChunk: { usage?: unknown } | null = null;
    let streamError: unknown = null;
    const reader = (openRouterRes as globalThis.Response).body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf('\n\n')) >= 0) {
          const block = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          const lines = block.split(/\r\n|\n|\r/);
          const dataParts: string[] = [];
          for (const line of lines) {
            if (line.startsWith('data:')) {
              dataParts.push(line.slice(5).replace(/^\s/, ''));
            }
          }
          const dataStr = dataParts.join('\n').trim();
          if (!dataStr) continue;
          if (dataStr === '[DONE]') break;
          let chunk: {
            error?: { message?: string };
            choices?: Array<{ delta?: { content?: string }; usage?: unknown }>;
            usage?: unknown;
          };
          try {
            chunk = JSON.parse(dataStr);
          } catch {
            continue;
          }
          if (chunk?.error) {
            streamError = chunk.error;
            sendSSE(res, 'error', openRouterErrorJson(chunk.error?.message ?? 'Stream error'));
            break;
          }
          const delta = chunk?.choices?.[0]?.delta?.content;
          if (typeof delta === 'string') {
            fullContent += delta;
            sendSSE(res, 'delta', { delta });
          }
          if (chunk?.usage != null) lastChunk = { usage: chunk.usage };
        }
        if (streamError) break;
      }
    } catch (err) {
      streamError = err;
      sendSSE(
        res,
        'error',
        openRouterErrorJson(err instanceof Error ? err.message : 'Stream failed'),
      );
    }

    if (streamError) {
      await this.conversations.popLastMessage(conversation);
      res.end();
      return;
    }

    const lastUsage = (lastChunk as { usage?: unknown })?.usage ?? null;
    const costUsd =
      typeof (lastUsage as { cost?: number })?.cost === 'number'
        ? (lastUsage as { cost: number }).cost
        : null;
    const rate = await getUsdToRubRate();
    const { costRub, costRubFinal } = calculateRub(costUsd, rate, COMMISSION_MULTIPLIER);
    const text = normalizeMessageContent(fullContent) || '';
    await this.conversations.appendAssistantMessage(conversation, text, {
      costUsd: costUsd ?? undefined,
      costRub: costRub ?? undefined,
      costRubFinal: costRubFinal ?? undefined,
      rate,
      usage: lastUsage,
    });
    this.conversations.logUsage(model, messageText, costUsd ?? 0, costRub ?? 0, costRubFinal ?? 0, rate);

    if (!isModelFree(model) && user && typeof costUsd === 'number' && costUsd > 0) {
      const tokensToDeduct = Math.ceil(costUsd * USD_TO_TOKENS_RATE);
      if (tokensToDeduct > 0) {
        await this.users.deductTokens(user.id, tokensToDeduct);
        await this.balanceHistory.record({
          userId: user.id,
          modelId: model,
          modelLabel: getModelLabel(model),
          tokensSpent: tokensToDeduct,
          costUsd,
        });
      }
    }

    if (isFirstUserMessage && conversation.title === 'Новый диалог') {
      await this.conversations.scheduleTitleUpdate(conversation, messageText);
    }

    sendSSE(res, 'done', {
      conversation,
      text,
      usage: lastUsage,
      costUsd,
      costRub,
      costRubFinal,
      rate,
    });
    res.end();
  }
}
