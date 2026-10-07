import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module.js';
import { SocketIoAdapter } from './common/adapters/socket-io.adapter.js';
import {
  setAmbientTenantContext,
  TenantContextService,
} from './common/services/tenant-context.service.js';
import type { AppConfig } from './config/configuration.js';
import { SiteService } from './widget/site.service.js';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  const config = app.get(ConfigService<AppConfig, true>);
  const corsOrigins = config.get('corsOrigins', { infer: true });
  const tenancy = config.get('tenancy', { infer: true });

  // Hand the DI-managed context to the Mongoose plugin, which is registered on schemas at import
  // time and so cannot inject it.
  setAmbientTenantContext(app.get(TenantContextService));

  // The widget runs on customers' own sites, so any origin listed on a site is allowed too (looked
  // up with a short cache, so a new site needs no restart). Which token each origin may use is
  // checked per request.
  const sites = app.get(SiteService);
  const isOriginAllowed = async (origin: string): Promise<boolean> =>
    corsOrigins.includes(origin.toLowerCase()) ||
    (await sites.isKnownOrigin(origin));

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (error: Error | null, allow?: boolean) => void,
    ) => {
      if (!origin) return callback(null, false);
      isOriginAllowed(origin).then(
        (allowed) => callback(null, allowed),
        () => callback(null, false),
      );
    },
    allowedHeaders: [
      'content-type',
      'authorization',
      'x-admin-key',
      tenancy.header,
    ],
  });
  app.useWebSocketAdapter(new SocketIoAdapter(app, isOriginAllowed));
  app.enableShutdownHooks();

  const port = config.get('port', { infer: true });
  await app.listen(port);
  logger.log(`API listening on http://localhost:${port}`);

  if (tenancy.allowDefaultTenant) {
    logger.warn(
      `Tenant isolation is RELAXED: requests without an "${tenancy.header}" header are served as ` +
        `"${tenancy.defaultTenantId}". Set ALLOW_DEFAULT_TENANT=false in production.`,
    );
  }
}

await bootstrap();
