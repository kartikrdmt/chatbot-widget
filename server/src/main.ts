import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { SocketIoAdapter } from './common/adapters/socket-io.adapter.js';

try {
  process.loadEnvFile();
} catch {
  // No .env file: rely on the real environment.
}

const corsOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: corsOrigins });
  app.useWebSocketAdapter(new SocketIoAdapter(app, corsOrigins));
  await app.listen(process.env.PORT ?? 4000);
}
await bootstrap();
