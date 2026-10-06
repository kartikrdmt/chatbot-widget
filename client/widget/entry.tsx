import {
  DEFAULT_WIDGET_CONFIG,
  type WidgetConfig,
  WidgetConfigSchema,
} from '@/lib/contracts/widget';
import { createRoot } from 'react-dom/client';

import { parseWidgetAppearance, type WidgetAppearanceOptions } from '@/lib/widget-appearance';

import widgetCss from './widget.generated.txt';
import { isPosition, type Position, toCssSize } from './layout';
import { WidgetApp, type WidgetController } from './widget-app';

export interface InitOptions extends WidgetAppearanceOptions {
  key?: string;
  apiUrl?: string;
  position?: string;
  offset?: number | string;
  width?: number | string;
  height?: number | string;
  /** A CSS selector or element. When set, the chat is drawn inside it instead of floating. */
  container?: string | Element | null;
  /** Accepted for backwards compatibility with the iframe version; no longer needed. */
  widgetUrl?: string;
}

export interface WidgetInstance extends WidgetController {
  destroy: () => void;
}

const DEFAULT_OFFSET = 24;

/** Tailwind's `@property` rules only work in the main document, never inside a shadow root. */
function installDocumentProperties(): void {
  if (document.getElementById('myra-widget-properties')) return;
  const rules = widgetCss.match(/@property[^{]+\{[^}]*\}/g);
  if (!rules) return;
  const style = document.createElement('style');
  style.id = 'myra-widget-properties';
  style.textContent = rules.join('\n');
  document.head.appendChild(style);
}

const warn = (reason: string): null => {
  console.warn(`[Myra widget] Not shown: ${reason}`);
  return null;
};

/**
 * Null means "do not mount": the key is unknown, this site is not allowed (the browser
 * reports that as a failed cross-origin request), or the API is down. Without an API
 * URL the defaults are used, which is only useful for trying the widget out.
 */
async function fetchConfig(apiUrl: string, key: string): Promise<WidgetConfig | null> {
  if (!apiUrl) return { ...DEFAULT_WIDGET_CONFIG, key };
  try {
    const response = await fetch(`${apiUrl}/widget/config?key=${encodeURIComponent(key)}`);
    if (response.status === 404) return warn(`the widget key "${key}" is not known to the server.`);
    if (response.status === 403) return warn(`this website is not allowed for the key "${key}".`);
    if (!response.ok) return warn(`the server answered ${response.status}.`);
    const parsed = WidgetConfigSchema.safeParse(await response.json());
    return parsed.success ? parsed.data : warn('the server sent an unexpected config.');
  } catch {
    return warn(
      `could not reach the API at ${apiUrl}. Check that the server is running and that this website is on its allowed list (WIDGET_SITES / CORS_ORIGINS).`,
    );
  }
}

function resolveContainer(container: InitOptions['container']): Element | null {
  if (!container) return null;
  return typeof container === 'string' ? document.querySelector(container) : container;
}

function init(options: InitOptions = {}): WidgetInstance | null {
  const key = options.key ?? '';
  const apiUrl = (options.apiUrl ?? '').replace(/\/+$/, '');
  const container = resolveContainer(options.container);
  if (options.container && !container) return null;

  let destroyed = false;
  let controller: WidgetController | null = null;
  let pendingOpen: boolean | null = null;
  let host: HTMLElement | null = null;
  let root: ReturnType<typeof createRoot> | null = null;

  const mount = (config: WidgetConfig): void => {
    if (destroyed) return;
    installDocumentProperties();

    host = document.createElement('div');
    host.setAttribute('data-myra-widget', '');
    const inline = container !== null;
    host.style.cssText = inline
      ? `display:block;max-width:100%;width:${toCssSize(options.width, '100%')};height:${toCssSize(options.height, '600px')};`
      : 'all:initial;';
    (container ?? document.body).appendChild(host);

    const shadow = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = widgetCss;
    const mountPoint = document.createElement('div');
    mountPoint.className = 'myra-widget-root';
    mountPoint.style.cssText = inline ? 'height:100%;width:100%;' : '';
    shadow.append(style, mountPoint);

    const offset = Number.parseInt(String(options.offset ?? DEFAULT_OFFSET), 10);
    const position: Position = isPosition(options.position)
      ? options.position
      : isPosition(config.position)
        ? config.position
        : 'bottom-right';

    root = createRoot(mountPoint);
    root.render(
      <WidgetApp
        config={config}
        apiUrl={apiUrl}
        appearance={parseWidgetAppearance(options)}
        inline={inline}
        position={position}
        offset={Number.isNaN(offset) ? DEFAULT_OFFSET : offset}
        width={toCssSize(options.width, '380px')}
        height={toCssSize(options.height, '600px')}
        onController={(next) => {
          controller = next;
          if (pendingOpen !== null) {
            if (pendingOpen) next.open();
            else next.close();
            pendingOpen = null;
          }
        }}
      />,
    );
  };

  const start = (): void => {
    void fetchConfig(apiUrl, key).then((config) => {
      if (config) mount(config);
    });
  };

  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start, { once: true });

  return {
    open: () => (controller ? controller.open() : (pendingOpen = true)),
    close: () => (controller ? controller.close() : (pendingOpen = false)),
    destroy: () => {
      destroyed = true;
      root?.unmount();
      host?.remove();
      host = null;
      root = null;
    },
  };
}

// Script-tag attributes (data-accent-color, ...) -> init option names.
const ATTRIBUTES: Record<string, keyof InitOptions> = {
  'data-key': 'key',
  'data-api-url': 'apiUrl',
  'data-position': 'position',
  'data-offset': 'offset',
  'data-width': 'width',
  'data-height': 'height',
  'data-container': 'container',
  'data-title': 'title',
  'data-subtitle': 'subtitle',
  'data-greeting': 'greeting',
  'data-placeholder': 'placeholder',
  'data-avatar-text': 'avatarText',
  'data-accent-color': 'accentColor',
  'data-accent-text-color': 'accentTextColor',
  'data-background-color': 'backgroundColor',
  'data-chat-background-color': 'chatBackgroundColor',
  'data-text-color': 'textColor',
  'data-muted-color': 'mutedColor',
  'data-border-color': 'borderColor',
};

declare global {
  interface Window {
    MyraWidget?: {
      init: (options?: InitOptions) => WidgetInstance | null;
      open: () => void;
      close: () => void;
    };
  }
}

// currentScript is empty when a loader or tag manager runs the script later,
// so fall back to finding our own tag.
const script =
  document.currentScript ?? document.querySelector('script[src*="widget.js"][data-key]');

if (!window.MyraWidget) {
  let current: WidgetInstance | null = null;

  window.MyraWidget = {
    /** Mounts a widget and returns { open, close, destroy }, or null if it cannot mount. */
    init: (options) => {
      const instance = init(options);
      if (instance) current = instance;
      return instance;
    },
    open: () => current?.open(),
    close: () => current?.close(),
  };

  // A tag with data-key mounts itself; one without (loaded by the npm package or
  // another loader) only exposes MyraWidget.init.
  if (script instanceof HTMLScriptElement && script.hasAttribute('data-key')) {
    const options: Record<string, string> = {};
    for (const [attribute, name] of Object.entries(ATTRIBUTES)) {
      const value = script.getAttribute(attribute);
      if (value !== null) options[name] = value;
    }
    window.MyraWidget.init(options as InitOptions);
  }
}
