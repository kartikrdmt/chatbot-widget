import type { CSSProperties } from 'react';

import {
  type WidgetAppearance,
  WidgetAppearanceSchema,
  type WidgetTheme,
} from '@/lib/contracts/widget';

/** The options a site passes to `MyraWidget.init` (or as `data-*` attributes) for how the chat looks. */
export interface WidgetAppearanceOptions {
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
}

/** Anything invalid (a bad colour, an over-long text) is dropped rather than rejected. */
export function parseWidgetAppearance(options: WidgetAppearanceOptions): WidgetAppearance {
  return WidgetAppearanceSchema.parse({
    title: options.title,
    subtitle: options.subtitle,
    greeting: options.greeting,
    placeholder: options.placeholder,
    avatarText: options.avatarText,
    theme: {
      accent: options.accentColor,
      accentForeground: options.accentTextColor,
      surface: options.backgroundColor,
      raised: options.chatBackgroundColor,
      foreground: options.textColor,
      muted: options.mutedColor,
      border: options.borderColor,
    },
  });
}

const THEME_VARIABLES: Record<keyof WidgetTheme, string> = {
  accent: '--chat-accent',
  accentForeground: '--chat-accent-foreground',
  surface: '--chat-surface',
  raised: '--chat-raised',
  foreground: '--chat-foreground',
  muted: '--chat-muted',
  border: '--chat-border',
};

/** `muted` also drives the dim text colour, which the widget uses for timestamps. */
export function themeToStyle(theme: WidgetTheme | undefined): CSSProperties {
  const style: Record<string, string> = {};
  for (const [key, variable] of Object.entries(THEME_VARIABLES)) {
    const value = theme?.[key as keyof WidgetTheme];
    if (value) style[variable] = value;
  }
  if (theme?.muted) style['--chat-dim'] = theme.muted;
  return style as CSSProperties;
}
