import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { SocketIoAdapter } from './common/adapters/socket-io.adapter.js';
import { SiteService } from './widget/site.service.js';

try {
  process.loadEnvFile();
} catch {
  // No .env file: rely on the real environment.
}

const corsOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
  .split(',')
  .map((o) => o.trim().toLowerCase())
  .filter(Boolean);

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Load per-site origins from MongoDB and merge with the static CORS list.
  const sites = app.get(SiteService);
  const siteOriginList = await sites.allOrigins();
  const siteOrigins = new Set(
    siteOriginList.map((o) => o.toLowerCase()),
  );

  const isOriginAllowed = (origin: string): boolean =>
    corsOrigins.includes('*') ||
    corsOrigins.includes(origin.toLowerCase()) ||
    siteOrigins.has(origin.toLowerCase());

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (error: Error | null, allow?: boolean) => void,
    ) => callback(null, !origin || isOriginAllowed(origin)),
  });
  app.useWebSocketAdapter(new SocketIoAdapter(app, isOriginAllowed));
  await app.listen(process.env.PORT ?? 4000);
}
await bootstrap();
