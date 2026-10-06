import {
  DEFAULT_WIDGET_CONFIG,
  type WidgetConfig,
  WidgetConfigSchema,
} from '@/lib/contracts/widget';
import { createRoot } from 'react-dom/client';

import { parseWidgetAppearance, type WidgetAppearanceOptions, themeToStyle } from '@/lib/widget-appearance';

import widgetCss from './widget.generated.txt';
import { isPosition, type Position, toCssSize } from './layout';
import { WidgetApp, type WidgetController } from './widget-app';

export interface InitOptions extends WidgetAppearanceOptions {
  /** Primary token (SaaS). Accepts `st_…` tokens. */
  siteToken?: string;
  /** Deprecated alias for siteToken; accepted for one release. */
  key?: string;
  apiUrl?: string;
  position?: string;
  offset?: number | string;
  width?: number | string;
  height?: number | string;
  /** A CSS selector or element. When set, the chat is drawn inside it instead of floating. */
  container?: string | Element | null;
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

async function fetchConfig(apiUrl: string, siteToken: string): Promise<WidgetConfig | null> {
  if (!apiUrl) return { ...DEFAULT_WIDGET_CONFIG };
  try {
    const response = await fetch(
      `${apiUrl}/widget/config?token=${encodeURIComponent(siteToken)}`,
    );
    if (response.status === 404)
      return warn(`the site token "${siteToken}" is not known to the server.`);
    if (response.status === 403)
      return warn(`this website is not allowed for the token "${siteToken}".`);
    if (!response.ok) return warn(`the server answered ${response.status}.`);
    const parsed = WidgetConfigSchema.safeParse(await response.json());
    if (!parsed.success) return warn('the server sent an unexpected config.');
    if (parsed.data.status === 'disabled')
      return warn(`the chat is disabled for this site (status: "disabled").`);
    return parsed.data;
  } catch {
    return warn(
      `could not reach the API at ${apiUrl}. Check that the server is running and that this website is on its allowed list.`,
    );
  }
}

function resolveContainer(container: InitOptions['container']): Element | null {
  if (!container) return null;
  return typeof container === 'string' ? document.querySelector(container) : container;
}

/** Inject a Google Font <link> into the shadow root when the config requests one. */
function injectFont(shadow: ShadowRoot, fontFamily: string): void {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontFamily)}:wght@400;500;600&display=swap`;
  shadow.insertBefore(link, shadow.firstChild);
}

function init(options: InitOptions = {}): WidgetInstance | null {
  const siteToken = options.siteToken ?? options.key ?? '';
  const apiUrl = (options.apiUrl ?? '').replace(/\/+$/, '');
  const container = resolveContainer(options.container);
  if (options.container && !container) return null;

  let destroyed = false;
  let controller: WidgetController | null = null;
  let pendingOpen: boolean | null = null;
  let host: HTMLElement | null = null;
  let root: ReturnType<typeof createRoot> | null = null;

  const appearance = parseWidgetAppearance(options);

  const render = (config: WidgetConfig, sessionToken: string): void => {
    if (!root) return;
    const inline = container !== null;

    const offset = Number.parseInt(String(options.offset ?? config.launcher.offset ?? DEFAULT_OFFSET), 10);
    const position: Position = isPosition(options.position)
      ? options.position
      : isPosition(config.launcher.position)
        ? config.launcher.position
        : 'bottom-right';

    const width = toCssSize(options.width, config.launcher.width ?? '380px');
    const height = toCssSize(options.height, config.launcher.height ?? '600px');

    root.render(
      <WidgetApp
        config={config}
        sessionToken={sessionToken}
        apiUrl={apiUrl}
        appearance={appearance}
        inline={inline}
        position={position}
        offset={Number.isNaN(offset) ? DEFAULT_OFFSET : offset}
        width={width}
        height={height}
        onController={(next) => {
          controller = next;
          if (pendingOpen !== null) {
            if (pendingOpen) next.open();
            else next.close();
            pendingOpen = null;
          }
        }}
        onSessionExpired={() => {
          void fetchConfig(apiUrl, siteToken).then((newConfig) => {
            if (!newConfig?.session) return;
            render(newConfig, newConfig.session.token);
          });
        }}
        onDisabled={() => {
          root?.unmount();
          host?.remove();
          host = null;
          root = null;
        }}
      />,
    );
  };

  const mount = (config: WidgetConfig): void => {
    if (destroyed) return;
    installDocumentProperties();

    const inline = container !== null;
    const width = toCssSize(options.width, config.launcher.width ?? '380px');
    const height = toCssSize(options.height, config.launcher.height ?? '600px');

    host = document.createElement('div');
    host.setAttribute('data-myra-widget', '');
    host.style.cssText = inline
      ? `display:block;max-width:100%;width:${width};height:${height};`
      : 'all:initial;';
    (container ?? document.body).appendChild(host);

    const shadow = host.attachShadow({ mode: 'open' });

    // Inject custom font before any other shadow DOM children
    const font = config.theme.font ?? appearance.theme.font;
    if (font) injectFont(shadow, font);

    const style = document.createElement('style');
    style.textContent = widgetCss;
    const mountPoint = document.createElement('div');
    mountPoint.className = 'myra-widget-root';
    mountPoint.style.cssText = inline ? 'height:100%;width:100%;' : '';

    // Apply merged theme CSS variables directly on the mount point
    const themeStyle = themeToStyle(config.theme, appearance.theme);
    for (const [prop, value] of Object.entries(themeStyle)) {
      if (typeof value === 'string') mountPoint.style.setProperty(prop, value);
    }

    shadow.append(style, mountPoint);

    root = createRoot(mountPoint);

    const sessionToken = config.session?.token ?? '';
    render(config, sessionToken);

    // Proactive session renewal: re-fetch config 60 seconds before the token expires
    if (config.session?.expiresAt) {
      const expiresAt = new Date(config.session.expiresAt).getTime();
      const renewIn = Math.max(0, expiresAt - Date.now() - 60_000);
      setTimeout(() => {
        void fetchConfig(apiUrl, siteToken).then((newConfig) => {
          if (!destroyed && newConfig?.session) render(newConfig, newConfig.session.token);
        });
      }, renewIn);
    }
  };

  const start = (): void => {
    void fetchConfig(apiUrl, siteToken).then((config) => {
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

// Script-tag attribute names → init option names
const ATTRIBUTES: Record<string, keyof InitOptions> = {
  'data-site-token': 'siteToken',
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

// currentScript is null when a loader or tag manager runs the script later,
// so fall back to finding our own tag by either token attribute.
const script =
  document.currentScript ??
  document.querySelector('script[src*="widget.js"][data-site-token]') ??
  document.querySelector('script[src*="widget.js"][data-key]');

if (!window.MyraWidget) {
  let current: WidgetInstance | null = null;

  window.MyraWidget = {
    init: (options) => {
      const instance = init(options);
      if (instance) current = instance;
      return instance;
    },
    open: () => current?.open(),
    close: () => current?.close(),
  };

  // A tag with data-site-token (or legacy data-key) mounts itself automatically.
  if (
    script instanceof HTMLScriptElement &&
    (script.hasAttribute('data-site-token') || script.hasAttribute('data-key'))
  ) {
    const options: Record<string, string> = {};
    for (const [attribute, name] of Object.entries(ATTRIBUTES)) {
      const value = script.getAttribute(attribute);
      if (value !== null) options[name] = value;
    }
    window.MyraWidget.init(options as InitOptions);
  }
}
