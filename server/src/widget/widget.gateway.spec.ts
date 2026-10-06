import type { Socket } from 'socket.io';

import type { ConversationService } from './conversation.service.js';
import type { RagService } from './rag.service.js';
import type { RateLimitService } from './rate-limit.service.js';
import type { SessionService } from './session.service.js';
import type { SiteService } from './site.service.js';
import type { WidgetService } from './widget.service.js';
import { WidgetGateway } from './widget.gateway.js';

const VALID_PAYLOAD = {
  tenantId: 'tenant-1',
  siteId: 'site-1',
  visitorId: 'v_1',
  origin: 'https://acme.com',
};

const mockSession = {
  verify: vi.fn().mockReturnValue(VALID_PAYLOAD),
};

const buildGateway = () =>
  new WidgetGateway(
    {} as WidgetService,
    {} as SiteService,
    mockSession as unknown as SessionService,
    {} as ConversationService,
    {} as RateLimitService,
    {} as RagService,
  );

const connect = (
  origin: string | undefined,
  sessionToken = 'valid-token',
  verifyReturn: unknown = VALID_PAYLOAD,
) => {
  mockSession.verify.mockReturnValue(verifyReturn);
  const gateway = buildGateway();
  const client = {
    handshake: { auth: { sessionToken }, headers: { origin } },
    disconnect: vi.fn(),
    data: {},
  } as unknown as Socket;
  gateway.handleConnection(client);
  return client;
};

describe('WidgetGateway.handleConnection', () => {
  beforeEach(() => vi.clearAllMocks());

  it('accepts a valid token with matching origin', () => {
    expect(connect('https://acme.com').disconnect).not.toHaveBeenCalled();
  });

  it('attaches the session payload to socket.data', () => {
    const client = connect('https://acme.com');
    expect((client.data as Record<string, unknown>)['session']).toEqual(
      VALID_PAYLOAD,
    );
  });

  it('turns away a request with no sessionToken', () => {
    const gateway = buildGateway();
    const client = {
      handshake: { auth: {}, headers: { origin: 'https://acme.com' } },
      disconnect: vi.fn(),
      data: {},
    } as unknown as Socket;
    gateway.handleConnection(client);
    expect(client.disconnect).toHaveBeenCalledWith(true);
  });

  it('turns away an invalid / expired token', () => {
    expect(connect('https://acme.com', 'bad', null).disconnect).toHaveBeenCalledWith(true);
  });

  it('turns away a request with no Origin header', () => {
    expect(connect(undefined).disconnect).toHaveBeenCalledWith(true);
  });

  it('turns away when Origin does not match the token payload', () => {
    expect(connect('https://evil.com').disconnect).toHaveBeenCalledWith(true);
  });
});
