import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { SessionPayloadSchema, type SessionPayload } from '@myra/contracts';

export interface SessionResult {
  token: string;
  expiresAt: string;
}

@Injectable()
export class SessionService {
  constructor(private readonly jwt: JwtService) {}

  /** Sign a new 15-minute session JWT and return the token + expiry timestamp. */
  create(payload: SessionPayload): SessionResult {
    const token = this.jwt.sign(payload);
    // Decode to read the actual exp from the signed token rather than calculating it.
    const decoded = this.jwt.decode<{ exp: number }>(token);
    const expiresAt = new Date((decoded.exp ?? 0) * 1000).toISOString();
    return { token, expiresAt };
  }

  /** When the token expires, in ms since the epoch, or null if it cannot be read. */
  expiresAtMs(token: string): number | null {
    try {
      const decoded = this.jwt.decode<{ exp?: number }>(token);
      return decoded?.exp ? decoded.exp * 1000 : null;
    } catch {
      return null;
    }
  }

  /** Verify a token and return its payload, or null if invalid/expired. */
  verify(token: string): SessionPayload | null {
    try {
      const decoded = this.jwt.verify<
        SessionPayload & { iat: number; exp: number }
      >(token);
      return SessionPayloadSchema.parse(decoded);
    } catch {
      return null;
    }
  }
}
