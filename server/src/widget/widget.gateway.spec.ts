import type { ConfigService } from '@nestjs/config';
import type { Socket } from 'socket.io';

import type { TenantContextService } from '../common/services/tenant-context.service.js';
import type { AppConfig } from '../config/configuration.js';
import type {
  AnswerEvent,
  AnswerProvider,
  AnswerRequest,
} from './answer/answer-provider.js';
import type { ConversationService } from './conversation.service.js';
import type { RateLimitService } from './rate-limit.service.js';
import type { SessionService } from './session.service.js';
import type { SiteService } from './site.service.js';
import type { UsageService } from './usage.service.js';
import { WidgetGateway } from './widget.gateway.js';
import { WidgetService } from './widget.service.js';

const SESSION = {
  tenantId: 'tenant-1',
  siteId: 'site-1',
  visitorId: 'v_1',
  origin: 'https://acme.com',
};

const CONVERSATION = { _id: { toString: () => 'conv-1' }, siteId: 'site-1' };

/** Everything the gateway depends on, as controllable fakes. */
function setup(
  overrides: {
    site?: Record<string, unknown> | null;
    tenant?: Record<string, unknown> | null;
    answer?: (request: AnswerRequest) => AsyncGenerator<AnswerEvent>;
  } = {},
) {
  const tenantsSeen: string[] = [];
  const saved: { sender: string; text: string; sources?: unknown }[] = [];

  const sites = {
    findById: vi
      .fn()
      .mockResolvedValue(
        overrides.site === null
          ? null
          : {
              _id: { toString: () => 'site-1' },
              status: 'active',
              settings: {},
              ...overrides.site,
            },
      ),
    findTenant: vi
      .fn()
      .mockResolvedValue(
        overrides.tenant === null
          ? null
          : { status: 'active', monthlyMessageLimit: 100, ...overrides.tenant },
      ),
  };
  const session = {
    verify: vi.fn().mockReturnValue(SESSION),
    expiresAtMs: vi.fn().mockReturnValue(Date.now() + 60_000),
  };
  const conversations = {
    findOrCreate: vi.fn().mockResolvedValue(CONVERSATION),
    isDuplicate: vi.fn().mockResolvedValue(false),
    saveMessage: vi.fn(
      async (
        _c: unknown,
        sender: string,
        text: string,
        _id?: string,
        sources?: unknown,
      ) => {
        saved.push({ sender, text, sources });
      },
    ),
    getHistory: vi.fn().mockResolvedValue([
      { sender: 'assistant', text: 'Hi!' },
      { sender: 'visitor', text: 'the question' },
    ]),
  };
  const rateLimiter = {
    checkAll: vi.fn().mockResolvedValue({ allowed: true }),
  };
  const usage = {
    monthlyStatus: vi
      .fn()
      .mockResolvedValue({ allowed: true, used: 1, limit: 100 }),
    recordMessage: vi.fn().mockResolvedValue(undefined),
  };
  const answerSpy = vi.fn(
    overrides.answer ??
      async function* (): AsyncGenerator<AnswerEvent> {
        yield { type: 'delta', text: 'Hello ' };
        yield { type: 'delta', text: 'world' };
        yield {
          type: 'sources',
          sources: [{ title: 'About', url: 'https://acme.com/about' }],
        };
      },
  );
  const tenantContext = {
    run: vi.fn(<T>(tenantId: string, callback: () => T): T => {
      tenantsSeen.push(tenantId);
      return callback();
    }),
  };
  const config = { get: () => false };

  const gateway = new WidgetGateway(
    new WidgetService(),
    sites as unknown as SiteService,
    session as unknown as SessionService,
    conversations as unknown as ConversationService,
    rateLimiter as unknown as RateLimitService,
    usage as unknown as UsageService,
    { answer: answerSpy } as unknown as AnswerProvider,
    tenantContext as unknown as TenantContextService,
    config as unknown as ConfigService<AppConfig, true>,
  );

  const client = (
    over: {
      origin?: string | undefined;
      auth?: unknown;
      address?: string;
    } = {},
  ) => {
    const emitted: { event: string; payload: unknown }[] = [];
    const socket = {
      handshake: {
        auth: 'auth' in over ? over.auth : { sessionToken: 'token' },
        headers: {
          origin: 'origin' in over ? over.origin : 'https://acme.com',
        },
        address: over.address ?? '203.0.113.7',
      },
      disconnect: vi.fn(),
      emit: (event: string, payload: unknown) =>
        emitted.push({ event, payload }),
      data: {} as Record<string, unknown>,
    };
    return { socket: socket as unknown as Socket, emitted };
  };

  const connected = (over: Parameters<typeof client>[0] = {}) => {
    const c = client(over);
    gateway.handleConnection(c.socket);
    return c;
  };
  const send = (
    c: ReturnType<typeof client>,
    text = 'the question',
    id = 'm1',
  ) => gateway.onVisitorMessage({ text, clientMessageId: id }, c.socket);
  const events = (c: ReturnType<typeof client>) =>
    c.emitted.map((e) => e.event);
  const errors = (c: ReturnType<typeof client>) =>
    c.emitted.filter((e) => e.event === 'chat:error').map((e) => e.payload);

  return {
    gateway,
    sites,
    session,
    conversations,
    rateLimiter,
    usage,
    answerSpy,
    tenantsSeen,
    saved,
    client,
    connected,
    send,
    events,
    errors,
  };
}

