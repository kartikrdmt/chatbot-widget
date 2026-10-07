import { Global, Module } from '@nestjs/common';

import { TenantContextService } from './services/tenant-context.service.js';

/**
 * Makes ONE `TenantContextService` available everywhere. It has to be a single instance: the
 * Mongoose plugin reads the same one `main.ts` registers as the ambient context.
 */
@Global()
@Module({
  providers: [TenantContextService],
  exports: [TenantContextService],
})
export class TenancyModule {}
