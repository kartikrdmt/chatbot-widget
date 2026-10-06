import type { WidgetChatError, WidgetMessage, WidgetMessageDelta } from '@/lib/contracts/widget';

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

export interface ChatTransport {
  connect(): void;
  disconnect(): void;
  loadHistory(): Promise<WidgetMessage[]>;
  sendMessage(text: string, clientMessageId: string): void;
  onMessage(callback: (message: WidgetMessage) => void): () => void;
  onDelta(callback: (delta: WidgetMessageDelta) => void): () => void;
  onTyping(callback: (typing: boolean) => void): () => void;
  onStatus(callback: (status: ConnectionStatus) => void): () => void;
  onError(callback: (error: WidgetChatError) => void): () => void;
}

export class Emitter<T> {
  private readonly listeners = new Set<(value: T) => void>();

  subscribe(callback: (value: T) => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  emit(value: T): void {
    this.listeners.forEach((listener) => listener(value));
  }
}
