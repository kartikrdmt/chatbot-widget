'use client';

import type { WidgetAppearance, WidgetConfig } from '@/lib/contracts/widget';

import { useChat } from '@/hooks/use-chat';
import { themeToStyle } from '@/lib/widget-appearance';

import { ChatHeader } from './chat-header';
import { ChatInput } from './chat-input';
import { ChatMessageList } from './chat-message-list';

interface ChatWindowProps {
  config: WidgetConfig;
  appearance?: WidgetAppearance;
  expanded?: boolean;
  onClose?: () => void;
  onToggleExpand?: () => void;
}

export function ChatWindow({
  config,
  appearance,
  expanded = false,
  onClose,
  onToggleExpand,
}: ChatWindowProps): React.ReactElement {
  const greeting = appearance?.greeting ?? config.greeting;
  const { messages, typing, status, sendMessage } = useChat(config.key, greeting);

  return (
    <div
      style={themeToStyle(appearance?.theme)}
      className="bg-chat-surface text-chat-foreground flex h-full w-full flex-col overflow-hidden"
    >
      <ChatHeader
        title={appearance?.title ?? config.title}
        subtitle={appearance?.subtitle ?? config.subtitle}
        expanded={expanded}
        onClose={onClose}
        onToggleExpand={onToggleExpand}
      />
      <ChatMessageList messages={messages} typing={typing} avatarText={appearance?.avatarText} />
      <ChatInput
        disabled={status !== 'connected'}
        placeholder={appearance?.placeholder}
        onSend={sendMessage}
      />
    </div>
  );
}
