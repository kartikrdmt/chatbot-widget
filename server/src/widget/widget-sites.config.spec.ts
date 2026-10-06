import { parseWidgetSites } from './widget-sites.config.js';

describe('parseWidgetSites', () => {
  it('serves the demo site in development when unset', () => {
    const sites = parseWidgetSites(undefined, 'development');
    expect(sites.map((site) => site.key)).toEqual(['demo-key']);
  });

  it('serves no sites in production when unset, so every key is rejected', () => {
    expect(parseWidgetSites(undefined, 'production')).toEqual([]);
    expect(parseWidgetSites('  ', 'production')).toEqual([]);
  });

  it('parses a valid list', () => {
    const raw = JSON.stringify([
      {
        key: 'acme',
        allowedOrigins: ['https://acme.com'],
        position: 'bottom-left',
      },
    ]);
    expect(parseWidgetSites(raw, 'production')).toEqual([
      {
        key: 'acme',
        allowedOrigins: ['https://acme.com'],
        position: 'bottom-left',
      },
    ]);
  });

  it('throws on invalid JSON', () => {
    expect(() => parseWidgetSites('{nope', 'production')).toThrow(
      'not valid JSON',
    );
  });

  it.each([
    [
      'an origin with a path',
      [{ key: 'a', allowedOrigins: ['https://acme.com/app'] }],
    ],
    ['a trailing slash', [{ key: 'a', allowedOrigins: ['https://acme.com/'] }]],
    ['no origins', [{ key: 'a', allowedOrigins: [] }]],
    [
      'a bad position',
      [{ key: 'a', allowedOrigins: ['https://a.com'], position: 'middle' }],
    ],
    [
      'duplicate keys',
      [
        { key: 'a', allowedOrigins: ['https://a.com'] },
        { key: 'a', allowedOrigins: ['https://b.com'] },
      ],
    ],
  ])('rejects %s', (_label, value) => {
    expect(() => parseWidgetSites(JSON.stringify(value), 'production')).toThrow(
      'WIDGET_SITES',
    );
  });
});
