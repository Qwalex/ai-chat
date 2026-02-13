import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TokenUsage } from './balance-history.entity';
import { BalanceHistoryService } from './balance-history.service';
import { BalanceHistoryController } from './balance-history.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([TokenUsage]),
    AuthModule,
  ],
  controllers: [BalanceHistoryController],
  providers: [BalanceHistoryService],
  exports: [BalanceHistoryService],
})
export class BalanceHistoryModule {}
