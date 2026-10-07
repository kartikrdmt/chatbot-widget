import type { SiteDocument } from './schemas/site.schema.js';
import { WidgetService } from './widget.service.js';

const site = (overrides: Record<string, unknown> = {}) =>
  ({
    _id: { toString: () => 'site-1' },
    status: 'active',
    settings: {},
    ...overrides,
  }) as unknown as SiteDocument;

describe('WidgetService.getConfigResponse', () => {
  const service = new WidgetService();

  it('sends what an admin saved, under the names the widget reads', () => {
    const config = service.getConfigResponse(
      site({
        settings: {
          theme: { accent: '#162E56', radius: 'pill' },
          copy: { title: 'Acme Support', avatarText: 'A' },
          launcher: { position: 'left-center', offset: 12 },
          features: { streaming: false },
        },
      }),
    );
    expect(config.theme).toMatchObject({ accent: '#162E56', radius: 'pill' });
    expect(config.copy).toMatchObject({
      title: 'Acme Support',
      avatarText: 'A',
    });
    expect(config.launcher).toMatchObject({
      position: 'left-center',
      offset: 12,
    });
    expect(config.features.streaming).toBe(false);
  });

  it('never sends server-only settings', () => {
    const config = service.getConfigResponse(
      site({
        settings: {
          systemPrompt: 'SECRET PROMPT',
          llmModel: 'secret-model',
          messagesPerMinute: 3,
          siteMessagesPerMinute: 9,
        },
      }),
    );
    const sent = JSON.stringify(config);
    expect(sent).not.toMatch(
      /SECRET PROMPT|secret-model|messagesPerMinute|siteMessagesPerMinute/,
    );
  });

  it('falls back to defaults for a site with no settings', () => {
    const config = service.getConfigResponse(site());
    expect(config.copy.title).toBe('Chat with us');
    expect(config.launcher.position).toBe('bottom-right');
    expect(config.features).toEqual({ streaming: true, showSources: true });
  });

  it('drops one bad stored value without breaking the rest', () => {
    const config = service.getConfigResponse(
      site({ settings: { theme: { accent: 'red; evil', radius: 'pill' } } }),
    );
    expect(config.theme.accent).toBeUndefined();
    expect(config.theme.radius).toBe('pill');
  });

  it('includes the session and visitor only when given', () => {
    const session = { token: 't', expiresAt: '2099-01-01T00:00:00.000Z' };
    expect(service.getConfigResponse(site(), session, 'v_1')).toMatchObject({
      session,
      visitorId: 'v_1',
    });
    expect(service.getConfigResponse(site())).not.toHaveProperty('session');
  });
});

describe('WidgetService.historyToTurns', () => {
  const service = new WidgetService();

  it('drops the opening assistant message and merges same-side neighbours', () => {
    expect(
      service.historyToTurns([
        { sender: 'assistant', text: 'Hi!' },
        { sender: 'visitor', text: 'one' },
        { sender: 'visitor', text: 'two' },
        { sender: 'assistant', text: 'answer' },
      ]),
    ).toEqual([
      { role: 'user', text: 'one\n\ntwo' },
      { role: 'assistant', text: 'answer' },
    ]);
  });
});

describe('WidgetService.buildMessage', () => {
  it('attaches sources only when there are some', () => {
    const service = new WidgetService();
    expect(service.buildMessage('assistant', 'x')).not.toHaveProperty(
      'sources',
    );
    const sources = [{ title: 'Page', url: 'https://acme.com/a' }];
    expect(service.buildMessage('assistant', 'x', sources).sources).toEqual(
      sources,
    );
  });
});
