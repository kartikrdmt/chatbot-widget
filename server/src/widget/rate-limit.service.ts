import { Injectable } from '@nestjs/common';

import { RATE_LIMIT_WINDOW_MS } from './widget.constants.js';

export interface RateLimitScope {
  key: string;
  perMinute: number;
  perDay?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfter?: number;
  quotaExceeded?: boolean;
}

interface WindowEntry {
  timestamps: number[];
  dailyCount: number;
  dailyReset: number;
}

const DAY_MS = 24 * 60 * 60_000;

// Async on purpose: this is the seam for Redis. Move `windows` into Redis and no caller changes.
@Injectable()
export class RateLimitService {
  private readonly windows = new Map<string, WindowEntry>();

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
