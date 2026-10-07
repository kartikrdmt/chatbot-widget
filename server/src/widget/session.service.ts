import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { SessionPayloadSchema, type SessionPayload } from '@myra/contracts';

export interface SessionResult {
  token: string;
  expiresAt: string;
  /** Seconds the token lives from now, so the widget needs no clock of its own to renew it. */
  expiresIn: number;
}

@Injectable()
export class SessionService {
  constructor(private readonly jwt: JwtService) {}

  create(payload: SessionPayload): SessionResult {
    const token = this.jwt.sign(payload);
    const decoded = this.jwt.decode<{ exp: number; iat: number }>(token);
    const expiresAt = new Date((decoded.exp ?? 0) * 1000).toISOString();
    return {
      token,
      expiresAt,
      expiresIn: Math.max(1, (decoded.exp ?? 0) - (decoded.iat ?? 0)),
    };
  }

  expiresAtMs(token: string): number | null {
    try {
      const decoded = this.jwt.decode<{ exp?: number }>(token);
      return decoded?.exp ? decoded.exp * 1000 : null;
    } catch {
      return null;
    }
  }

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
