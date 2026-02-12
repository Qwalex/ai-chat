import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, INITIAL_TOKEN_BALANCE } from './user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  findByEmail = async (email: string): Promise<User | null> => {
    return this.userRepo
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email: email.toLowerCase().trim() })
      .getOne();
  };

  findById = async (id: string): Promise<User | null> => {
    return this.userRepo.findOne({ where: { id } });
  };

  create = async (email: string, password: string): Promise<User> => {
    const normalized = email.toLowerCase().trim();
    const existing = await this.findByEmail(normalized);
    if (existing) {
      throw new ConflictException('Пользователь с таким email уже зарегистрирован');
    }
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const user = this.userRepo.create({
      email: normalized,
      passwordHash,
      tokenBalance: INITIAL_TOKEN_BALANCE,
    });
    return this.userRepo.save(user);
  };

  validatePassword = async (user: User, password: string): Promise<boolean> => {
    return bcrypt.compare(password, user.passwordHash);
  };

  getBalance = async (userId: string): Promise<number> => {
    const user = await this.findById(userId);
    return user?.tokenBalance ?? 0;
  };

  deductTokens = async (userId: string, tokens: number): Promise<void> => {
    await this.userRepo.decrement({ id: userId }, 'tokenBalance', tokens);
  };

  addTokens = async (userId: string, tokens: number): Promise<void> => {
    await this.userRepo.increment({ id: userId }, 'tokenBalance', tokens);
  };
}
