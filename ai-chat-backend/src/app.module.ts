import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
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
import { BalanceHistoryModule } from './balance-history/balance-history.module';

@Module({
  imports: [
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 200 }]),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        process.env.NODE_ENV && `.env.${process.env.NODE_ENV}.local`,
        process.env.NODE_ENV && `.env.${process.env.NODE_ENV}`,
        '.env.local',
        '.env',
      ].filter((p): p is string => Boolean(p)),
    }),
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
    BalanceHistoryModule,
    ConversationsModule,
    BlogModule,
    UploadModule,
    ChatModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
