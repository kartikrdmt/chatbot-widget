'use client';

import type { WidgetConfig, WidgetPosition } from '@/lib/contracts/widget';
import { ChevronDown, MessageSquare } from 'lucide-react';
import { useEffect, useState } from 'react';

import { cn } from '@/lib/utils';

import { ChatWindow } from './chat-window';

const LAUNCHER_POSITION: Record<WidgetPosition, string> = {
  'bottom-right': 'bottom-6 right-4 sm:right-6',
  'bottom-left': 'bottom-6 left-4 sm:left-6',
  'top-right': 'top-6 right-4 sm:right-6',
  'top-left': 'top-6 left-4 sm:left-6',
};

const PANEL_COMPACT: Record<WidgetPosition, string> = {
  'bottom-right': 'bottom-24 right-4 sm:right-6',
  'bottom-left': 'bottom-24 left-4 sm:left-6',
  'top-right': 'top-24 right-4 sm:right-6',
  'top-left': 'top-24 left-4 sm:left-6',
};

const PANEL_EXPANDED: Record<WidgetPosition, string> = {
  'bottom-right': 'bottom-0 right-0',
  'bottom-left': 'bottom-0 left-0',
  'top-right': 'top-0 right-0',
  'top-left': 'top-0 left-0',
};

const OPEN_STORAGE_KEY = 'myra.widget.open';

const SIZE_COMPACT =
  'h-[min(600px,calc(100dvh-8rem))] w-[min(380px,calc(100vw-2rem))] rounded-2xl border';

const SIZE_EXPANDED = 'h-dvh w-screen rounded-none border-0';

export function ChatWidget({ config }: { config: WidgetConfig }): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(OPEN_STORAGE_KEY) === '1') {
        // Restoring from storage can only happen after hydration, so it has to be an effect.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setOpen(true);
        setHasOpened(true);
      }
    } catch {
      // Storage can be blocked; start closed.
    }
  }, []);

  const rememberOpen = (value: boolean): void => {
    try {
      sessionStorage.setItem(OPEN_STORAGE_KEY, value ? '1' : '0');
    } catch {
      // Storage can be blocked; the chat just won't reopen after a refresh.
    }
  };

  const closeChat = (): void => {
    setOpen(false);
    setExpanded(false);
    rememberOpen(false);
  };

  const toggleOpen = (): void => {
    if (open) {
      closeChat();
      return;
    }
    setOpen(true);
    setHasOpened(true);
    rememberOpen(true);
  };

  const LauncherIcon = open ? ChevronDown : MessageSquare;

  return (
    <>
      <div
        className={cn(
          'border-chat-border fixed z-50 overflow-hidden shadow-2xl shadow-black/30 transition-all duration-300 ease-in-out',
          expanded
            ? [PANEL_EXPANDED[config.position], SIZE_EXPANDED]
            : [PANEL_COMPACT[config.position], SIZE_COMPACT],
          open ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0',
        )}
      >
        {hasOpened ? (
          <ChatWindow
            config={config}
            expanded={expanded}
            onClose={closeChat}
            onToggleExpand={() => setExpanded((previous) => !previous)}
          />
        ) : null}
      </div>

      <button
        type="button"
        onClick={toggleOpen}
        aria-label={open ? 'Close chat' : 'Open chat'}
        className={cn(
          'bg-chat-accent text-chat-accent-foreground fixed z-50 flex size-14 cursor-pointer items-center justify-center rounded-full shadow-lg shadow-black/30 transition-transform hover:scale-105',
          LAUNCHER_POSITION[config.position],
          expanded && 'hidden',
        )}
      >
        <LauncherIcon className="size-6" aria-hidden />
      </button>
    </>
  );
}
