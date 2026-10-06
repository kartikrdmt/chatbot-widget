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

import type { ServerConfigResponse } from './widget.service.js';
import { WidgetService } from './widget.service.js';
import { SiteService } from './site.service.js';
import { SessionService } from './session.service.js';

@Controller('widget')
export class WidgetController {
  constructor(
    private readonly widget: WidgetService,
    private readonly sites: SiteService,
    private readonly session: SessionService,
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
      throw new BadRequestException('Missing required "token" query parameter.');
    }
    if (!origin?.trim()) {
      throw new ForbiddenException(
        'Origin header is required for widget config requests.',
      );
    }

    const site = await this.sites.findByToken(token.trim());
    if (!site) throw new NotFoundException('Unknown site token.');

    if (!this.sites.isOriginAllowed(site, origin)) {
      throw new ForbiddenException(
        'This origin is not on the allowed list for this site.',
      );
    }

    let visitorId = existingVisitorId?.trim() ?? '';
    if (!visitorId) {
      visitorId = await this.sites.createVisitor(
        site.tenantId.toString(),
        site._id.toString(),
      );
    } else {
      await this.sites.touchVisitor(visitorId);
    }

    const sessionResult = this.session.create({
      tenantId: site.tenantId.toString(),
      siteId: site._id.toString(),
      visitorId,
      origin,
    });

    response.setHeader('Access-Control-Allow-Origin', origin);
    response.vary('Origin');

    return this.widget.getConfigResponse(site, sessionResult, visitorId);
  }
}
