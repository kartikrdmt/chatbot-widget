import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Query,
  Res,
} from '@nestjs/common';
import type { WidgetConfig, WidgetEmbedPolicy } from './widget.contracts.js';
import type { Response } from 'express';

import type { WidgetSite } from './widget-site.schema.js';
import { WidgetService } from './widget.service.js';
import { WidgetSitesService } from './widget-sites.service.js';

@Controller('widget')
export class WidgetController {
  constructor(
    private readonly widget: WidgetService,
    private readonly sites: WidgetSitesService,
  ) {}

  /**
   * Browsers send `Origin` on the cross-origin fetch the embed script makes, so
   * a site that is not on the key's allow-list gets a 403 here. Server-side
   * callers send no `Origin` and are not restricted.
   */
  @Get('config')
  getConfig(
    @Query('key') key: string | undefined,
    @Headers('origin') origin: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): WidgetConfig {
    const site = this.resolveSite(key);

    if (origin) {
      if (!this.sites.isOriginAllowed(site, origin)) {
        throw new ForbiddenException(
          'This origin is not allowed for this widget key.',
        );
      }
      response.setHeader('Access-Control-Allow-Origin', origin);
      response.vary('Origin');
    }

    return this.widget.getConfig(site);
  }

  /** Read by the web app to build the `frame-ancestors` header for `/embed`. */
  @Get('embed-policy')
  getEmbedPolicy(@Query('key') key: string | undefined): WidgetEmbedPolicy {
    return this.widget.getEmbedPolicy(this.resolveSite(key));
  }

  private resolveSite(key: string | undefined): WidgetSite {
    const trimmed = key?.trim();
    if (!trimmed)
      throw new BadRequestException('Missing required "key" query parameter.');
    return this.sites.require(trimmed);
  }
}
