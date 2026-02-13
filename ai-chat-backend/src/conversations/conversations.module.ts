import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConversationsController } from './conversations.controller';
import { ConversationsService } from './conversations.service';
import { ConversationEntity } from './entities/conversation.entity';
import { Message } from './entities/message.entity';
import { OpenRouterModule } from '../openrouter/openrouter.module';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { BalanceHistoryModule } from '../balance-history/balance-history.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ConversationEntity, Message]),
    OpenRouterModule,
    AuthModule,
    UsersModule,
    BalanceHistoryModule,
  ],
  controllers: [ConversationsController],
  providers: [ConversationsService],
  exports: [ConversationsService],
})
export class ConversationsModule {}
