'use client';

import type { WidgetAppearance, WidgetConfig } from '@myra/contracts';

import { useChat } from '@/hooks/use-chat';

import { ChatHeader } from './chat-header';
import { ChatInput } from './chat-input';
import { ChatMessageList } from './chat-message-list';

interface ChatWindowProps {
  config: WidgetConfig;
  sessionToken: string;
  apiUrl: string;
  appearance?: WidgetAppearance;
  expanded?: boolean;
  onClose?: () => void;
  onToggleExpand?: () => void;
  onSessionExpired: () => void;
  onDisabled: () => void;
}

export function ChatWindow({
  config,
  sessionToken,
  apiUrl,
  appearance,
  expanded = false,
  onClose,
  onToggleExpand,
  onSessionExpired,
  onDisabled,
}: ChatWindowProps): React.ReactElement {
  const copy = config.copy;
  const greeting = appearance?.greeting ?? copy.greeting;
  const title = appearance?.title ?? copy.title;
  const subtitle = appearance?.subtitle ?? copy.subtitle;
  const placeholder = appearance?.placeholder ?? copy.placeholder;
  const avatarText = appearance?.avatarText ?? copy.avatarText ?? copy.title[0];

  const { messages, typing, status, chatError, sendMessage } = useChat({
    sessionToken,
    apiUrl,
    greeting,
    features: config.features,
    offlineMessage: copy.offlineMessage,
    onSessionExpired,
    onDisabled,
  });

  const inputDisabled =
    status !== 'connected' ||
    chatError?.code === 'quota_exceeded' ||
    chatError?.code === 'rate_limited' ||
    chatError?.code === 'offline';

  return (
    <div className="bg-chat-surface text-chat-foreground flex h-full w-full flex-col overflow-hidden">
      <ChatHeader
        title={title}
        subtitle={subtitle}
        expanded={expanded}
        onClose={onClose}
        onToggleExpand={onToggleExpand}
      />
      <ChatMessageList
        messages={messages}
        typing={typing}
        avatarText={avatarText}
        showSources={config.features.showSources}
      />
      {chatError ? (
        <div className="bg-chat-raised border-chat-border border-t px-4 py-2.5 text-center text-xs text-chat-muted">
          {chatError.message}
        </div>
      ) : status === 'disconnected' ? (
        <div className="bg-chat-raised border-chat-border border-t px-4 py-2.5 text-center text-xs text-chat-muted">
          Reconnecting…
        </div>
      ) : null}
      <ChatInput disabled={inputDisabled} placeholder={placeholder} onSend={sendMessage} />
    </div>
  );
}
