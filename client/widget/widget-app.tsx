import type { WidgetAppearance, WidgetConfig } from '@/lib/contracts/widget';
import { ChevronDown, MessageSquare } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { ChatWindow } from '@/components/chat-widget/chat-window';
import { themeToStyle } from '@/lib/widget-appearance';

import { floatingLayout, LAUNCHER_SIZE, type Position } from './layout';

export interface WidgetController {
  open: () => void;
  close: () => void;
}

interface WidgetAppProps {
  config: WidgetConfig;
  apiUrl: string;
  appearance: WidgetAppearance;
  /** Set when the chat sits inside the page instead of floating over it. */
  inline: boolean;
  position: Position;
  offset: number;
  width: string;
  height: string;
  onController: (controller: WidgetController) => void;
}

const EASE = 'cubic-bezier(0.4, 0, 0.2, 1)';
const PANEL_TRANSITION = [
  `opacity .2s ease`,
  `transform .2s ease`,
  ...['width', 'height', 'top', 'bottom', 'left', 'right', 'border-radius'].map(
    (property) => `${property} .4s ${EASE}`,
  ),
].join(', ');

const stateKey = (widgetKey: string): string => `myra.widget.open.${widgetKey}`;

function readOpen(widgetKey: string): boolean {
  try {
    return sessionStorage.getItem(stateKey(widgetKey)) === '1';
  } catch {
    return false;
  }
}

function saveOpen(widgetKey: string, open: boolean): void {
  try {
    sessionStorage.setItem(stateKey(widgetKey), open ? '1' : '0');
  } catch {
    // Storage can be blocked; the chat just won't reopen after a refresh.
  }
}

export function WidgetApp({
  config,
  apiUrl,
  appearance,
  inline,
  position,
  offset,
  width,
  height,
  onController,
}: WidgetAppProps): React.ReactElement {
  // Read once, on the first render, so a refresh reopens a chat that was open.
  const [open, setOpen] = useState(() => !inline && readOpen(config.key));
  const [expanded, setExpanded] = useState(false);
  const [hasOpened, setHasOpened] = useState(open);

  const changeOpen = useCallback(
    (next: boolean) => {
      setOpen(next);
      if (next) setHasOpened(true);
      else setExpanded(false);
      saveOpen(config.key, next);
    },
    [config.key],
  );

  useEffect(() => {
    onController({ open: () => changeOpen(true), close: () => changeOpen(false) });
  }, [onController, changeOpen]);

  const theme = themeToStyle(appearance.theme);

  if (inline) {
    return (
      <div
        style={theme}
        className="border-chat-border h-full w-full overflow-hidden rounded-2xl border"
      >
        <ChatWindow config={config} apiUrl={apiUrl} appearance={appearance} />
      </div>
    );
  }

  const layout = floatingLayout({ position, offset, width, height, expanded });
  const LauncherIcon = open ? ChevronDown : MessageSquare;

  return (
    <div style={theme}>
      <div
        style={{
          ...layout.panel,
          transition: PANEL_TRANSITION,
          opacity: open ? 1 : 0,
          transform: open ? 'translateY(0)' : 'translateY(12px)',
          pointerEvents: open ? 'auto' : 'none',
        }}
        className="border-chat-border fixed z-[2147483647] overflow-hidden rounded-2xl border shadow-2xl shadow-black/30"
      >
        {hasOpened ? (
          <ChatWindow
            config={config}
            apiUrl={apiUrl}
            appearance={appearance}
            expanded={expanded}
            onClose={() => changeOpen(false)}
            onToggleExpand={() => setExpanded((previous) => !previous)}
          />
        ) : null}
      </div>

      <button
        type="button"
        onClick={() => changeOpen(!open)}
        aria-label={open ? 'Close chat' : 'Open chat'}
        style={{ ...layout.launcher, width: LAUNCHER_SIZE, height: LAUNCHER_SIZE }}
        className="bg-chat-accent text-chat-accent-foreground fixed z-[2147483646] flex cursor-pointer items-center justify-center rounded-full shadow-lg shadow-black/30 transition-transform hover:scale-105"
      >
        <LauncherIcon className="size-6" aria-hidden />
      </button>
    </div>
  );
}
