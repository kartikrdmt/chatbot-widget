// Keep this file tiny: no React, no zod. The build fails if it grows past its size budget.
import {
  type ThemeValues,
  FONT_PATTERN,
  mergeTheme,
  sanitizeTheme,
  SIZE_PATTERN,
  themeToCssVariables,
} from '@/lib/theme-vars';
import type { WidgetAppearanceOptions } from '@/lib/widget-appearance';

import { floatingLayout, isPosition, panelOrigin, type Position, toCssSize } from './layout';
import { LOADER_CSS } from './loader-styles';
import type { ChatHandle, ChatModule } from './chat-entry';

declare const __MYRA_CHAT_PATH__: string;

export interface InitOptions extends WidgetAppearanceOptions {
  siteToken?: string;
  key?: string;
  apiUrl?: string;
  position?: string;
  offset?: number | string;
  width?: number | string;
  height?: number | string;
  container?: string | Element | null;
}

export interface WidgetInstance {
  open: () => void;
  close: () => void;
  destroy: () => void;
}

interface LoaderConfig {
  raw: unknown;
  status: 'active' | 'disabled';
  siteId: string;
  token: string;
  expiresAt: string;
  visitorId?: string;
  theme: ThemeValues;
  position?: Position;
  offset?: number;
  width?: string;
  height?: string;
}

const DEFAULT_OFFSET = 24;

const DEFAULT_API_URL = (process.env.WIDGET_DEFAULT_API_URL ?? '').replace(/\/+$/, '');


const warn = (reason: string): null => {
  console.warn(`[Myra widget] Not shown: ${reason}`);
  return null;
};

const visitorKey = (token: string): string => `myra.visitor.${token}`;
const openKey = (siteId: string): string => `myra.widget.open.${siteId}`;

const storage = {
  read: (store: Storage, key: string): string | null => {
    try {
      return store.getItem(key);
    } catch {
      return null;
    }
  },
  write: (store: Storage, key: string, value: string): void => {
    try {
      store.setItem(key, value);
    } catch {}
  },
};

const asString = (value: unknown): string | undefined =>
  typeof value === 'string' && value ? value : undefined;

// Browsers ignore @font-face inside a shadow root, so the font link goes in the page <head>.
function injectFont(fontFamily: string): void {
  const id = `myra-font-${fontFamily.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontFamily)}:wght@400;500;600&display=swap`;
  document.head.appendChild(link);
}

const BOX_PROPERTIES = [
  'top',
  'right',
  'bottom',
  'left',
  'marginTop',
  'marginRight',
  'marginBottom',
  'marginLeft',
  'width',
  'height',
  'borderRadius',
  'borderWidth',
  'display',
] as const;

function applyBox(element: HTMLElement, style: Record<string, string | number | undefined>): void {
  const target = element.style as unknown as Record<string, string>;
  for (const property of BOX_PROPERTIES) target[property] = '';
  for (const [property, value] of Object.entries(style)) {
    if (value !== undefined)
      target[property] = typeof value === 'number' && value !== 0 ? `${value}px` : String(value);
  }
}

const EASE = 'cubic-bezier(0.4, 0, 0.2, 1)';
const EASE_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)';
const EASE_IN = 'cubic-bezier(0.4, 0, 1, 1)';
const SIZE_PROPERTIES = ['width', 'height', 'top', 'bottom', 'left', 'right', 'border-radius'];
const ICON_TRANSITION = `transform .4s ${EASE_OUT}, opacity .25s ease`;

const reducedMotion = (): boolean =>
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function panelTransition(open: boolean, reduceMotion: boolean): string {
  if (reduceMotion) return 'opacity .15s linear, visibility 0s linear';
  return [
    `opacity ${open ? '.35s' : '.2s'} ease`,
    `transform ${open ? '.55s' : '.25s'} ${open ? EASE_OUT : EASE_IN}`,
    `visibility 0s linear ${open ? '0s' : '.25s'}`,
    ...SIZE_PROPERTIES.map((property) => `${property} .4s ${EASE}`),
  ].join(', ');
}

