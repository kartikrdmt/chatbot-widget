import type { WidgetMessage, WidgetMessageSender } from '@/lib/contracts/widget';

import { type ChatTransport, type ConnectionStatus, Emitter } from './chat-transport';

const STATIC_REPLIES: readonly [string, ...string[]] = [
  'Thanks for your message. Let me look into that for you.',
  'Good question! Here is a **quick summary**:\n\n- Point one\n- Point two\n- Point three',
  'I have noted that down. Is there anything else you need?',
  'You can find more details in our documentation.',
];

const buildMessage = (sender: WidgetMessageSender, text: string): WidgetMessage => ({
  id: crypto.randomUUID(),
  sender,
  text,
  createdAt: new Date().toISOString(),
});

export class MockChatTransport implements ChatTransport {
  private readonly messages = new Emitter<WidgetMessage>();
  private readonly typing = new Emitter<boolean>();
  private readonly status = new Emitter<ConnectionStatus>();
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

  onTyping(callback: (typing: boolean) => void): () => void {
    return this.typing.subscribe(callback);
  }

  onStatus(callback: (status: ConnectionStatus) => void): () => void {
    return this.status.subscribe(callback);
  }
}
