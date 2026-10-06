import { ChatBrandMark } from './chat-brand-mark';

interface ChatTypingIndicatorProps {
  showAvatar: boolean;
  avatarText?: string;
}

export function ChatTypingIndicator({
  showAvatar,
  avatarText,
}: ChatTypingIndicatorProps): React.ReactElement {
  return (
    <div className="flex items-start gap-2">
      <div className="w-7 shrink-0">{showAvatar ? <ChatBrandMark text={avatarText} /> : null}</div>
      <div className="bg-chat-surface border-chat-border flex items-center gap-1 rounded-2xl border px-4 py-3.5 shadow-sm">
        <span className="bg-chat-dim size-1.5 animate-bounce rounded-full [animation-delay:-0.3s]" />
        <span className="bg-chat-dim size-1.5 animate-bounce rounded-full [animation-delay:-0.15s]" />
        <span className="bg-chat-dim size-1.5 animate-bounce rounded-full" />
      </div>
    </div>
  );
}
