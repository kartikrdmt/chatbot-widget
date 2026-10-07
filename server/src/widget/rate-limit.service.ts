import { Injectable } from '@nestjs/common';

import { RATE_LIMIT_WINDOW_MS } from './widget.constants.js';

/** One thing to limit: a visitor, an IP address or a whole site. */
export interface RateLimitScope {
  /** Unique across kinds, such as `visitor:v_ab12` or `ip:203.0.113.7`. */
  key: string;
  perMinute: number;
  /** Optional daily cap for this scope. */
  perDay?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds until the oldest in-window message ages out (rate_limited case). */
  retryAfter?: number;
  /** True when a daily cap, not just the per-minute limit, is exhausted. */
  quotaExceeded?: boolean;
}

interface WindowEntry {
  /** Unix ms of the messages inside the current sliding window. */
  timestamps: number[];
  dailyCount: number;
  /** Unix ms when the daily counter resets. */
  dailyReset: number;
}

const DAY_MS = 24 * 60 * 60_000;

/**
 * Sliding-window rate limiter, in memory.
 *
 * Every method is `async` on purpose: this is the seam for Redis. To run several API servers, keep
 * the same two methods and move `windows` into Redis (a sorted set per key: ZADD, then
 * ZREMRANGEBYSCORE and ZCARD for the window). No caller changes.
 */
@Injectable()
export class RateLimitService {
  private readonly windows = new Map<string, WindowEntry>();

  /**
   * Checks every scope and, only if ALL of them have room, counts the message against each.
   * A message turned away by one scope is not counted against the others.
   */
  async checkAll(scopes: RateLimitScope[]): Promise<RateLimitResult> {
    const now = Date.now();
    const entries = scopes.map((scope) => ({
      scope,
      entry: this.entryFor(scope.key, now),
    }));

    for (const { scope, entry } of entries) {
      if (scope.perDay !== undefined && entry.dailyCount >= scope.perDay) {
        return { allowed: false, quotaExceeded: true };
      }
      if (entry.timestamps.length >= scope.perMinute) {
        const oldest = entry.timestamps[0] ?? now;
        return {
          allowed: false,
          retryAfter: Math.max(
            1,
            Math.ceil((oldest + RATE_LIMIT_WINDOW_MS - now) / 1000),
          ),
        };
      }
    }

    for (const { entry } of entries) {
      entry.timestamps.push(now);
      entry.dailyCount++;
    }
    return { allowed: true };
  }

  /** The entry for a key with expired timestamps dropped and the daily counter rolled over. */
  private entryFor(key: string, now: number): WindowEntry {
    let entry = this.windows.get(key);
    if (!entry) {
      entry = { timestamps: [], dailyCount: 0, dailyReset: now + DAY_MS };
      this.windows.set(key, entry);
    }
    if (now > entry.dailyReset) {
      entry.dailyCount = 0;
      entry.dailyReset = now + DAY_MS;
    }
    const windowStart = now - RATE_LIMIT_WINDOW_MS;
    entry.timestamps = entry.timestamps.filter((ts) => ts > windowStart);
    return entry;
  }
}
