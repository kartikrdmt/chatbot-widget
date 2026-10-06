import type { WidgetMessage } from '@/lib/contracts/widget';
import ReactMarkdown, { type Components } from 'react-markdown';

import { cn } from '@/lib/utils';

import { ChatBrandMark } from './chat-brand-mark';

const MARKDOWN_STYLES =
  'break-words [&_a]:underline [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-1 [&_ul]:list-disc [&_ul]:pl-5 [&>p:first-child]:mt-0 [&>p:last-child]:mb-0';

// The chat runs in an iframe, so links must open a new tab instead of loading inside it.
const MARKDOWN_COMPONENTS: Components = {
  a: ({ node, ...props }) => {
    void node;
    return <a {...props} target="_blank" rel="noopener noreferrer" />;
  },
};

const formatTime = (iso: string): string =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

interface ChatMessageBubbleProps {
  message: WidgetMessage;
  showAvatar: boolean;
  showTime: boolean;
  avatarText?: string;
}

export function ChatMessageBubble({
  message,
  showAvatar,
  showTime,
  avatarText,
}: ChatMessageBubbleProps): React.ReactElement {
  if (message.sender === 'visitor') {
    return (
      <div className="flex flex-col items-end gap-1">
        <div className="bg-chat-accent text-chat-accent-foreground max-w-[80%] rounded-2xl rounded-br-md px-4 py-2.5 text-sm leading-relaxed">
          <div className={MARKDOWN_STYLES}>
            <ReactMarkdown components={MARKDOWN_COMPONENTS}>{message.text}</ReactMarkdown>
          </div>
        </div>
        {showTime ? (
          <span className="text-chat-dim px-1 text-[11px]">{formatTime(message.createdAt)}</span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2">
      <div className="w-7 shrink-0">{showAvatar ? <ChatBrandMark text={avatarText} /> : null}</div>
      <div className="flex min-w-0 max-w-[85%] flex-col items-start gap-1">
        <div
          className={cn(
            'bg-chat-surface border-chat-border text-chat-foreground rounded-2xl border px-4 py-2.5 text-sm leading-relaxed shadow-sm',
            showAvatar && 'rounded-tl-md',
          )}
        >
          <div className={MARKDOWN_STYLES}>
            <ReactMarkdown components={MARKDOWN_COMPONENTS}>{message.text}</ReactMarkdown>
          </div>
        </div>
        {showTime ? (
          <span className="text-chat-dim px-1 text-[11px]">{formatTime(message.createdAt)}</span>
        ) : null}
      </div>
    </div>
  );
}
