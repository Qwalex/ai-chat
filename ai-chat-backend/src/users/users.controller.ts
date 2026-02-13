import {
  Body,
  Controller,
  Post,
  Req,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { UsersService } from './users.service';

/** Лимит: 10 запросов в минуту на админ-эндпоинт */
const ADMIN_THROTTLE = { default: { limit: 10, ttl: 60_000 } };

@Controller('api')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly config: ConfigService,
  ) {}

  /** Пополнение баланса пользователя (требуется ADMIN_SECRET в заголовке X-Admin-Key или в body.adminSecret). */
  @Post('admin/top-up')
  @HttpCode(HttpStatus.OK)
  @Throttle(ADMIN_THROTTLE)
  async topUp(
    @Req() req: Request,
    @Body() body: { userId?: string; tokens?: number; adminSecret?: string },
  ): Promise<{ ok: boolean; newBalance?: number }> {
    const expectedSecret = this.config.get<string>('ADMIN_SECRET');
    const provided =
      (req.headers['x-admin-key'] as string | undefined) ?? body.adminSecret;
    if (!expectedSecret || provided !== expectedSecret) {
      throw new UnauthorizedException('Invalid admin secret');
    }
    const userId = typeof body.userId === 'string' ? body.userId : '';
    const tokens = typeof body.tokens === 'number' && body.tokens > 0 ? body.tokens : 0;
    if (!userId || tokens <= 0) {
      return { ok: false };
    }
    await this.users.addTokens(userId, tokens);
    const newBalance = await this.users.getBalance(userId);
    return { ok: true, newBalance };
  }
}
