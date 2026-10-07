import { describe, expect, it } from 'vitest';

import { isRenewalDue, lifetimeOf, renewalDelay, retryDelay } from './renewal';

describe('renewalDelay', () => {
  it('renews a minute before a 15 minute session ends', () => {
    expect(renewalDelay(900)).toBe(840_000);
  });

  it('never renews more often than every 5 seconds, however short the session', () => {
    expect(renewalDelay(65)).toBe(5_000);
    expect(renewalDelay(10)).toBe(5_000);
    expect(renewalDelay(1)).toBe(5_000);
  });
});

describe('retryDelay', () => {
  it('keeps trying forever, backing off up to 5 minutes', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8].map(retryDelay)).toEqual([
      5_000, 10_000, 20_000, 40_000, 80_000, 160_000, 300_000, 300_000,
    ]);
    expect(retryDelay(500)).toBe(300_000);
  });
});

describe('isRenewalDue', () => {
  it('is based on time elapsed since receiving the session, not on any absolute clock', () => {
    expect(isRenewalDue(1_000_000, 900, 1_000_000 + 839_000)).toBe(false);
    expect(isRenewalDue(1_000_000, 900, 1_000_000 + 840_000)).toBe(true);
    expect(isRenewalDue(1_000_000, 900, 1_000_000 + 5_000_000)).toBe(true);
  });
});

describe('lifetimeOf', () => {
  it('trusts the server figure, which needs no clock at all', () => {
    expect(lifetimeOf({ expiresIn: 900, expiresAt: '1999-01-01T00:00:00Z' }, Date.now())).toBe(900);
  });

  it('a client clock that is wrong cannot change the renewal time', () => {
    const wrongClock = Date.parse('2030-01-01T00:00:00Z');
    expect(renewalDelay(lifetimeOf({ expiresIn: 900 }, wrongClock))).toBe(840_000);
  });

  it('falls back to expiresAt for an older server, and to 15 minutes if that is unreadable', () => {
    const now = Date.parse('2026-10-07T10:00:00Z');
    expect(lifetimeOf({ expiresAt: '2026-10-07T10:15:00Z' }, now)).toBe(900);
    expect(lifetimeOf({ expiresAt: 'soon' }, now)).toBe(900);
    expect(lifetimeOf({}, now)).toBe(900);
  });
});
