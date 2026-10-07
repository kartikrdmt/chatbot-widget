import type {
  WidgetChatError,
  WidgetMessage,
  WidgetMessageDelta,
  WidgetMessageSender,
} from '@myra/contracts';

import { type ChatTransport, type ConnectionStatus, Emitter } from './chat-transport';

const STATIC_REPLIES: readonly [string, ...string[]] = [
  'Thanks for your message. Let me look into that for you.',
  'Good question! Here is a **quick summary**:\n\n- Point one\n- Point two\n- Point three',
  'I have noted that down. Is there anything else you need?',
  'You can find more details in our [documentation](https://example.com).',
];

const buildMessage = (sender: WidgetMessageSender, text: string): WidgetMessage => ({
  id: crypto.randomUUID(),
  sender,
  text,
  createdAt: new Date().toISOString(),
});

export class MockChatTransport implements ChatTransport {
  private readonly messages = new Emitter<WidgetMessage>();
  private readonly deltas = new Emitter<WidgetMessageDelta>();
  private readonly typing = new Emitter<boolean>();
  private readonly status = new Emitter<ConnectionStatus>();
  private readonly errors = new Emitter<WidgetChatError>();
  private timers: ReturnType<typeof setTimeout>[] = [];
  private replyIndex = 0;

  connect(): void {
    this.status.emit('connecting');
    this.timers.push(
      setTimeout(() => {
        this.status.emit('connected');
      }, 500),
    );
  }

  disconnect(): void {
    this.timers.forEach(clearTimeout);
    this.timers = [];
    this.status.emit('disconnected');
  }

  setSessionToken(): void {}

  loadHistory(): Promise<WidgetMessage[]> {
    return Promise.resolve([]);
  }

  sendMessage(): void {
    this.typing.emit(true);
    this.timers.push(
      setTimeout(() => {
        this.typing.emit(false);
        const reply = STATIC_REPLIES[this.replyIndex % STATIC_REPLIES.length] ?? STATIC_REPLIES[0];
        this.replyIndex += 1;
        this.messages.emit(buildMessage('assistant', reply));
      }, 1200),
    );
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
