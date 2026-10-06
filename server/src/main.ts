import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { SocketIoAdapter } from './common/adapters/socket-io.adapter.js';
import { WidgetSitesService } from './widget/widget-sites.service.js';

try {
  process.loadEnvFile();
} catch {
  // No .env file: rely on the real environment.
}

const corsOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim().toLowerCase())
  .filter(Boolean);

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // The widget runs on the customers' own sites, so their origins are allowed
  // too. Which key each origin may use is checked per request.
  const sites = app.get(WidgetSitesService);
  const siteOrigins = new Set(
    sites.allOrigins().map((origin) => origin.toLowerCase()),
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
