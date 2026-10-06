import { Injectable, NotFoundException } from '@nestjs/common';

import type { WidgetSite } from './widget-site.schema.js';
import { parseWidgetSites } from './widget-sites.config.js';

const normalizeOrigin = (origin: string): string => origin.trim().toLowerCase();

/**
 * The sites allowed to use the widget, keyed by their public widget key.
 *
 * Backed by the `WIDGET_SITES` environment variable today. Callers only use
 * `find`, `require` and `isOriginAllowed`, so moving the list into a database
 * changes this file and nothing else.
 */
@Injectable()
export class WidgetSitesService {
  private readonly sites: Map<string, WidgetSite>;

  constructor() {
    const sites = parseWidgetSites(
      process.env.WIDGET_SITES,
      process.env.NODE_ENV ?? 'development',
    );
    this.sites = new Map(sites.map((site) => [site.key, site]));
  }

  find(key: string): WidgetSite | undefined {
    return this.sites.get(key);
  }

  require(key: string): WidgetSite {
    const site = this.find(key);
    if (!site) throw new NotFoundException('Unknown widget key.');
    return site;
  }

  /** Every origin that any site is allowed to embed the widget from. */
  allOrigins(): string[] {
    return [...this.sites.values()].flatMap((site) => site.allowedOrigins);
  }

  isOriginAllowed(site: WidgetSite, origin: string): boolean {
    const candidate = normalizeOrigin(origin);
    return site.allowedOrigins.some(
      (allowed) => normalizeOrigin(allowed) === candidate,
    );
  }
}
