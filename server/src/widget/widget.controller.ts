import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  NotFoundException,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';

import { SkipTenant } from '../common/decorators/index.js';
import { TenantContextService } from '../common/services/tenant-context.service.js';

import type { ServerConfigResponse } from './widget.service.js';
import { WidgetService } from './widget.service.js';
import { SiteService } from './site.service.js';
import { SessionService } from './session.service.js';

/** No tenant header here: the tenant comes from the site token, then every query is scoped to it. */
@SkipTenant()
@Controller('widget')
export class WidgetController {
  constructor(
    private readonly widget: WidgetService,
    private readonly sites: SiteService,
    private readonly session: SessionService,
    private readonly tenantContext: TenantContextService,
  ) {}

  /**
   * Returns widget config and a short-lived JWT session token.
   *
   * - `token`    — public site token (st_…) from the embed script
   * - `visitorId` — optional; pass an existing ID to resume a session
   * - `Origin`   — required; checked against the site's allowed-origins list
   */
  @Get('config')
  async getConfig(
    @Query('token') token: string | undefined,
    @Query('visitorId') existingVisitorId: string | undefined,
    @Headers('origin') origin: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ServerConfigResponse> {
    if (!token?.trim()) {
      throw new BadRequestException(
        'Missing required "token" query parameter.',
      );
    }
    if (!origin?.trim()) {
      throw new ForbiddenException(
        'Origin header is required for widget config requests.',
      );
    }

    // Echo the origin before any check, so a rejected website still gets a readable 403/404
    // (an error message only) and the widget can log why it is not shown.
    response.setHeader('Access-Control-Allow-Origin', origin);
    response.vary('Origin');

    const site = await this.sites.findByToken(token.trim());
    if (!site) throw new NotFoundException('Unknown site token.');

    if (!this.sites.isOriginAllowed(site, origin)) {
      throw new ForbiddenException(
        'This origin is not on the allowed list for this site.',
      );
    }

    const tenantId = site.tenantId;
    const siteId = site._id.toString();

    // A disabled site gets no session at all, so no chat can start.
    if (site.status === 'disabled') {
      return this.widget.getConfigResponse(site);
    }

    // From here on every query runs for this site's tenant, and only that tenant.
    return this.tenantContext.run(tenantId, async () => {
      const visitorId = await this.sites.resolveVisitor(
        siteId,
        existingVisitorId,
      );
      const sessionResult = this.session.create({
        tenantId,
        siteId,
        visitorId,
        origin,
      });
      return this.widget.getConfigResponse(site, sessionResult, visitorId);
    });
  }
}
