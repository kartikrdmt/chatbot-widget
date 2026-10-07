import type { CSSProperties } from 'react';

import { mergeTheme, sanitizeTheme, themeToCssVariables } from './theme-vars';
import { type WidgetAppearance, WidgetAppearanceSchema, type WidgetTheme } from '@myra/contracts';

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
  radius?: string;
  font?: string;
}

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

export function themeToStyle(
  serverTheme: WidgetTheme | undefined,
  appearanceTheme?: WidgetTheme | undefined,
): CSSProperties {
  const merged = mergeTheme(sanitizeTheme(serverTheme), sanitizeTheme(appearanceTheme));
  return themeToCssVariables(merged) as CSSProperties;
}
