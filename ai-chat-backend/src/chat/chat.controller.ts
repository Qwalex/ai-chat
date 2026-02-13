import {
  Body,
  Controller,
  Post,
  InternalServerErrorException,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getSystemPromptForModel } from '../models/models.constants';
import { OpenRouterService } from '../openrouter/openrouter.service';
import { ConversationsService } from '../conversations/conversations.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

const USD_TO_RUB_RATE = Number(process.env.USD_TO_RUB_RATE) || 90;
const USD_RATE_API = process.env.USD_RATE_API || 'https://open.er-api.com/v6/latest/USD';
const USD_RATE_CACHE_MS = Number(process.env.USD_RATE_CACHE_MS) || 10 * 60 * 1000;
const COMMISSION_MULTIPLIER = Number(process.env.COMMISSION_MULTIPLIER) || 1.5;

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

const normalizeMessageContent = (content: unknown): string => {
  if (typeof content === 'string') return content;
  if (Array.isArray(content) && content.length > 0) {
    const first = content[0] as { text?: string };
    if (typeof first === 'string') return first;
    if (first?.text) return first.text;
  }
  return '';
};

@Controller('api')
export class ChatController {
  constructor(
    private readonly openRouter: OpenRouterService,
    private readonly conversations: ConversationsService,
  ) {}

  @Post('chat')
  @UseGuards(JwtAuthGuard)
  async chat(
    @Body() body: { message?: string; system?: string; model?: string },
  ): Promise<unknown> {
    const message = typeof body.message === 'string' ? body.message : '';
    if (!message) {
      throw new BadRequestException('message is required');
    }
    const client = this.openRouter.getClient();
    if (!client) {
      throw new InternalServerErrorException('OPENROUTER_API_KEY is not set');
    }
    const model = this.conversations.getModel(body.model);
    const messages: Array<{ role: 'system' | 'user'; content: string }> = [
      { role: 'system', content: getSystemPromptForModel(model) },
    ];
    if (body.system && typeof body.system === 'string') {
      messages.push({ role: 'system', content: body.system });
    }
    messages.push({ role: 'user', content: message });
    try {
      const result = await client.chat.send({
        chatGenerationParams: {
          model,
          messages,
          stream: false,
        },
      });
      const rawContent = result?.choices?.[0]?.message?.content;
      const text = normalizeMessageContent(rawContent) || '';
      const usage = result?.usage as { cost?: number } | undefined;
      const costUsd = typeof usage?.cost === 'number' ? usage.cost : null;
      const rate = await getUsdToRubRate();
      const { costRub, costRubFinal } = calculateRub(costUsd, rate, COMMISSION_MULTIPLIER);
      return {
        text,
        costUsd,
        costRub,
        costRubFinal,
        rate,
        usage: usage ?? null,
        raw: result,
      };
    } catch (error: unknown) {
      const errMessage = error instanceof Error ? error.message : 'Request failed';
      throw new InternalServerErrorException(errMessage);
    }
  }
}