describe('connecting', () => {
  it('accepts a valid session from the site it was issued to', () => {
    const { connected } = setup();
    const c = connected();
    expect(c.socket.disconnect).not.toHaveBeenCalled();
    expect(c.socket.data['session']).toEqual(SESSION);
  });

  it('turns away a request with no session token', () => {
    const { client, gateway } = setup();
    const c = client({ auth: {} });
    gateway.handleConnection(c.socket);
    expect(c.socket.disconnect).toHaveBeenCalledWith(true);
  });

  it('tells the widget when its session is invalid or expired, then drops it', () => {
    const { session, connected, errors } = setup();
    session.verify.mockReturnValue(null);
    const c = connected();
    expect(errors(c)).toEqual([{ code: 'session_expired' }]);
    expect(c.socket.disconnect).toHaveBeenCalledWith(true);
  });

  it('turns away a missing Origin and a token used from another website', () => {
    const { connected } = setup();
    expect(
      connected({ origin: undefined }).socket.disconnect,
    ).toHaveBeenCalledWith(true);
    expect(
      connected({ origin: 'https://evil.com' }).socket.disconnect,
    ).toHaveBeenCalledWith(true);
  });

  it('allows five connections from one IP, refuses the sixth, and frees a slot on disconnect', () => {
    const { gateway, connected, errors } = setup();
    const open = Array.from({ length: 5 }, () => connected());
    expect(
      open.every(
        (c) =>
          !(c.socket.disconnect as ReturnType<typeof vi.fn>).mock.calls.length,
      ),
    ).toBe(true);

    const sixth = connected();
    expect(sixth.socket.disconnect).toHaveBeenCalledWith(true);
    expect(errors(sixth)).toEqual([{ code: 'rate_limited', retryAfter: 30 }]);

    gateway.handleDisconnect(open[0]!.socket);
    expect(connected().socket.disconnect).not.toHaveBeenCalled();
  });

  it('does not let a refused connection use up a slot', () => {
    const { gateway, connected } = setup();
    const refused = connected({ origin: 'https://evil.com' });
    gateway.handleDisconnect(refused.socket);
    for (let i = 0; i < 5; i++)
      expect(connected().socket.disconnect).not.toHaveBeenCalled();
  });
});

