import { Body, Controller, Post, HttpCode, HttpStatus, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from './users.service';

@Controller('api')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly config: ConfigService,
  ) {}

  /** Пополнение баланса пользователя (требуется ADMIN_SECRET). Для прода: вызвать из бэкенда или с админ-панели. */
  @Post('admin/top-up')
  @HttpCode(HttpStatus.OK)
  async topUp(
    @Body() body: { userId?: string; tokens?: number; adminSecret?: string },
  ): Promise<{ ok: boolean; newBalance?: number }> {
    const secret = this.config.get<string>('ADMIN_SECRET');
    if (!secret || body.adminSecret !== secret) {
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
