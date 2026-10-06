'use client';

import type { WidgetAppearance, WidgetConfig } from '@/lib/contracts/widget';
import { useState } from 'react';

import { ChatWindow } from './chat-window';

const notifyParent = (message: { type: string; expanded?: boolean }): void => {
  window.parent.postMessage(message, '*');
};

interface ChatEmbedProps {
  config: WidgetConfig;
  appearance: WidgetAppearance;
  /** Rendered inside the host page's own container, so it can't be closed or maximised. */
  inline?: boolean;
}

export function ChatEmbed({
  config,
  appearance,
  inline = false,
}: ChatEmbedProps): React.ReactElement {
  const [expanded, setExpanded] = useState(false);

  const handleToggleExpand = (): void => {
    const next = !expanded;
    setExpanded(next);
    notifyParent({ type: 'myra-widget:expand', expanded: next });
  };

  const handleClose = (): void => {
    setExpanded(false);
    notifyParent({ type: 'myra-widget:close' });
  };

  return (
    <div className="h-dvh w-full">
      <ChatWindow
        config={config}
        appearance={appearance}
        expanded={expanded}
        onClose={inline ? undefined : handleClose}
        onToggleExpand={inline ? undefined : handleToggleExpand}
      />
    </div>
  );
}
