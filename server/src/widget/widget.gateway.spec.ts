import type { Socket } from 'socket.io';

import { WidgetGateway } from './widget.gateway.js';
import type { WidgetService } from './widget.service.js';
import { WidgetSitesService } from './widget-sites.service.js';

const connect = (origin: string | undefined, key = 'acme') => {
  process.env.WIDGET_SITES = JSON.stringify([
    { key: 'acme', allowedOrigins: ['https://acme.com'] },
  ]);
  const gateway = new WidgetGateway(
    {} as WidgetService,
    new WidgetSitesService(),
  );
  const client = {
    handshake: { auth: { key, visitorId: 'v1' }, headers: { origin } },
    disconnect: vi.fn(),
  } as unknown as Socket;
  gateway.handleConnection(client);
  return client;
};

describe('WidgetGateway.handleConnection', () => {
  it('accepts a page on an allowed origin', () => {
    expect(connect('https://acme.com').disconnect).not.toHaveBeenCalled();
  });

  it('accepts a server-side caller that sends no Origin', () => {
    expect(connect(undefined).disconnect).not.toHaveBeenCalled();
  });

  it('turns away a page on another origin', () => {
    expect(connect('https://evil.com').disconnect).toHaveBeenCalledWith(true);
  });

  it('turns away an unknown key', () => {
    expect(connect('https://acme.com', 'nope').disconnect).toHaveBeenCalledWith(
      true,
    );
  });
});
