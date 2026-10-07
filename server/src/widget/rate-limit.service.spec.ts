import { RateLimitService } from './rate-limit.service.js';

describe('RateLimitService', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('allows up to the limit, then says how long to wait', async () => {
    const limiter = new RateLimitService();
    const scope = [{ key: 'visitor:a', perMinute: 2 }];
    expect((await limiter.checkAll(scope)).allowed).toBe(true);
    expect((await limiter.checkAll(scope)).allowed).toBe(true);

    const blocked = await limiter.checkAll(scope);
    expect(blocked).toMatchObject({ allowed: false });
    expect(blocked.retryAfter).toBeGreaterThan(0);

    vi.advanceTimersByTime(61_000);
    expect((await limiter.checkAll(scope)).allowed).toBe(true);
  });

  it('limits each key on its own', async () => {
    const limiter = new RateLimitService();
    await limiter.checkAll([{ key: 'visitor:a', perMinute: 1 }]);
    expect(
      (await limiter.checkAll([{ key: 'visitor:a', perMinute: 1 }])).allowed,
    ).toBe(false);
    expect(
      (await limiter.checkAll([{ key: 'visitor:b', perMinute: 1 }])).allowed,
    ).toBe(true);
  });

  it('turns a message away if ANY scope is full, and counts it against none', async () => {
    const limiter = new RateLimitService();
    const full = { key: 'ip:1.1.1.1', perMinute: 1 };
    await limiter.checkAll([full]);

    const blocked = await limiter.checkAll([
      { key: 'visitor:a', perMinute: 5 },
      full,
    ]);
    expect(blocked.allowed).toBe(false);

    for (let i = 0; i < 5; i++) {
      expect(
        (await limiter.checkAll([{ key: 'visitor:a', perMinute: 5 }])).allowed,
      ).toBe(true);
    }
    expect(
      (await limiter.checkAll([{ key: 'visitor:a', perMinute: 5 }])).allowed,
    ).toBe(false);
  });

  it('enforces a daily cap and reports it as a quota, not a rate limit', async () => {
    const limiter = new RateLimitService();
    const scope = [{ key: 'visitor:a', perMinute: 100, perDay: 2 }];
    await limiter.checkAll(scope);
    await limiter.checkAll(scope);
    expect(await limiter.checkAll(scope)).toEqual({
      allowed: false,
      quotaExceeded: true,
    });

    vi.advanceTimersByTime(25 * 60 * 60_000);
    expect((await limiter.checkAll(scope)).allowed).toBe(true);
  });
});
