import type { CSSProperties } from 'react';

import {
  type WidgetAppearance,
  WidgetAppearanceSchema,
  type WidgetTheme,
} from '@/lib/contracts/widget';

type SearchParams = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined): string | undefined =>
  (Array.isArray(value) ? value[0] : value) || undefined;

/** Reads the appearance the embed script forwards from its `data-*` attributes. */
export function parseWidgetAppearance(params: SearchParams): WidgetAppearance {
  return WidgetAppearanceSchema.parse({
    title: first(params.title),
    subtitle: first(params.subtitle),
    greeting: first(params.greeting),
    placeholder: first(params.placeholder),
    avatarText: first(params.avatarText),
    theme: {
      accent: first(params.accent),
      accentForeground: first(params.accentText),
      surface: first(params.surface),
      raised: first(params.raised),
      foreground: first(params.text),
      muted: first(params.muted),
      border: first(params.border),
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