const SVG_OPEN = '<svg viewBox="0 0 24 24" aria-hidden="true">';
const ICON_CHAT = `${SVG_OPEN}<path d="M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z"/></svg>`;
const ICON_CLOSE = `${SVG_OPEN}<path d="m6 9 6 6 6-6"/></svg>`;


async function fetchConfig(apiUrl: string, siteToken: string): Promise<LoaderConfig | null> {
  if (!apiUrl) {
    return warn('no API URL. Add data-api-url="https://your-api.example.com" to the script tag.');
  }
  try {
    const visitorId = storage.read(localStorage, visitorKey(siteToken));
    const response = await fetch(
      `${apiUrl}/widget/config?token=${encodeURIComponent(siteToken)}${
        visitorId ? `&visitorId=${encodeURIComponent(visitorId)}` : ''
      }`,
    );
    if (response.status === 404)
      return warn(`the site token "${siteToken}" is not known to the server.`);
    if (response.status === 403)
      return warn(`this website is not allowed for the token "${siteToken}".`);
    if (!response.ok) return warn(`the server answered ${response.status}.`);

    const raw = (await response.json()) as Record<string, unknown>;
    const session = (raw.session ?? {}) as Record<string, unknown>;
    const launcher = (raw.launcher ?? {}) as Record<string, unknown>;
    const status = raw.status === 'disabled' ? 'disabled' : 'active';
    if (status === 'disabled')
      return warn('the chat is disabled for this site (status: "disabled").');
    if (!asString(session.token) || !asString(session.expiresAt))
      return warn('the server sent no session.');

    const newVisitorId = asString(raw.visitorId);
    if (newVisitorId) storage.write(localStorage, visitorKey(siteToken), newVisitorId);

    return {
      raw,
      status,
      siteId: asString(raw.siteId) ?? 'site',
      token: session.token as string,
      expiresAt: session.expiresAt as string,
      visitorId: newVisitorId,
      theme: sanitizeTheme(raw.theme),
      position: isPosition(launcher.position) ? launcher.position : undefined,
      offset: typeof launcher.offset === 'number' ? launcher.offset : undefined,
      width:
        typeof launcher.width === 'string' && SIZE_PATTERN.test(launcher.width)
          ? launcher.width
          : undefined,
      height:
        typeof launcher.height === 'string' && SIZE_PATTERN.test(launcher.height)
          ? launcher.height
          : undefined,
    };
  } catch {
    return warn(
      `could not reach the API at ${apiUrl}. Check that the server is running and that this website is on its allowed list.`,
    );
  }
}

const chatUrl = (scriptOrigin: string): string => `${scriptOrigin}${__MYRA_CHAT_PATH__}`;


