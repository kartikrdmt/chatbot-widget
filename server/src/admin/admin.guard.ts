import { timingSafeEqual } from 'node:crypto';

import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

import type { AppConfig } from '../config/configuration.js';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly config: ConfigService<AppConfig, true>) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.config.get('admin', { infer: true }).apiKey;
    if (!expected) {
      throw new ForbiddenException(
        'The admin API is disabled: set ADMIN_API_KEY to turn it on.',
      );
    }

    const raw = context.switchToHttp().getRequest<Request>().headers[
      'x-admin-key'
    ];
    const provided = Array.isArray(raw) ? raw[0] : raw;
    if (!provided || !safeEqual(provided, expected)) {
      throw new UnauthorizedException('Missing or wrong x-admin-key.');
    }
    return true;
  }
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
