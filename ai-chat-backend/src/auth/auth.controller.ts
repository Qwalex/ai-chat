import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { User } from '../users/user.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

const COOKIE_NAME = 'accessToken';
const COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: COOKIE_MAX_AGE_MS,
  path: '/',
});

const sanitizeUser = (user: User) => ({
  id: user.id,
  email: user.email,
  tokenBalance: user.tokenBalance,
  createdAt: user.createdAt,
});

/** Лимит: 5 запросов в минуту на login/register (защита от перебора) */
const AUTH_THROTTLE = { default: { limit: 5, ttl: 60_000 } };

@Controller('api/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @Throttle(AUTH_THROTTLE)
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: ReturnType<typeof sanitizeUser> }> {
    const email = dto.email.trim().toLowerCase();
    const { user, accessToken } = await this.auth.register(email, dto.password);
    res.cookie(COOKIE_NAME, accessToken, cookieOptions());
    return { user: sanitizeUser(user) };
  }

  @Post('login')
  @Throttle(AUTH_THROTTLE)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: ReturnType<typeof sanitizeUser> }> {
    const email = dto.email.trim().toLowerCase();
    const { user, accessToken } = await this.auth.login(email, dto.password);
    res.cookie(COOKIE_NAME, accessToken, cookieOptions());
    return { user: sanitizeUser(user) };
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response): { ok: boolean } {
    res.cookie(COOKIE_NAME, '', { httpOnly: true, path: '/', maxAge: 0 });
    return { ok: true };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() req: Request & { user: User }) {
    return { user: sanitizeUser(req.user) };
  }
}
