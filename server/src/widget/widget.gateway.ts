import {
  ConnectedSocket,
  MessageBody,
  type OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import {
  WIDGET_EVENTS,
  WIDGET_SOCKET_NAMESPACE,
  WidgetSocketAuthSchema,
  WidgetVisitorMessageSchema,
} from './widget.contracts.js';
import type { Socket } from 'socket.io';

import { WidgetService } from './widget.service.js';
import { WidgetSitesService } from './widget-sites.service.js';

@WebSocketGateway({ namespace: WIDGET_SOCKET_NAMESPACE })
export class WidgetGateway implements OnGatewayConnection {
  constructor(
    private readonly widget: WidgetService,
    private readonly sites: WidgetSitesService,
  ) {}

  handleConnection(client: Socket): void {
    const auth = WidgetSocketAuthSchema.safeParse(client.handshake.auth);
    if (!auth.success || !this.sites.find(auth.data.key)) {
      client.disconnect(true);
      return;
    }
  }

  @SubscribeMessage(WIDGET_EVENTS.visitorMessage)
  async onVisitorMessage(
    @MessageBody() body: unknown,
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    const parsed = WidgetVisitorMessageSchema.safeParse(body);
    if (!parsed.success) return;

    client.emit(WIDGET_EVENTS.typing, true);
    try {
      const reply = await this.widget.reply(
        parsed.data.text,
        parsed.data.history,
      );
      client.emit(WIDGET_EVENTS.message, reply);
    } finally {
      client.emit(WIDGET_EVENTS.typing, false);
    }
  }
}
