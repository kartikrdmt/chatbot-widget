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
  /** The site's widget key. */
  widgetKey: string;
  /** Where the widget app is hosted, for example `https://chat.example.com`. */
  widgetUrl: string;
  /** The chatbot API, for example `https://api.example.com`. */
  apiUrl: string;

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

  title?: string;
  subtitle?: string;
  greeting?: string;
  placeholder?: string;
  /** One or two letters shown in the bot's avatar. */
  avatarText?: string;

  /** Header, launcher button, send button, your message bubbles and the bot avatar. */
  accentColor?: string;
  /** Text and icons drawn on top of the accent colour. */
  accentTextColor?: string;
  /** Chat window and bot message bubbles. */
  backgroundColor?: string;
  /** The messages area behind the bubbles. */
  chatBackgroundColor?: string;
  /** Main text colour. */
  textColor?: string;
  /** Secondary text such as timestamps and the placeholder. */
  mutedColor?: string;
  /** Borders and divider lines. */
  borderColor?: string;
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
 */
export function ChatbotWidget({
  inline = false,
  className,
  style,
  ...props
}: ChatbotWidgetProps): React.ReactElement | null {
  const hostRef = useRef<HTMLDivElement>(null);
  // Re-mount only when a value really changes, not on every new props object.
  const optionsKey = JSON.stringify(props);

  useEffect(() => {
    const { widgetKey, widgetUrl, ...rest } = JSON.parse(optionsKey) as ChatbotWidgetProps;
    let cancelled = false;
    let instance: MyraWidgetInstance | null = null;

    loadWidgetScript(widgetUrl)
      .then((api) => {
        if (cancelled) return;
        instance = api.init({
          ...rest,
          key: widgetKey,
          widgetUrl,
          container: inline ? hostRef.current : undefined,
        });
      })
      .catch((error: unknown) => console.error('[ChatbotWidget]', error));

    return () => {
      cancelled = true;
      instance?.destroy();
    };
  }, [optionsKey, inline]);

  return inline ? <div ref={hostRef} className={className} style={style} /> : null;
}
