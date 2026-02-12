import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

const bootstrap = async () => {
  const app = await NestFactory.create(AppModule);
  const port = process.env.PORT || 3001;
  const corsOrigin = process.env.CORS_ORIGIN;
  const allowedOrigins = corsOrigin
    ? corsOrigin.split(',').map((o) => o.trim())
    : [
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://localhost:3001',
        'http://127.0.0.1:3001',
      ];
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });
  await app.listen(port, '0.0.0.0');
  console.log(`Backend is running at http://localhost:${port}`);
};

bootstrap();
