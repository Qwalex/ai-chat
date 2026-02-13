import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { User } from '../users/user.entity';
import { BalanceHistoryService } from './balance-history.service';

@Controller('api/balance-history')
@UseGuards(JwtAuthGuard)
export class BalanceHistoryController {
  constructor(private readonly balanceHistory: BalanceHistoryService) {}

  @Get()
  async getHistory(@Req() req: { user: User }) {
    const user = req.user as User;
    const items = await this.balanceHistory.findByUserId(user.id);
    return {
      history: items.map((row) => ({
        id: row.id,
        modelId: row.modelId,
        modelLabel: row.modelLabel,
        tokensSpent: row.tokensSpent,
        createdAt: row.createdAt,
      })),
    };
  }
}
