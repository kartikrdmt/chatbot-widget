import type { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';

type CreateIOServer = IoAdapter['createIOServer'];
type IOServerOptions = Parameters<CreateIOServer>[1];

/**
 * Applies the same `CORS_ORIGINS` allow-list the HTTP side uses to every
 * socket.io gateway, so origins are configured in one place.
 */
export class SocketIoAdapter extends IoAdapter {
  constructor(
    app: INestApplicationContext,
    private readonly corsOrigins: string[],
  ) {
    super(app);
  }

  override createIOServer(
    port: number,
    options?: IOServerOptions,
  ): ReturnType<CreateIOServer> {
    const cors = {
      origin: this.corsOrigins.includes('*') ? true : this.corsOrigins,
    };
    return super.createIOServer(port, { ...options, cors } as IOServerOptions);
  }
}
