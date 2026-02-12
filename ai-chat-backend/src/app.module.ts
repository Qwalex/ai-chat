import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { ConversationsModule } from './conversations/conversations.module';
import { ModelsModule } from './models/models.module';
import { OpenRouterModule } from './openrouter/openrouter.module';
import { BlogModule } from './blog/blog.module';
import { UploadModule } from './upload/upload.module';
import { ChatModule } from './chat/chat.module';
import { WriteLogModule } from './write-log/write-log.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'public', 'uploads'),
      serveRoot: '/uploads',
    }),
    WriteLogModule,
    ModelsModule,
    OpenRouterModule,
    ConversationsModule,
    BlogModule,
    UploadModule,
    ChatModule,
  ],
})
export class AppModule {}
