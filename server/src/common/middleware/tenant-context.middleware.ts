import { Injectable, type NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NextFunction, Request, Response } from 'express';

import type { AppConfig } from '../../config/configuration.js';
import { TenantContextService } from '../services/tenant-context.service.js';

/**
 * Binds the tenant to the request's async context.
 *
 * This has to be middleware rather than a guard: `AsyncLocalStorage.run()`
 * wraps a callback, and a guard returns a boolean instead of wrapping the rest
 * of the request. Middleware is the only hook early enough to enclose the whole
 * handler chain -- which is what the Mongoose plugin reads from.
 *
 * Validation stays in `TenantGuard`; this only establishes the context.
 */
@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  use(request: Request, _response: Response, next: NextFunction): void {
    const tenancy = this.config.get('tenancy', { infer: true });
    const raw = request.headers[tenancy.header];
    const headerValue = Array.isArray(raw) ? raw[0] : raw;
    const tenantId = headerValue?.trim() || tenancy.defaultTenantId;

    this.tenantContext.run(tenantId, () => next());
  }
}
