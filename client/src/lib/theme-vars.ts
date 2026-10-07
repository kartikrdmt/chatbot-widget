// No dependencies on purpose: the loader can't afford zod. These rules repeat @myra/contracts; theme-vars.test.ts keeps them equal.

export const COLOR_PATTERN =
  /^(#[0-9a-f]{3,8}|[a-z]+|(rgb|hsl|oklch|oklab|lab|lch|hwb)a?\([0-9a-z\s.,%/+-]+\))$/i;

export const FONT_PATTERN = /^[A-Za-z0-9 ]{1,80}$/;

export const SIZE_PATTERN = /^\d*\.?\d+(px|%|vw|vh|dvh|rem|em)$/;

export type RadiusStyle = 'square' | 'rounded' | 'pill';

export interface ThemeValues {
  accent?: string;
  accentForeground?: string;
  surface?: string;
  raised?: string;
  foreground?: string;
  muted?: string;
  border?: string;
  radius?: string;
  font?: string;
}

const COLOR_VARIABLES = {
  accent: '--chat-accent',
  accentForeground: '--chat-accent-foreground',
  surface: '--chat-surface',
  raised: '--chat-raised',
  foreground: '--chat-foreground',
  muted: '--chat-muted',
  border: '--chat-border',
} as const;

export const RADIUS_VARIABLES: Record<RadiusStyle, Record<string, string>> = {
  square: {
    '--chat-radius-window': '0px',
    '--chat-radius-bubble': '0px',
    '--chat-radius-control': '0px',
    '--chat-radius-launcher': '0px',
  },
  rounded: {
    '--chat-radius-window': '1rem',
    '--chat-radius-bubble': '1rem',
    '--chat-radius-control': '0.5rem',
    '--chat-radius-launcher': '9999px',
  },
  pill: {
    '--chat-radius-window': '1.75rem',
    '--chat-radius-bubble': '1.5rem',
    '--chat-radius-control': '9999px',
    '--chat-radius-launcher': '9999px',
  },
};

export const DEFAULT_VARIABLES: Record<string, string> = {
  '--chat-surface': 'oklch(1 0 0)',
  '--chat-raised': 'oklch(0.97 0.006 265)',
  '--chat-border': 'oklch(0.91 0.01 265)',
  '--chat-foreground': 'oklch(0.25 0.05 265)',
  '--chat-muted': 'oklch(0.5 0.03 265)',
  '--chat-dim': 'oklch(0.62 0.025 265)',
  '--chat-accent': 'oklch(0.31 0.075 265)',
  '--chat-accent-foreground': 'oklch(1 0 0)',
  ...RADIUS_VARIABLES.rounded,
};

const isRadius = (value: unknown): value is RadiusStyle =>
  value === 'square' || value === 'rounded' || value === 'pill';

export function sanitizeTheme(raw: unknown): ThemeValues {
  if (!raw || typeof raw !== 'object') return {};
  const input = raw as Record<string, unknown>;
  const clean: ThemeValues = {};

  for (const key of Object.keys(COLOR_VARIABLES) as (keyof typeof COLOR_VARIABLES)[]) {
    const value = input[key];
    if (typeof value === 'string' && COLOR_PATTERN.test(value.trim())) clean[key] = value.trim();
  }
  if (isRadius(input.radius)) clean.radius = input.radius;
  if (typeof input.font === 'string' && FONT_PATTERN.test(input.font.trim())) {
    clean.font = input.font.trim();
  }
  return clean;
}

export function mergeTheme(base: ThemeValues, later: ThemeValues): ThemeValues {
  const merged: Record<string, string | undefined> = { ...base };
  for (const [key, value] of Object.entries(later)) {
    if (value !== undefined) merged[key] = value;
  }
  return merged as ThemeValues;
}

export function themeToCssVariables(theme: ThemeValues): Record<string, string> {
  const variables: Record<string, string> = {};
  for (const [key, variable] of Object.entries(COLOR_VARIABLES)) {
    const value = theme[key as keyof typeof COLOR_VARIABLES];
    if (value) variables[variable] = value;
  }
  if (theme.muted) variables['--chat-dim'] = theme.muted;
  if (isRadius(theme.radius)) Object.assign(variables, RADIUS_VARIABLES[theme.radius]);
  if (theme.font) variables['--chat-font-family'] = `'${theme.font}', var(--font-sans)`;
  return variables;
}
