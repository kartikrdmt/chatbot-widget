import type { CSSProperties } from 'react';

import { mergeTheme, sanitizeTheme, themeToCssVariables } from './theme-vars';
import { type WidgetAppearance, WidgetAppearanceSchema, type WidgetTheme } from '@myra/contracts';

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
  /** `square`, `rounded` or `pill`. */
  radius?: string;
  /** A Google Font family name, such as `Inter`. */
  font?: string;
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
      radius: options.radius,
      font: options.font,
    },
  });
}

/**
 * Merges the server's theme with the overrides from `data-*` attributes or React props, and turns
 * the result into CSS custom properties for the shadow root. Overrides win; a missing override
 * never clobbers a server value.
 */
export function themeToStyle(
  serverTheme: WidgetTheme | undefined,
  appearanceTheme?: WidgetTheme | undefined,
): CSSProperties {
  const merged = mergeTheme(sanitizeTheme(serverTheme), sanitizeTheme(appearanceTheme));
  return themeToCssVariables(merged) as CSSProperties;
}
