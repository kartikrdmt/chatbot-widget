import type { WidgetMessage } from '@myra/contracts';
import ReactMarkdown, { type Components } from 'react-markdown';

import { cn } from '@/lib/utils';

import { ChatBrandMark } from './chat-brand-mark';
import { ChatTypingIndicator } from './chat-typing-indicator';

const MARKDOWN_STYLES =
  'break-words [&_a]:underline [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-1 [&_ul]:list-disc [&_ul]:pl-5 [&>p:first-child]:mt-0 [&>p:last-child]:mb-0';

const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);

const safeHref = (href: string | undefined): string | undefined => {
  if (!href) return undefined;
  try {
    const url = new URL(href);
    return SAFE_PROTOCOLS.has(url.protocol) ? href : undefined;
  } catch {
    return href.startsWith('/') || href.startsWith('#') || href.startsWith('.') ? href : undefined;
  }
};

const urlTransform = (url: string): string => safeHref(url) ?? '';

const MARKDOWN_COMPONENTS: Components = {
  a: ({ node, href, children, ...props }) => {
    void node;
    const safe = safeHref(href);
    if (!safe) return <>{children}</>;
    return (
      <a {...props} href={safe} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    );
  },
};

export const isWaitingForReply = (message: WidgetMessage): boolean =>
  message.sender !== 'visitor' && message.streaming === true && message.text === '';

const formatTime = (iso: string): string =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

interface ChatMessageBubbleProps {
  message: WidgetMessage;
  showAvatar: boolean;
  showTime: boolean;
  avatarText?: string;
  showSources?: boolean;
}

export function ChatMessageBubble({
  message,
  showAvatar,
  showTime,
  avatarText,
  showSources = true,
}: ChatMessageBubbleProps): React.ReactElement {
  if (message.sender === 'visitor') {
    return (
      <div className="flex flex-col items-end gap-1">
        <div className="bg-chat-accent text-chat-accent-foreground max-w-[80%] rounded-[var(--chat-radius-bubble)] rounded-br-[min(var(--chat-radius-bubble),0.375rem)] px-4 py-2.5 text-sm leading-relaxed">
          <div className={MARKDOWN_STYLES}>
            <ReactMarkdown components={MARKDOWN_COMPONENTS} urlTransform={urlTransform}>
              {message.text}
            </ReactMarkdown>
          </div>
        </div>
        {showTime ? (
          <span className="text-chat-dim px-1 text-[11px]">{formatTime(message.createdAt)}</span>
        ) : null}
      </div>
    );
  }

  if (isWaitingForReply(message)) {
    return <ChatTypingIndicator showAvatar={showAvatar} avatarText={avatarText} />;
  }

  return (
    <div className="flex items-start gap-2">
      <div className="w-7 shrink-0">{showAvatar ? <ChatBrandMark text={avatarText} /> : null}</div>
      <div className="flex min-w-0 max-w-[85%] flex-col items-start gap-1">
        <div
          className={cn(
            'bg-chat-surface border-chat-border text-chat-foreground rounded-[var(--chat-radius-bubble)] border px-4 py-2.5 text-sm leading-relaxed shadow-sm',
            showAvatar && 'rounded-tl-[min(var(--chat-radius-bubble),0.375rem)]',
          )}
        >
          <div className={MARKDOWN_STYLES}>
            <ReactMarkdown components={MARKDOWN_COMPONENTS} urlTransform={urlTransform}>
              {message.text}
            </ReactMarkdown>
          </div>
          {showSources && message.sources && message.sources.length > 0 ? (
            <div className="border-chat-border mt-2 flex flex-wrap gap-1.5 border-t pt-2">
              {message.sources.map((source) => (
                <a
                  key={source.url}
                  href={safeHref(source.url) ?? '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-chat-accent border-chat-border rounded-full border px-2.5 py-0.5 text-[11px] font-medium hover:underline"
                >
                  {source.title}
                </a>
              ))}
            </div>
          ) : null}
        </div>
        {showTime ? (
          <span className="text-chat-dim px-1 text-[11px]">{formatTime(message.createdAt)}</span>
        ) : null}
      </div>
    </div>
  );
}
