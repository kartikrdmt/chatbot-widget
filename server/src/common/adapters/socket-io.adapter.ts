import type { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';

type CreateIOServer = IoAdapter['createIOServer'];
type IOServerOptions = Parameters<CreateIOServer>[1];

export type OriginCheck = (origin: string) => boolean;

/**
 * Applies the same origin rule the HTTP side uses to every socket.io gateway,
 * so origins are configured in one place. A request without an Origin header
 * (server-side callers) is let through; each gateway checks its own site list.
 */
export class SocketIoAdapter extends IoAdapter {
  constructor(
    app: INestApplicationContext,
    private readonly isOriginAllowed: OriginCheck,
  ) {
    super(app);
  }

  override createIOServer(
    port: number,
    options?: IOServerOptions,
  ): ReturnType<CreateIOServer> {
    const cors = {
      origin: (
        origin: string | undefined,
        callback: (error: Error | null, allow?: boolean) => void,
      ) => callback(null, !origin || this.isOriginAllowed(origin)),
    };
    return super.createIOServer(port, { ...options, cors } as IOServerOptions);
  }
}
