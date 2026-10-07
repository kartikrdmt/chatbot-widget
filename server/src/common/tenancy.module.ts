import { Global, Module } from '@nestjs/common';

import { TenantContextService } from './services/tenant-context.service.js';

@Global()
@Module({
  providers: [TenantContextService],
  exports: [TenantContextService],
})
export class TenancyModule {}
