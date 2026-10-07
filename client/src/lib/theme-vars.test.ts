import { readFileSync } from 'node:fs';

import {
  CSS_COLOR,
  CSS_SIZE,
  FONT_NAME,
  SiteSettingsInputSchema,
  WidgetThemeSchema,
} from '@myra/contracts';
import { describe, expect, it } from 'vitest';

import {
  COLOR_PATTERN,
  DEFAULT_VARIABLES,
  FONT_PATTERN,
  mergeTheme,
  RADIUS_VARIABLES,
  sanitizeTheme,
  SIZE_PATTERN,
  themeToCssVariables,
} from './theme-vars';

describe('the loader and the contracts agree on what is allowed', () => {
  // The loader cannot import zod, so it repeats the rules. These tests are what keep it honest.
  it('use the same patterns', () => {
    expect(COLOR_PATTERN.source).toBe(CSS_COLOR.source);
    expect(SIZE_PATTERN.source).toBe(CSS_SIZE.source);
    expect(FONT_PATTERN.source).toBe(FONT_NAME.source);
  });

  const theme = {
    accent: '#162E56',
    accentForeground: 'rgb(255 255 255)',
    surface: 'white',
    raised: 'red; background:url(//evil)',
    foreground: 'oklch(0.25 0.05 265)',
    muted: 'url(javascript:x)',
    border: '#dde3ee',
    radius: 'pill',
    font: 'Inter; } body {',
  };

  it('keep and drop exactly the same values', () => {
    expect(sanitizeTheme(theme)).toEqual(WidgetThemeSchema.parse(theme));
  });

  it('accept the same valid look', () => {
    const valid = { accent: '#162E56', radius: 'square', font: 'Open Sans' } as const;
    expect(sanitizeTheme(valid)).toEqual(valid);
    expect(SiteSettingsInputSchema.safeParse({ theme: valid }).success).toBe(true);
  });
});

describe('theme variables', () => {
  it('turns a theme into the CSS custom properties the chat reads', () => {
    expect(
      themeToCssVariables({ accent: '#162E56', muted: '#7d8aa8', radius: 'square', font: 'Inter' }),
    ).toMatchObject({
      '--chat-accent': '#162E56',
      '--chat-muted': '#7d8aa8',
      '--chat-dim': '#7d8aa8',
      '--chat-radius-window': '0px',
      '--chat-radius-launcher': '0px',
      '--chat-font-family': "'Inter', var(--font-sans)",
    });
  });

  it('lets an override win without a missing override wiping the server value', () => {
    const merged = mergeTheme(
      { accent: '#111111', radius: 'pill' },
      { accent: '#222222', radius: undefined },
    );
    expect(merged).toEqual({ accent: '#222222', radius: 'pill' });
  });

  it('ignores anything that is not an object', () => {
    expect(sanitizeTheme(null)).toEqual({});
    expect(sanitizeTheme('red')).toEqual({});
  });

  it('has a default look for every colour the stylesheet reads', () => {
    for (const variable of Object.values(
      themeToCssVariables({
        accent: 'red',
        accentForeground: 'red',
        surface: 'red',
        raised: 'red',
        foreground: 'red',
        muted: 'red',
        border: 'red',
      }),
    )) {
      expect(variable).toBe('red');
    }
    expect(Object.keys(DEFAULT_VARIABLES)).toEqual(
      expect.arrayContaining(['--chat-accent', '--chat-surface', '--chat-dim']),
    );
  });
});

describe('the loader and the chat stylesheet start from the same look', () => {
  it('declares identical default variables in widget.css and in the loader', () => {
    const css = readFileSync('widget/widget.css', 'utf8');
    const block = /:host\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
    const declared = Object.fromEntries(
      [...block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2]?.trim()]),
    );
    expect(declared).toEqual(DEFAULT_VARIABLES);
    expect(RADIUS_VARIABLES.rounded).toMatchObject({ '--chat-radius-window': '1rem' });
  });
});
