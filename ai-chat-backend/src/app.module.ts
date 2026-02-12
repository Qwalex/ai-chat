import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { TypeOrmModule } from '@nestjs/typeorm';
import { join } from 'path';
import { ConversationsModule } from './conversations/conversations.module';
import { ModelsModule } from './models/models.module';
import { OpenRouterModule } from './openrouter/openrouter.module';
import { BlogModule } from './blog/blog.module';
import { UploadModule } from './upload/upload.module';
import { ChatModule } from './chat/chat.module';
import { WriteLogModule } from './write-log/write-log.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'better-sqlite3',
        database: config.get<string>('DB_PATH') || join(process.cwd(), 'data.sqlite'),
        autoLoadEntities: true,
        synchronize: true,
      }),
      inject: [ConfigService],
    }),
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'public', 'uploads'),
      serveRoot: '/uploads',
    }),
    WriteLogModule,
    ModelsModule,
    OpenRouterModule,
    UsersModule,
    AuthModule,
    ConversationsModule,
    BlogModule,
    UploadModule,
    ChatModule,
  ],
})
export class AppModule {}
