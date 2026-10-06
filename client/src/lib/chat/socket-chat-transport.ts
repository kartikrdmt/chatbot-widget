import {
  WIDGET_EVENTS,
  WIDGET_SOCKET_NAMESPACE,
  type WidgetHistoryItem,
  type WidgetMessage,
  WidgetMessageSchema,
  type WidgetVisitorMessage,
} from '@/lib/contracts/widget';
import { io, type Socket } from 'socket.io-client';

import { API_URL } from '@/lib/api';

import { type ChatTransport, type ConnectionStatus, Emitter } from './chat-transport';
import { getVisitorId } from './visitor-id';

export class SocketChatTransport implements ChatTransport {
  private readonly socket: Socket;
  private readonly messages = new Emitter<WidgetMessage>();
  private readonly typing = new Emitter<boolean>();
  private readonly status = new Emitter<ConnectionStatus>();

  constructor(widgetKey: string) {
    this.socket = io(`${API_URL}${WIDGET_SOCKET_NAMESPACE}`, {
      autoConnect: false,
      transports: ['websocket'],
      auth: { key: widgetKey, visitorId: getVisitorId() },
    });

    this.socket.on('connect', () => this.status.emit('connected'));
    this.socket.on('disconnect', () => this.status.emit('disconnected'));
    this.socket.on('connect_error', () => this.status.emit('disconnected'));
    this.socket.on(WIDGET_EVENTS.message, (payload: unknown) => {
      const parsed = WidgetMessageSchema.safeParse(payload);
      if (parsed.success) this.messages.emit(parsed.data);
    });
    this.socket.on(WIDGET_EVENTS.typing, (typing: boolean) => this.typing.emit(typing));
  }

  connect(): void {
    this.status.emit('connecting');
    this.socket.connect();
  }

  disconnect(): void {
    this.socket.disconnect();
  }

  sendMessage(text: string, history: WidgetHistoryItem[]): void {
    const payload: WidgetVisitorMessage = { text, history };
    this.socket.emit(WIDGET_EVENTS.visitorMessage, payload);
  }

  onMessage(callback: (message: WidgetMessage) => void): () => void {
    return this.messages.subscribe(callback);
  }

  onTyping(callback: (typing: boolean) => void): () => void {
    return this.typing.subscribe(callback);
  }

  onStatus(callback: (status: ConnectionStatus) => void): () => void {
    return this.status.subscribe(callback);
  }
}