describe('a visitor message', () => {
  it('runs inside the session tenant, streams the answer, then the final message with sources', async () => {
    const t = setup();
    const c = t.connected();
    await t.send(c);

    expect(t.tenantsSeen).toContain('tenant-1');
    expect(t.events(c)).toEqual([
      'chat:typing',
      'chat:message', // empty placeholder
      'chat:message:delta',
      'chat:message:delta',
      'chat:message:delta', // done
      'chat:message', // final
      'chat:typing',
    ]);

    const messages = c.emitted
      .filter((e) => e.event === 'chat:message')
      .map(
        (e) =>
          e.payload as {
            id: string;
            text: string;
            sources?: unknown;
            streaming?: boolean;
          },
      );
    expect(messages[0]).toMatchObject({ text: '', streaming: true });
    expect(messages[1]).toMatchObject({
      id: messages[0]!.id,
      text: 'Hello world',
      sources: [{ title: 'About', url: 'https://acme.com/about' }],
    });
    expect(c.emitted.at(-1)).toEqual({ event: 'chat:typing', payload: false });
  });

  it('saves both sides, counts the usage once, and gives the model the earlier turns only', async () => {
    const t = setup();
    await t.send(t.connected());

    expect(t.saved).toEqual([
      { sender: 'visitor', text: 'the question', sources: undefined },
      {
        sender: 'assistant',
        text: 'Hello world',
        sources: [{ title: 'About', url: 'https://acme.com/about' }],
      },
    ]);
    expect(t.usage.recordMessage).toHaveBeenCalledTimes(1);
    expect(t.usage.recordMessage).toHaveBeenCalledWith('site-1');
    expect(t.answerSpy.mock.calls[0]![0]).toMatchObject({
      tenantId: 'tenant-1',
      conversationId: 'conv-1',
      question: 'the question',
      history: [],
    });
  });

  it('sends one plain message, with no placeholder, when the site turns streaming off', async () => {
    const t = setup({ site: { settings: { features: { streaming: false } } } });
    const c = t.connected();
    await t.send(c);
    expect(t.events(c)).toEqual(['chat:typing', 'chat:message', 'chat:typing']);
  });

  it('applies the limits of the visitor, the IP and the site, before calling the model', async () => {
    const t = setup({
      site: {
        settings: {
          messagesPerMinute: 3,
          messagesPerDay: 50,
          siteMessagesPerMinute: 99,
        },
      },
    });
    await t.send(t.connected());
    expect(t.rateLimiter.checkAll).toHaveBeenCalledWith([
      { key: 'visitor:v_1', perMinute: 3, perDay: 50 },
      { key: 'ip:203.0.113.7', perMinute: 30 },
      { key: 'site:site-1', perMinute: 99 },
    ]);
  });

  it('turns a rate-limited message away without saving it or calling the model', async () => {
    const t = setup();
    t.rateLimiter.checkAll.mockResolvedValue({
      allowed: false,
      retryAfter: 12,
    });
    const c = t.connected();
    await t.send(c);
    expect(t.errors(c)).toEqual([{ code: 'rate_limited', retryAfter: 12 }]);
    expect(t.answerSpy).not.toHaveBeenCalled();
    expect(t.saved).toEqual([]);
    expect(t.usage.recordMessage).not.toHaveBeenCalled();
  });

  it('reports a spent daily cap as quota_exceeded', async () => {
    const t = setup();
    t.rateLimiter.checkAll.mockResolvedValue({
      allowed: false,
      quotaExceeded: true,
    });
    const c = t.connected();
    await t.send(c);
    expect(t.errors(c)).toEqual([{ code: 'quota_exceeded' }]);
  });

  it("stops at the tenant's monthly allowance before calling the model", async () => {
    const t = setup();
    t.usage.monthlyStatus.mockResolvedValue({
      allowed: false,
      used: 100,
      limit: 100,
    });
    const c = t.connected();
    await t.send(c);
    expect(t.errors(c)).toEqual([{ code: 'quota_exceeded' }]);
    expect(t.usage.monthlyStatus).toHaveBeenCalledWith('tenant-1', 100);
    expect(t.answerSpy).not.toHaveBeenCalled();
    expect(t.saved).toEqual([]);
  });

  it.each([
    ['a disabled site', { site: { status: 'disabled' } }],
    ['a disabled tenant', { tenant: { status: 'disabled' } }],
  ])(
    'refuses chats for %s (the emergency switch works on open chats)',
    async (_name, overrides) => {
      const t = setup(overrides);
      const c = t.connected();
      await t.send(c);
      expect(t.errors(c)).toEqual([{ code: 'disabled' }]);
      expect(t.answerSpy).not.toHaveBeenCalled();
      expect(t.saved).toEqual([]);
    },
  );

  it('ignores a message it already has, without counting or answering it again', async () => {
    const t = setup();
    t.conversations.isDuplicate.mockResolvedValue(true);
    const c = t.connected();
    await t.send(c);
    expect(t.rateLimiter.checkAll).not.toHaveBeenCalled();
    expect(t.answerSpy).not.toHaveBeenCalled();
    expect(c.emitted).toEqual([]);
  });

  it('refuses, without saving, once the session token has expired', async () => {
    const t = setup();
    t.session.expiresAtMs.mockReturnValue(Date.now() - 1_000);
    const c = t.connected();
    await t.send(c);
    expect(t.errors(c)).toEqual([{ code: 'session_expired' }]);
    expect(t.saved).toEqual([]);
  });

  it('ignores a message that breaks the contract (too long, or no id)', async () => {
    const t = setup();
    const c = t.connected();
    await t.gateway.onVisitorMessage(
      { text: 'x'.repeat(2_001), clientMessageId: 'm' },
      c.socket,
    );
    await t.gateway.onVisitorMessage({ text: 'hi' }, c.socket);
    expect(t.answerSpy).not.toHaveBeenCalled();
  });

  it('replaces the empty bubble with the apology, and saves it, when the answer fails', async () => {
    const t = setup({
      answer: async function* () {
        throw new Error('model down');
      },
    });
    const c = t.connected();
    await t.send(c);

    const messages = c.emitted
      .filter((e) => e.event === 'chat:message')
      .map((e) => e.payload as { id: string; text: string });
    expect(messages).toHaveLength(2);
    expect(messages[1]!.id).toBe(messages[0]!.id);
    expect(messages[1]!.text).toMatch(/could not answer/);
    expect(t.saved.at(-1)).toMatchObject({
      sender: 'assistant',
      text: expect.stringMatching(/could not answer/),
    });
    expect(c.emitted.at(-1)).toEqual({ event: 'chat:typing', payload: false });
  });

  it('treats an empty answer as a failure', async () => {
    const t = setup({
      answer: async function* () {
        yield { type: 'delta', text: '   ' };
      },
    });
    const c = t.connected();
    await t.send(c);
    expect(t.saved.at(-1)).toMatchObject({
      text: expect.stringMatching(/could not answer/),
    });
  });
});

describe('conversation history', () => {
  it("returns the visitor's stored messages, read inside their tenant", async () => {
    const t = setup();
    const c = t.connected();
    const history = await t.gateway.onConversationHistory(c.socket);
    expect(history.map((m) => m.text)).toEqual(['Hi!', 'the question']);
    expect(t.tenantsSeen).toEqual(['tenant-1']);
  });

  it('returns nothing to a connection with no session', async () => {
    const t = setup();
    expect(await t.gateway.onConversationHistory(t.client().socket)).toEqual(
      [],
    );
  });
});
