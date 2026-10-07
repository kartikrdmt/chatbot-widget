'use client';

import { type CSSProperties, useEffect, useRef } from 'react';

export type ChatbotPosition =
  | 'bottom-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'top-right'
  | 'top-left'
  | 'top-center'
  | 'left-center'
  | 'right-center';

/** A number is pixels; a string is any CSS size such as `"420px"`, `"90vw"` or `"100%"`. */
export type ChatbotSize = number | string;

export interface ChatbotWidgetProps {
  /** The site's public token (st_…). Required. */
  siteToken: string;
  /**
   * Where `widget.js` is hosted, for example `https://chat.example.com`. Needed unless
   * `widget.js` is already loaded on the page.
   */
  widgetUrl?: string;
  /**
   * The chatbot API, for example `https://api.example.com`. Optional: it defaults to the API
   * address built into `widget.js`.
   */
  apiUrl?: string;

  /**
   * Floating widgets only. Defaults to the position configured on the server, or
   * `bottom-right`.
   */
  position?: ChatbotPosition;
  /** Floating widgets only. Gap in pixels between the widget and the screen edge. */
  offset?: number;
  /** Floating: the largest width of the chat window. Inline: its exact width. */
  width?: ChatbotSize;
  /** Floating: the largest height of the chat window. Inline: its exact height. */
  height?: ChatbotSize;
  /**
   * Render the chat inside this component's own box instead of floating over
   * the page, so it sits wherever you place it.
   */
  inline?: boolean;
  /** Inline only: class for the box around the chat. */
  className?: string;
  /** Inline only: style for the box around the chat. */
  style?: CSSProperties;

  /** Override the title from the server config. */
  title?: string;
  /** Override the subtitle from the server config. */
  subtitle?: string;
  /** Override the greeting from the server config. */
  greeting?: string;
  /** Override the input placeholder from the server config. */
  placeholder?: string;
  /** One or two letters shown in the bot's avatar. Overrides the server config. */
  avatarText?: string;

  /** Override the brand colour (header, launcher, send button, visitor bubbles, avatar). */
  accentColor?: string;
  /** Text and icons drawn on top of the accent colour. */
  accentTextColor?: string;
  /** Chat window and bot message bubble background. */
  backgroundColor?: string;
  /** The messages area behind the bubbles. */
  chatBackgroundColor?: string;
  /** Main text colour. */
  textColor?: string;
  /** Secondary text such as timestamps and the placeholder. */
  mutedColor?: string;
  /** Borders and divider lines. */
  borderColor?: string;
  /** Corner style of the window, bubbles, buttons and launcher. */
  radius?: 'square' | 'rounded' | 'pill';
  /** A Google Font family name, such as `Inter`. Loaded into the page and used by the chat. */
  font?: string;
}

interface MyraWidgetInstance {
  open: () => void;
  close: () => void;
  destroy: () => void;
}

interface MyraWidgetApi {
  init: (options: Record<string, unknown>) => MyraWidgetInstance | null;
}

declare global {
  interface Window {
    MyraWidget?: MyraWidgetApi;
  }
}

const scriptLoads = new Map<string, Promise<MyraWidgetApi>>();

function loadWidgetScript(widgetUrl: string): Promise<MyraWidgetApi> {
  if (window.MyraWidget?.init) return Promise.resolve(window.MyraWidget);

  const src = `${widgetUrl.replace(/\/+$/, '')}/widget.js`;
  let load = scriptLoads.get(src);
  if (!load) {
    load = new Promise<MyraWidgetApi>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = () =>
        window.MyraWidget?.init
          ? resolve(window.MyraWidget)
          : reject(new Error('widget.js loaded without MyraWidget'));
      script.onerror = () => {
        scriptLoads.delete(src);
        reject(new Error(`Could not load ${src}`));
      };
      document.head.appendChild(script);
    });
    scriptLoads.set(src, load);
  }
  return load;
}

/**
 * The Myra Technolabs chatbot. Floats over the page by default; pass `inline`
 * to place it inside your layout instead.
 *
 * @example
 * // Floating (minimal)
 * <ChatbotWidget siteToken="st_xxxxxxxx" />
 *
 * @example
 * // Embedded inside a layout
 * <ChatbotWidget siteToken="st_xxxxxxxx" inline />
 */
export function ChatbotWidget({
  inline = false,
  className,
  style,
  ...props
}: ChatbotWidgetProps): React.ReactElement | null {
  const hostRef = useRef<HTMLDivElement>(null);
  const optionsKey = JSON.stringify(props);

  useEffect(() => {
    const { siteToken, widgetUrl, ...rest } = JSON.parse(optionsKey) as ChatbotWidgetProps;
    const resolvedWidgetUrl = widgetUrl ?? '';
    let cancelled = false;
    let instance: MyraWidgetInstance | null = null;

    const doInit = (api: MyraWidgetApi): void => {
      if (cancelled) return;
      instance = api.init({
        ...rest,
        siteToken,
        container: inline ? hostRef.current : undefined,
      });
    };

    if (resolvedWidgetUrl) {
      loadWidgetScript(resolvedWidgetUrl)
        .then(doInit)
        .catch((error: unknown) => console.error('[ChatbotWidget]', error));
    } else if (window.MyraWidget?.init) {
      doInit(window.MyraWidget);
    } else {
      console.warn('[ChatbotWidget] No widgetUrl provided and window.MyraWidget is not loaded.');
    }

    return () => {
      cancelled = true;
      instance?.destroy();
    };
  }, [optionsKey, inline]);

  return inline ? <div ref={hostRef} className={className} style={style} /> : null;
}
