import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { User } from '../users/user.entity';

export type JwtPayload = { sub: string; email: string };

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  register = async (email: string, password: string): Promise<{ user: User; accessToken: string }> => {
    const user = await this.users.create(email, password);
    const accessToken = this.jwt.sign({
      sub: user.id,
      email: user.email,
    } as JwtPayload);
    return { user: this.sanitizeUser(user), accessToken };
  };

  login = async (email: string, password: string): Promise<{ user: User; accessToken: string }> => {
    const user = await this.users.findByEmail(email);
    if (!user || !(await this.users.validatePassword(user, password))) {
      throw new UnauthorizedException('Неверный email или пароль');
    }
    const accessToken = this.jwt.sign({
      sub: user.id,
      email: user.email,
    } as JwtPayload);
    return { user: this.sanitizeUser(user), accessToken };
  };

  validateUserById = async (userId: string): Promise<User | null> => {
    return this.users.findById(userId);
  };

  private sanitizeUser = (user: User): User => {
    const { passwordHash, ...rest } = user;
    return rest as User;
  };
}
