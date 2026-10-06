import type { ChatTransport } from './chat-transport';
import { MockChatTransport } from './mock-chat-transport';
import { SocketChatTransport } from './socket-chat-transport';

export function createChatTransport(widgetKey: string): ChatTransport {
  return process.env.NEXT_PUBLIC_CHAT_TRANSPORT === 'socket'
    ? new SocketChatTransport(widgetKey)
    : new MockChatTransport();
}
