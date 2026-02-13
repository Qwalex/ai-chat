import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { Request } from 'express';
import { AuthService, JwtPayload } from './auth.service';

const cookieOrBearerExtractor = (req: Request): string | null => {
  const token = req?.cookies?.accessToken;
  if (token) return token;
  const auth = req?.headers?.authorization;
  if (auth?.startsWith('Bearer ')) return auth.slice(7);
  return null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly config: ConfigService,
    private readonly auth: AuthService,
  ) {
    const secret = config.get<string>('JWT_SECRET');
    if (process.env.NODE_ENV === 'production' && !secret) {
      throw new Error('JWT_SECRET is required in production');
    }
    super({
      jwtFromRequest: cookieOrBearerExtractor,
      ignoreExpiration: false,
      secretOrKey: secret || 'dev-secret-change-in-production',
    });
  }

  validate = async (payload: JwtPayload) => {
    const user = await this.auth.validateUserById(payload.sub);
    if (!user) throw new UnauthorizedException();
    return user;
  };
}