function init(options: InitOptions, scriptOrigin: string): WidgetInstance | null {
  const siteToken = options.siteToken ?? options.key ?? '';
  const apiUrl = (options.apiUrl ?? DEFAULT_API_URL).replace(/\/+$/, '');
  const inlineHost =
    typeof options.container === 'string'
      ? document.querySelector(options.container)
      : (options.container ?? null);
  if (options.container && !inlineHost) return null;
  const inline = inlineHost !== null;

  const overrides = sanitizeTheme({
    accent: options.accentColor,
    accentForeground: options.accentTextColor,
    surface: options.backgroundColor,
    raised: options.chatBackgroundColor,
    foreground: options.textColor,
    muted: options.mutedColor,
    border: options.borderColor,
    radius: options.radius,
    font: options.font,
  });

  let destroyed = false;
  let config: LoaderConfig | null = null;
  let host: HTMLElement | null = null;
  let panel: HTMLElement | null = null;
  let launcher: HTMLButtonElement | null = null;
  let mount: HTMLElement | null = null;
  let shadow: ShadowRoot | null = null;
  let iconChat: HTMLElement | null = null;
  let iconClose: HTMLElement | null = null;
  let chat: ChatHandle | null = null;
  let chatLoading: Promise<void> | null = null;
  let open = false;
  let expanded = false;
  let renewTimer: ReturnType<typeof setTimeout> | undefined;
  let lastRefreshAt = 0;
  let pendingOpen: boolean | null = null;

  let position: Position = 'bottom-right';
  let offset = DEFAULT_OFFSET;
  let width = '380px';
  let height = '600px';


  const layout = () => floatingLayout({ position, offset, width, height, expanded });

  const paint = (animate: boolean): void => {
    if (!panel || !launcher || inline) return;
    const current = layout();
    const reduce = reducedMotion();
    applyBox(panel, current.panel as Record<string, string | number>);
    applyBox(launcher, current.launcher as Record<string, string | number>);
    panel.style.transition = animate ? panelTransition(open, reduce) : 'none';
    panel.style.transformOrigin = panelOrigin(position);
    panel.style.opacity = open ? '1' : '0';
    panel.style.visibility = open ? 'visible' : 'hidden';
    panel.style.pointerEvents = open ? 'auto' : 'none';
    panel.style.transform = open || reduce ? 'none' : 'translateY(16px) scale(0.82)';
    launcher.setAttribute('aria-label', open ? 'Close chat' : 'Open chat');
    if (iconChat && iconClose) {
      iconChat.style.cssText = `transition:${ICON_TRANSITION};opacity:${open ? 0 : 1};transform:${open ? 'rotate(90deg) scale(0.4)' : 'none'}`;
      iconClose.style.cssText = `transition:${ICON_TRANSITION};opacity:${open ? 1 : 0};transform:${open ? 'none' : 'rotate(-90deg) scale(0.4)'}`;
    }
  };


  const showStatus = (html: string): void => {
    if (mount) mount.innerHTML = html;
  };

  const loadChat = (): Promise<void> => {
    if (chat || destroyed) return Promise.resolve();
    if (chatLoading) return chatLoading;
    showStatus('<div class="myra-status"><div class="myra-dots"><i></i><i></i><i></i></div></div>');

    chatLoading = (import(/* @vite-ignore */ chatUrl(scriptOrigin)) as Promise<ChatModule>)
      .then((module) => {
        if (destroyed || !shadow || !mount || !config) return;
        mount.innerHTML = '';
        chat = module.mountChat({
          shadow,
          target: mount,
          rawConfig: config.raw,
          sessionToken: config.token,
          apiUrl,
          options,
          expanded,
          inline,
          onClose: () => setOpen(false),
          onToggleExpand: () => {
            expanded = !expanded;
            paint(true);
            chat?.update({ expanded });
          },
          onSessionExpired: () => refreshSession(),
          onDisabled: () => destroy(),
        });
      })
      .catch(() => {
        chatLoading = null;
        showStatus(
          '<div class="myra-status"><div>The chat could not be loaded.<br><button type="button">Try again</button></div></div>',
        );
        mount?.querySelector('button')?.addEventListener('click', () => void loadChat());
      });
    return chatLoading;
  };


  const setOpen = (next: boolean): void => {
    if (destroyed || inline || !config) return;
    open = next;
    if (!next) expanded = false;
    storage.write(sessionStorage, openKey(config.siteId), next ? '1' : '0');
    paint(true);
    if (next) {
      void loadChat();
    } else {
      chat?.update({ expanded: false });
    }
  };


  const refreshSession = (attempt = 0, scheduled = false): void => {
    if (destroyed) return;
    if (!scheduled && attempt === 0 && Date.now() - lastRefreshAt < 10_000) return;
    lastRefreshAt = Date.now();
    void fetchConfig(apiUrl, siteToken).then((fresh) => {
      if (destroyed) return;
      if (fresh) {
        config = fresh;
        chat?.update({ sessionToken: fresh.token, rawConfig: fresh.raw });
        scheduleRenewal();
      } else if (attempt < 3) {
        clearTimeout(renewTimer);
        renewTimer = setTimeout(() => refreshSession(attempt + 1), 30_000 * (attempt + 1));
      }
    });
  };

  const scheduleRenewal = (): void => {
    clearTimeout(renewTimer);
    if (!config?.expiresAt) return;
    const renewIn = Math.max(5_000, new Date(config.expiresAt).getTime() - Date.now() - 60_000);
    renewTimer = setTimeout(() => refreshSession(0, true), renewIn);
  };


  const build = (loaded: LoaderConfig): void => {
    if (destroyed) return;
    config = loaded;

    position = isPosition(options.position)
      ? options.position
      : (loaded.position ?? 'bottom-right');
    const parsedOffset = Number.parseInt(
      String(options.offset ?? loaded.offset ?? DEFAULT_OFFSET),
      10,
    );
    offset = Number.isNaN(parsedOffset) ? DEFAULT_OFFSET : parsedOffset;
    width = toCssSize(options.width, loaded.width ?? '380px');
    height = toCssSize(options.height, loaded.height ?? '600px');

    host = document.createElement('div');
    host.setAttribute('data-myra-widget', '');
    host.style.cssText = inline
      ? `display:block;max-width:100%;width:${toCssSize(options.width, '100%')};height:${height};`
      : 'all:initial;';

    shadow = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = LOADER_CSS;
    const root = document.createElement('div');
    root.className = 'myra-widget-root';
    if (inline) root.style.cssText = 'height:100%;width:100%;';

    const theme = mergeTheme(loaded.theme, overrides);
    for (const [name, value] of Object.entries(themeToCssVariables(theme))) {
      root.style.setProperty(name, value);
    }
    if (theme.font && FONT_PATTERN.test(theme.font)) injectFont(theme.font);

    if (inline) {
      panel = document.createElement('div');
      panel.className = 'myra-inline';
    } else {
      panel = document.createElement('div');
      panel.className = 'myra-panel';
      panel.setAttribute('role', 'dialog');
      panel.setAttribute('aria-label', 'Chat');
    }
    mount = document.createElement('div');
    mount.className = 'myra-mount';
    panel.appendChild(mount);
    root.appendChild(panel);

    if (!inline) {
      launcher = document.createElement('button');
      launcher.type = 'button';
      launcher.className = 'myra-launcher';
      launcher.innerHTML = `<span class="myra-icons"><span>${ICON_CHAT}</span><span>${ICON_CLOSE}</span></span>`;
      const icons = launcher.querySelectorAll<HTMLElement>('.myra-icons > span');
      iconChat = icons[0] ?? null;
      iconClose = icons[1] ?? null;
      for (const icon of [iconChat, iconClose]) {
        if (icon) icon.style.cssText = 'position:absolute;inset:0;display:block';
      }
      launcher.addEventListener('click', () => setOpen(!open));
      root.appendChild(launcher);

      open = storage.read(sessionStorage, openKey(loaded.siteId)) === '1';
      paint(false);
    }

    shadow.append(style, root);
    (inlineHost ?? document.body).appendChild(host);

    scheduleRenewal();
    if (pendingOpen !== null) {
      const requested = pendingOpen;
      pendingOpen = null;
      setOpen(requested);
    } else if (inline || open) {
      void loadChat();
    }
  };

  const destroy = (): void => {
    destroyed = true;
    clearTimeout(renewTimer);
    chat?.unmount();
    chat = null;
    host?.remove();
    host = null;
  };

  const start = (): void => {
    void fetchConfig(apiUrl, siteToken).then((loaded) => {
      if (loaded) build(loaded);
    });
  };

  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start, { once: true });

  return {
    open: () => (config ? setOpen(true) : ((pendingOpen = true), undefined)),
    close: () => (config ? setOpen(false) : ((pendingOpen = false), undefined)),
    destroy,
  };
}


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
  'data-radius': 'radius',
  'data-font': 'font',
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

const script =
  document.currentScript ??
  document.querySelector('script[src*="widget.js"][data-site-token]') ??
  document.querySelector('script[src*="widget.js"][data-key]');

if (!window.MyraWidget) {
  const scriptOrigin = script instanceof HTMLScriptElement ? new URL(script.src).origin : '';
  let current: WidgetInstance | null = null;

  window.MyraWidget = {
    init: (options = {}) => {
      const instance = init(options, scriptOrigin);
      if (instance) current = instance;
      return instance;
    },
    open: () => current?.open(),
    close: () => current?.close(),
  };

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
