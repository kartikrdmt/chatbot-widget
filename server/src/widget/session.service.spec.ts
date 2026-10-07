import { JwtService } from '@nestjs/jwt';

import { SessionService } from './session.service.js';

const payload = {
  tenantId: 't1',
  siteId: 's1',
  visitorId: 'v1',
  origin: 'https://acme.com',
};

describe('SessionService', () => {
  const jwt = new JwtService({
    secret: 'test-secret',
    signOptions: { expiresIn: '15m' },
  });
  const sessions = new SessionService(jwt);

  it('tells the widget how long the session lives, so it needs no clock of its own', () => {
    const session = sessions.create(payload);
    expect(session.expiresIn).toBe(900);
    expect(new Date(session.expiresAt).getTime()).toBeGreaterThan(
      Date.now() + 890_000,
    );
  });

  it('verifies what it signed and nothing else', () => {
    const { token } = sessions.create(payload);
    expect(sessions.verify(token)).toEqual(payload);
    expect(sessions.verify(`${token}x`)).toBeNull();
    expect(sessions.verify('garbage')).toBeNull();
  });

  it('reads when a token expires', () => {
    const { token, expiresAt } = sessions.create(payload);
    expect(sessions.expiresAtMs(token)).toBe(new Date(expiresAt).getTime());
    expect(sessions.expiresAtMs('garbage')).toBeNull();
  });
});
