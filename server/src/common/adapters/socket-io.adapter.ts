import type { INestApplicationContext } from '@nestjs/common';
import { WIDGET_LIMITS } from '@myra/contracts';
import { IoAdapter } from '@nestjs/platform-socket.io';

type CreateIOServer = IoAdapter['createIOServer'];
type IOServerOptions = Parameters<CreateIOServer>[1];

export type OriginCheck = (origin: string) => boolean | Promise<boolean>;

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
      ) => {
        if (!origin) return callback(null, false);
        Promise.resolve(this.isOriginAllowed(origin)).then(
          (allowed) => callback(null, allowed),
          () => callback(null, false),
        );
      },
    };
    return super.createIOServer(port, {
      ...options,
      cors,
      maxHttpBufferSize: WIDGET_LIMITS.maxSocketBytes,
    } as IOServerOptions);
  }
}
