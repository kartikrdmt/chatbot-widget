import { WidgetConfigSchema } from '@myra/contracts';
import { createRoot, type Root } from 'react-dom/client';

import { ChatWindow } from '@/components/chat-widget/chat-window';
import { parseWidgetAppearance, type WidgetAppearanceOptions } from '@/lib/widget-appearance';

import chatCss from './chat.generated.txt';

export interface MountChatOptions {
  shadow: ShadowRoot;
  target: HTMLElement;
  rawConfig: unknown;
  sessionToken: string;
  apiUrl: string;
  options: WidgetAppearanceOptions;
  expanded: boolean;
  inline: boolean;
  onClose: () => void;
  onToggleExpand: () => void;
  onSessionExpired: () => void;
  onDisabled: () => void;
}

export interface ChatState {
  rawConfig: unknown;
  sessionToken: string;
  expanded: boolean;
}

export interface ChatHandle {
  update: (next: Partial<ChatState>) => void;
  unmount: () => void;
}

export interface ChatModule {
  mountChat: (options: MountChatOptions) => ChatHandle;
}

// Tailwind's @property rules are ignored inside a shadow root, so they are added to the page.
function installDocumentProperties(): void {
  if (document.getElementById('myra-widget-properties')) return;
  const rules = chatCss.match(/@property[^{]+\{[^}]*\}/g);
  if (!rules) return;
  const style = document.createElement('style');
  style.id = 'myra-widget-properties';
  style.textContent = rules.join('\n');
  document.head.appendChild(style);
}

export function mountChat(options: MountChatOptions): ChatHandle {
  installDocumentProperties();

  // Prepended, so the loader's own rules (launcher, frame) still win over the chat's resets.
  const style = document.createElement('style');
  style.textContent = chatCss;
  options.shadow.prepend(style);

  const root: Root = createRoot(options.target);
  const appearance = parseWidgetAppearance(options.options);
  const state: ChatState = {
    rawConfig: options.rawConfig,
    sessionToken: options.sessionToken,
    expanded: options.expanded,
  };

  const render = (): void => {
    root.render(
      <ChatWindow
        config={WidgetConfigSchema.parse(state.rawConfig)}
        sessionToken={state.sessionToken}
        apiUrl={options.apiUrl}
        appearance={appearance}
        expanded={state.expanded}
        onClose={options.inline ? undefined : options.onClose}
        onToggleExpand={options.inline ? undefined : options.onToggleExpand}
        onSessionExpired={options.onSessionExpired}
        onDisabled={options.onDisabled}
      />,
    );
  };
  render();

  return {
    update: (next) => {
      Object.assign(state, next);
      render();
    },
    unmount: () => {
      root.unmount();
      style.remove();
    },
  };
}
