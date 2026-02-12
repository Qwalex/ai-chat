import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ConversationsModule } from '../conversations/conversations.module';
import { OpenRouterModule } from '../openrouter/openrouter.module';

@Module({
  imports: [OpenRouterModule, ConversationsModule],
  controllers: [ChatController],
})
export class ChatModule {}
