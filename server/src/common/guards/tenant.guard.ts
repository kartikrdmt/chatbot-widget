import {
  BadRequestException,
  type CanActivate,
  type ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';

import type { AppConfig } from '../../config/configuration.js';
import { SKIP_TENANT_KEY, type TenantRequest } from '../decorators/index.js';

/**
 * Resolves and enforces the tenant for every request.
 *
 * Registered globally (see `AppModule`), so the default is "scoped" and a new
 * controller is tenant-safe without anyone remembering to add anything. Routes
 * that legitimately have no tenant opt out with `@SkipTenant()`.
 *
 * In development a missing header falls back to `DEFAULT_TENANT_ID` so the app
 * is usable from a browser address bar; in production the header is required.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  private readonly logger = new Logger(TenantGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    // Socket events carry no HTTP headers; the widget gateway sets its own tenant from the
    // verified session token instead.
    if (context.getType() !== 'http') return true;

    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_TENANT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return true;

    const tenancy = this.config.get('tenancy', { infer: true });
    const request = context.switchToHttp().getRequest<
      TenantRequest & {
        headers: Record<string, string | string[] | undefined>;
      }
    >();

    const raw = request.headers[tenancy.header];
    const headerValue = Array.isArray(raw) ? raw[0] : raw;
    const tenantId = headerValue?.trim();

    if (tenantId) {
      request.tenantId = tenantId;
      return true;
    }

    if (tenancy.allowDefaultTenant) {
      this.logger.debug(
        `No "${tenancy.header}" header; falling back to "${tenancy.defaultTenantId}" (non-production).`,
      );
      request.tenantId = tenancy.defaultTenantId;
      return true;
    }

    throw new BadRequestException(
      `Missing required "${tenancy.header}" header.`,
    );
  }
}
