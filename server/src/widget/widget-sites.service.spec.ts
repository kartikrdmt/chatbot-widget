import { NotFoundException } from '@nestjs/common';

import type { WidgetSite } from './widget-site.schema.js';
import { WidgetSitesService } from './widget-sites.service.js';

const ACME: WidgetSite = { key: 'acme', allowedOrigins: ['https://acme.com'] };

const buildService = (sites: WidgetSite[]): WidgetSitesService => {
  process.env.WIDGET_SITES = JSON.stringify(sites);
  return new WidgetSitesService();
};

describe('WidgetSitesService', () => {
  afterEach(() => {
    delete process.env.WIDGET_SITES;
  });

  it('finds a configured key and returns undefined for an unknown one', () => {
    const service = buildService([ACME]);
    expect(service.find('acme')).toEqual(ACME);
    expect(service.find('other')).toBeUndefined();
  });

  it('require throws NotFound for an unknown key', () => {
    expect(() => buildService([ACME]).require('other')).toThrow(
      NotFoundException,
    );
  });

  it('allows only listed origins, ignoring case', () => {
    const service = buildService([ACME]);
    expect(service.isOriginAllowed(ACME, 'https://acme.com')).toBe(true);
    expect(service.isOriginAllowed(ACME, 'https://ACME.com')).toBe(true);
    expect(service.isOriginAllowed(ACME, 'https://evil.com')).toBe(false);
    expect(service.isOriginAllowed(ACME, 'https://acme.com.evil.com')).toBe(
      false,
    );
    expect(service.isOriginAllowed(ACME, 'http://acme.com')).toBe(false);
  });
});
