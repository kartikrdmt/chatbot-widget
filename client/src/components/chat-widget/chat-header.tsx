import { Maximize2, Minimize2, X } from 'lucide-react';

interface ChatHeaderProps {
  title: string;
  subtitle?: string;
  expanded: boolean;
  onClose?: () => void;
  onToggleExpand?: () => void;
}

export function ChatHeader({
  title,
  subtitle,
  expanded,
  onClose,
  onToggleExpand,
}: ChatHeaderProps): React.ReactElement {
  const ExpandIcon = expanded ? Minimize2 : Maximize2;

  return (
    <div className="bg-chat-accent text-chat-accent-foreground flex items-center justify-between gap-3 px-5 py-4">
      <div className="min-w-0">
        <div className="truncate text-xl font-semibold">{title}</div>
        {subtitle ? <div className="truncate text-sm opacity-80">{subtitle}</div> : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {onToggleExpand ? (
          <button
            type="button"
            onClick={onToggleExpand}
            aria-label={expanded ? 'Collapse chat' : 'Expand chat'}
            className="flex size-9 cursor-pointer items-center justify-center rounded-[var(--chat-radius-control)] opacity-80 hover:bg-chat-accent-foreground/10"
          >
            <ExpandIcon className="size-4" aria-hidden />
          </button>
        ) : null}
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close chat"
            className="flex size-9 cursor-pointer items-center justify-center rounded-[var(--chat-radius-control)] bg-chat-accent-foreground/15 hover:bg-chat-accent-foreground/25"
          >
            <X className="size-4" aria-hidden />
          </button>
        ) : null}
      </div>
    </div>
  );
}
