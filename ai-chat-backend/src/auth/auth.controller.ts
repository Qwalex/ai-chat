import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { User } from '../users/user.entity';

const sanitizeUser = (user: User) => ({
  id: user.id,
  email: user.email,
  tokenBalance: user.tokenBalance,
  createdAt: user.createdAt,
});

@Controller('api/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  async register(
    @Body() body: { email?: string; password?: string },
  ): Promise<{ user: ReturnType<typeof sanitizeUser>; accessToken: string }> {
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    if (!email || !password) {
      throw new BadRequestException('email и password обязательны');
    }
    const { user, accessToken } = await this.auth.register(email, password);
    return { user: sanitizeUser(user), accessToken };
  }

  @Post('login')
  async login(
    @Body() body: { email?: string; password?: string },
  ): Promise<{ user: ReturnType<typeof sanitizeUser>; accessToken: string }> {
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    if (!email || !password) {
      throw new BadRequestException('email и password обязательны');
    }
    const { user, accessToken } = await this.auth.login(email, password);
    return { user: sanitizeUser(user), accessToken };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() req: Request & { user: User }) {
    return { user: sanitizeUser(req.user) };
  }
}
