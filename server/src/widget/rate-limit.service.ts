import { Injectable } from '@nestjs/common';

import {
  RATE_LIMIT_DEFAULT_MAX,
  RATE_LIMIT_WINDOW_MS,
} from './widget.constants.js';

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds until the oldest in-window message ages out (rate_limited case). */
  retryAfter?: number;
  /** True when the daily quota — not just the per-minute limit — is exhausted. */
  quotaExceeded?: boolean;
}

interface WindowEntry {
  /** Unix timestamps of messages within the current sliding window. */
  timestamps: number[];
  dailyCount: number;
  /** Unix ms when the daily counter resets. */
  dailyReset: number;
}

/**
 * In-memory sliding-window rate limiter.
 *
 * Redis-ready: swap the Map for an ioredis ZADD/ZREMRANGEBYSCORE pair to make
 * this work across multiple server instances without changing the callsites.
 */
@Injectable()
export class RateLimitService {
  private readonly windows = new Map<string, WindowEntry>();

  check(
    visitorId: string,
    perMinute = RATE_LIMIT_DEFAULT_MAX,
    perDay?: number,
  ): RateLimitResult {
    const now = Date.now();
    let entry = this.windows.get(visitorId);
    if (!entry) {
      entry = {
        timestamps: [],
        dailyCount: 0,
        dailyReset: now + 24 * 60 * 60_000,
      };
      this.windows.set(visitorId, entry);
    }

    if (now > entry.dailyReset) {
      entry.dailyCount = 0;
      entry.dailyReset = now + 24 * 60 * 60_000;
    }

    if (perDay !== undefined && entry.dailyCount >= perDay) {
      return { allowed: false, quotaExceeded: true };
    }

    const windowStart = now - RATE_LIMIT_WINDOW_MS;
    entry.timestamps = entry.timestamps.filter((ts) => ts > windowStart);

    if (entry.timestamps.length >= perMinute) {
      const oldest = entry.timestamps[0] ?? now;
      const retryAfter = Math.ceil(
        (oldest + RATE_LIMIT_WINDOW_MS - now) / 1000,
      );
      return { allowed: false, retryAfter };
    }

    entry.timestamps.push(now);
    entry.dailyCount++;
    return { allowed: true };
  }
}
