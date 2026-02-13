import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TokenUsage } from './balance-history.entity';

export type TokenUsageRecord = {
  userId: string;
  modelId: string;
  modelLabel: string;
  tokensSpent: number;
  costUsd?: number | null;
};

@Injectable()
export class BalanceHistoryService {
  constructor(
    @InjectRepository(TokenUsage)
    private readonly repo: Repository<TokenUsage>,
  ) {}

  record = async (record: TokenUsageRecord): Promise<TokenUsage> => {
    const entity = this.repo.create({
      userId: record.userId,
      modelId: record.modelId,
      modelLabel: record.modelLabel,
      tokensSpent: record.tokensSpent,
      costUsd: record.costUsd ?? null,
    });
    return this.repo.save(entity);
  };

  findByUserId = async (
    userId: string,
    options?: { limit?: number; offset?: number },
  ): Promise<TokenUsage[]> => {
    const { limit = 100, offset = 0 } = options ?? {};
    return this.repo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
  };
}
