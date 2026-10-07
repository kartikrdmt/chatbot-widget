import { describe, expect, it } from 'vitest';

import {
  CreateSiteRequestSchema,
  SiteSettingsInputSchema,
  WIDGET_LIMITS,
  WidgetConfigSchema,
  WidgetThemeSchema,
  WidgetVisitorMessageSchema,
} from '../src';

describe('the admin saves strictly', () => {
  it('accepts a valid look', () => {
    const settings = {
      theme: { accent: '#162E56', accentForeground: '#fff', radius: 'pill', font: 'Inter' },
      copy: { title: 'Acme Support', avatarText: 'A' },
      launcher: { position: 'left-center', offset: 16, width: '90vw' },
      features: { streaming: false },
      messagesPerMinute: 20,
      siteMessagesPerMinute: 300,
    };
    expect(SiteSettingsInputSchema.parse(settings)).toEqual(settings);
  });

  it.each([
    ['a CSS-injection colour', { theme: { accent: 'red; background: url(//evil)' } }],
    ['an unknown theme key', { theme: { accentColor: '#fff' } }],
    ['an unknown setting', { admin: true }],
    ['a bad font name', { theme: { font: 'Inter; } body {' } }],
    ['a bad size', { launcher: { width: 'calc(100vw - 1px)' } }],
    ['too many messages per minute', { messagesPerMinute: 100_000 }],
  ])('rejects %s', (_name, settings) => {
    expect(SiteSettingsInputSchema.safeParse(settings).success).toBe(false);
  });

  it('only accepts exact origins as allowed websites', () => {
    const ok = CreateSiteRequestSchema.safeParse({ name: 'A', allowedOrigins: ['https://a.com'] });
    const bad = CreateSiteRequestSchema.safeParse({
      name: 'A',
      allowedOrigins: ['https://a.com/'],
    });
    expect(ok.success).toBe(true);
    expect(bad.success).toBe(false);
  });
});

describe('the widget reads leniently', () => {
  it('keeps what an admin saved (the server and widget cannot disagree on field names)', () => {
    const saved = { accent: '#162E56', radius: 'pill' } as const;
    expect(WidgetThemeSchema.parse(saved)).toMatchObject(saved);
  });

  it('drops one bad stored value instead of failing the whole config', () => {
    const config = WidgetConfigSchema.parse({
      theme: { accent: 'url(javascript:x)', radius: 'pill' },
    });
    expect(config.theme.accent).toBeUndefined();
    expect(config.theme.radius).toBe('pill');
  });

  it('fills in defaults for an empty config', () => {
    const config = WidgetConfigSchema.parse({});
    expect(config.launcher.position).toBe('bottom-right');
    expect(config.features).toEqual({ streaming: true, showSources: true });
  });
});

describe('visitor messages', () => {
  it('are capped', () => {
    const long = 'x'.repeat(WIDGET_LIMITS.maxMessageLength + 1);
    expect(WidgetVisitorMessageSchema.safeParse({ text: long, clientMessageId: 'm' }).success).toBe(
      false,
    );
    expect(WidgetVisitorMessageSchema.safeParse({ text: 'hi', clientMessageId: 'm' }).success).toBe(
      true,
    );
  });
});
