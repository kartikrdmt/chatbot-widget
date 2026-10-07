import {
  WIDGET_EVENTS,
  WIDGET_SOCKET_NAMESPACE,
  type WidgetChatError,
  WidgetChatErrorSchema,
  type WidgetMessage,
  type WidgetMessageDelta,
  WidgetMessageDeltaSchema,
  WidgetMessageSchema,
} from '@myra/contracts';
import { io, type Socket } from 'socket.io-client';

import { type ChatTransport, type ConnectionStatus, Emitter } from './chat-transport';

/** If the server does not answer in time, the chat starts with its greeting instead of waiting. */
const HISTORY_TIMEOUT_MS = 10_000;
const REFRESH_TIMEOUT_MS = 5_000;

export class SocketChatTransport implements ChatTransport {
  private readonly socket: Socket;
  private readonly messages = new Emitter<WidgetMessage>();
  private readonly deltas = new Emitter<WidgetMessageDelta>();
  private readonly typing = new Emitter<boolean>();
  private readonly status = new Emitter<ConnectionStatus>();
  private readonly errors = new Emitter<WidgetChatError>();

  private sessionToken: string;

  constructor(sessionToken: string, apiUrl: string) {
    this.sessionToken = sessionToken;
    this.socket = io(`${apiUrl}${WIDGET_SOCKET_NAMESPACE}`, {
      autoConnect: false,
      // A function, so every (re)connect presents the newest token.
      auth: (callback) => callback({ sessionToken: this.sessionToken }),
    });

    this.socket.on('connect', () => this.status.emit('connected'));
    this.socket.on('disconnect', () => this.status.emit('disconnected'));
    this.socket.on('connect_error', () => this.status.emit('disconnected'));
    this.socket.on(WIDGET_EVENTS.message, (payload: unknown) => {
      const parsed = WidgetMessageSchema.safeParse(payload);
      if (parsed.success) this.messages.emit(parsed.data);
    });
    this.socket.on(WIDGET_EVENTS.messageDelta, (payload: unknown) => {
      const parsed = WidgetMessageDeltaSchema.safeParse(payload);
      if (parsed.success) this.deltas.emit(parsed.data);
    });
    this.socket.on(WIDGET_EVENTS.typing, (typing: boolean) => this.typing.emit(typing));
    this.socket.on(WIDGET_EVENTS.error, (payload: unknown) => {
      const parsed = WidgetChatErrorSchema.safeParse(payload);
      if (parsed.success) this.errors.emit(parsed.data);
    });
  }

  connect(): void {
    this.status.emit('connecting');
    this.socket.connect();
  }

  disconnect(): void {
    this.socket.disconnect();
  }

  setSessionToken(sessionToken: string): void {
    this.sessionToken = sessionToken;
    if (!this.socket.connected) return;

    // Tell the live connection about its new session. If the server will not take it, reconnect so
    // the new token is presented instead.
    this.socket
      .timeout(REFRESH_TIMEOUT_MS)
      .emit(
        WIDGET_EVENTS.session,
        { sessionToken },
        (error: unknown, response?: { ok?: boolean }) => {
          if (error || !response?.ok) this.socket.disconnect().connect();
        },
      );
  }

  loadHistory(): Promise<WidgetMessage[]> {
    return new Promise((resolve) => {
      this.socket
        .timeout(HISTORY_TIMEOUT_MS)
        .emit(WIDGET_EVENTS.history, {}, (error: unknown, response: unknown) => {
          if (error) {
            resolve([]);
            return;
          }
          const list = Array.isArray(response)
            ? response
            : response && typeof response === 'object' && 'messages' in response
              ? (response as { messages: unknown }).messages
              : [];
          resolve(
            (Array.isArray(list) ? list : [])
              .map((m) => WidgetMessageSchema.safeParse(m))
              .filter((r) => r.success)
              .map((r) => (r as { success: true; data: WidgetMessage }).data),
          );
        });
    });
  }

  sendMessage(text: string, clientMessageId: string): void {
    this.socket.emit(WIDGET_EVENTS.visitorMessage, { text, clientMessageId });
  }

  onMessage(callback: (message: WidgetMessage) => void): () => void {
    return this.messages.subscribe(callback);
  }

  onDelta(callback: (delta: WidgetMessageDelta) => void): () => void {
    return this.deltas.subscribe(callback);
  }

  onTyping(callback: (typing: boolean) => void): () => void {
    return this.typing.subscribe(callback);
  }

  onStatus(callback: (status: ConnectionStatus) => void): () => void {
    return this.status.subscribe(callback);
  }

  onError(callback: (error: WidgetChatError) => void): () => void {
    return this.errors.subscribe(callback);
  }
}
