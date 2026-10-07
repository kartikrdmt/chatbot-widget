const RENEW_BEFORE_MS = 60_000;
const MIN_DELAY_MS = 5_000;
const RETRY_FIRST_MS = 5_000;
const RETRY_MAX_MS = 300_000;

/** How long to wait before renewing a session that lives `lifetimeSeconds`. */
export function renewalDelay(lifetimeSeconds: number): number {
  return Math.max(MIN_DELAY_MS, lifetimeSeconds * 1000 - RENEW_BEFORE_MS);
}

/** Wait before retry number `failures` (1 = the first retry): doubles each time, up to 5 minutes. */
export function retryDelay(failures: number): number {
  return Math.min(RETRY_MAX_MS, RETRY_FIRST_MS * 2 ** Math.max(0, failures - 1));
}

/**
 * Whether a session received at `receivedAt` is due for renewal. Measured as time elapsed on this
 * device, so a wrong clock cannot make the widget renew in a loop or never.
 */
export function isRenewalDue(receivedAt: number, lifetimeSeconds: number, now: number): boolean {
  return now - receivedAt >= lifetimeSeconds * 1000 - RENEW_BEFORE_MS;
}

/** The session's lifetime: the server's own figure, else worked out once from `expiresAt`. */
export function lifetimeOf(
  session: { expiresIn?: unknown; expiresAt?: unknown },
  receivedAt: number,
): number {
  if (typeof session.expiresIn === 'number' && session.expiresIn > 0) return session.expiresIn;
  const expires = typeof session.expiresAt === 'string' ? Date.parse(session.expiresAt) : NaN;
  return Number.isFinite(expires) ? Math.max(1, Math.round((expires - receivedAt) / 1000)) : 900;
}
