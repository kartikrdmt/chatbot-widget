import { Controller, Get, UseGuards } from '@nestjs/common';

import { TenantContextService } from '../common/services/tenant-context.service.js';
import { SiteService } from '../widget/site.service.js';
import { UsageService } from '../widget/usage.service.js';
import { AdminGuard } from './admin.guard.js';

export interface UsageReport {
  month: string;
  used: number;
  limit: number;
  sites: { siteId: string; messages: number }[];
}

@UseGuards(AdminGuard)
@Controller('admin/usage')
export class AdminUsageController {
  constructor(
    private readonly usage: UsageService,
    private readonly sites: SiteService,
    private readonly tenantContext: TenantContextService,
  ) {}

  @Get()
  async report(): Promise<UsageReport> {
    const tenantId = this.tenantContext.requireTenantId();
    const tenant = await this.sites.findTenant(tenantId);
    const sites = await this.usage.bySite();
    return {
      month: new Date().toISOString().slice(0, 7),
      used: sites.reduce((sum, site) => sum + site.messages, 0),
      limit: tenant?.monthlyMessageLimit ?? 1_000,
      sites,
    };
  }
}
