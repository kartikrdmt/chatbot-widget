'use client';

import type { WidgetMessage } from '@/lib/contracts/widget';
import { useEffect, useRef } from 'react';

import { cn } from '@/lib/utils';

import { ChatDayDivider } from './chat-day-divider';
import { ChatMessageBubble } from './chat-message-bubble';
import { ChatTypingIndicator } from './chat-typing-indicator';

interface ChatMessageListProps {
  messages: WidgetMessage[];
  typing: boolean;
  avatarText?: string;
}

export function ChatMessageList({
  messages,
  typing,
  avatarText,
}: ChatMessageListProps): React.ReactElement {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  const firstMessage = messages[0];
  const lastMessage = messages.at(-1);

  return (
    <div className="bg-chat-raised flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-5 [scrollbar-color:var(--chat-border)_transparent] [scrollbar-width:thin]">
      {firstMessage ? <ChatDayDivider iso={firstMessage.createdAt} /> : null}
      {messages.map((message, index) => {
        const previous = messages[index - 1];
        const next = messages[index + 1];
        const startsRun = previous?.sender !== message.sender;
        const endsRun = next?.sender !== message.sender;

        return (
          <div key={message.id} className={cn(startsRun && index > 0 && 'mt-3')}>
            <ChatMessageBubble
              message={message}
              showAvatar={startsRun}
              showTime={endsRun}
              avatarText={avatarText}
            />
          </div>
        );
      })}
      {typing ? (
        <div className={cn(lastMessage && lastMessage.sender !== 'visitor' ? '' : 'mt-3')}>
          <ChatTypingIndicator
            showAvatar={lastMessage?.sender === 'visitor' || !lastMessage}
            avatarText={avatarText}
          />
        </div>
      ) : null}
      <div ref={bottomRef} />
    </div>
  );
}
