import { AsyncLocalStorage } from 'node:async_hooks';

import { Injectable } from '@nestjs/common';

export interface TenantStore {
  tenantId: string;
}

/**
 * Carries the active tenant for the lifetime of a request.
 *
 * An `AsyncLocalStorage` rather than a request-scoped provider on purpose: the
 * Mongoose tenant plugin runs inside the driver, far from Nest's DI graph, and
 * has no way to be handed a request object. ALS is the only mechanism that
 * reaches it without threading `tenantId` through every call signature — and
 * "somebody forgot to pass tenantId" is exactly the bug class that leaks one
 * tenant's data to another.
 */
@Injectable()
export class TenantContextService {
  private readonly storage = new AsyncLocalStorage<TenantStore>();

  /** Run `callback` with `tenantId` bound to the current async context. */
  run<T>(tenantId: string, callback: () => T): T {
    return this.storage.run({ tenantId }, callback);
  }

  /** The active tenant, or `undefined` outside a request (e.g. a cron task). */
  get tenantId(): string | undefined {
    return this.storage.getStore()?.tenantId;
  }

  /** Same as `tenantId` but throws rather than silently returning everything. */
  requireTenantId(): string {
    const tenantId = this.tenantId;
    if (!tenantId) {
      throw new Error(
        'No tenant in context. Did the request bypass TenantContextMiddleware?',
      );
    }
    return tenantId;
  }
}

/**
 * Module-level handle for the Mongoose plugin.
 *
 * Mongoose plugins are registered on schemas at import time, before Nest's
 * container exists, so they cannot inject `TenantContextService`. The app sets
 * this once during bootstrap.
 */
let ambientContext: TenantContextService | undefined;

export const setAmbientTenantContext = (
  context: TenantContextService,
): void => {
  ambientContext = context;
};

export const getAmbientTenantContext = (): TenantContextService | undefined =>
  ambientContext;
