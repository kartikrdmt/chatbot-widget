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

export type ChatbotSize = number | string;

export interface ChatbotWidgetProps {
  siteToken: string;
  widgetUrl?: string;
  apiUrl?: string;

  position?: ChatbotPosition;
  offset?: number;
  width?: ChatbotSize;
  height?: ChatbotSize;
  inline?: boolean;
  className?: string;
  style?: CSSProperties;

  title?: string;
  subtitle?: string;
  greeting?: string;
  placeholder?: string;
  avatarText?: string;

  accentColor?: string;
  accentTextColor?: string;
  backgroundColor?: string;
  chatBackgroundColor?: string;
  textColor?: string;
  mutedColor?: string;
  borderColor?: string;
  radius?: 'square' | 'rounded' | 'pill';
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

  const src = `${widgetUrl.replace(/\/+$/, '')}/v1/widget.js`;
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
