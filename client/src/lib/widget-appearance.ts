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

const THEME_VARIABLES: Partial<Record<keyof WidgetTheme, string>> = {
  accent: '--chat-accent',
  accentForeground: '--chat-accent-foreground',
  surface: '--chat-surface',
  raised: '--chat-raised',
  foreground: '--chat-foreground',
  muted: '--chat-muted',
  border: '--chat-border',
};

const RADIUS_VALUES: Record<string, string> = {
  square: '0px',
  rounded: '0.75rem',
  pill: '9999px',
};

/**
 * Merges server-provided theme with appearance overrides from data-* attributes / React props,
 * then converts to CSS custom properties for the shadow root.
 * `muted` also drives dim text (timestamps). `radius` sets `--chat-radius`.
 * `font` sets `--chat-font-family` (the Google Font name; injection of <link> is handled in entry.tsx).
 */
export function themeToStyle(
  serverTheme: WidgetTheme | undefined,
  appearanceTheme?: WidgetTheme | undefined,
): CSSProperties {
  // Appearance overrides win; undefined values from appearance do not clobber server values
  const merged: Partial<WidgetTheme> = { ...serverTheme };
  if (appearanceTheme) {
    for (const key of Object.keys(appearanceTheme) as (keyof WidgetTheme)[]) {
      if (appearanceTheme[key] !== undefined) {
        (merged as Record<string, unknown>)[key] = appearanceTheme[key];
      }
    }
  }

  const style: Record<string, string> = {};

  for (const [key, variable] of Object.entries(THEME_VARIABLES)) {
    const value = merged[key as keyof WidgetTheme];
    if (value && typeof value === 'string') style[variable] = value;
  }

  if (merged.muted) style['--chat-dim'] = merged.muted;

  if (merged.radius) {
    style['--chat-radius'] = RADIUS_VALUES[merged.radius] ?? RADIUS_VALUES.rounded;
  }

  if (merged.font) {
    style['--chat-font-family'] = `'${merged.font}', var(--font-sans)`;
  }

  return style as CSSProperties;
}
