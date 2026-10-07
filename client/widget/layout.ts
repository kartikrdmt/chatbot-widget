import type { CSSProperties } from 'react';

export const POSITIONS = [
  'bottom-right',
  'bottom-left',
  'bottom-center',
  'top-right',
  'top-left',
  'top-center',
  'left-center',
  'right-center',
] as const;

export type Position = (typeof POSITIONS)[number];

export const isPosition = (value: unknown): value is Position =>
  typeof value === 'string' && (POSITIONS as readonly string[]).includes(value);

export const LAUNCHER_SIZE = 56;
const GAP = 16;

type Vertical = 'top' | 'bottom' | 'center';
type Horizontal = 'left' | 'right' | 'center';

const SAFE_SIZE = /^\d*\.?\d+(px|%|vw|vh|dvh|rem|em)$/;

/** A number is pixels; a string must be a plain CSS length. Anything else uses the fallback. */
export function toCssSize(value: unknown, fallback: string): string {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'number' || /^\d+$/.test(String(value))) return `${value}px`;
  return SAFE_SIZE.test(String(value)) ? String(value) : fallback;
}

function parsePosition(position: Position): { vertical: Vertical; horizontal: Horizontal } {
  if (position === 'left-center') return { vertical: 'center', horizontal: 'left' };
  if (position === 'right-center') return { vertical: 'center', horizontal: 'right' };
  const [vertical, horizontal] = position.split('-') as [Vertical, Horizontal];
  return { vertical, horizontal };
}

/** Pins a fixed box to an edge, or centres it on that axis with auto margins. */
function axis(
  where: 'left' | 'right' | 'top' | 'bottom' | 'center',
  start: 'left' | 'top',
  distance: number,
): CSSProperties {
  const horizontal = start === 'left';
  if (where === 'center') {
    return horizontal
      ? { left: 0, right: 0, marginLeft: 'auto', marginRight: 'auto' }
      : { top: 0, bottom: 0, marginTop: 'auto', marginBottom: 'auto' };
  }
  return { [where]: distance };
}

/** The corner or edge the panel grows out of, so it appears to unfold from the launcher. */
export function panelOrigin(position: Position): string {
  const { vertical, horizontal } = parsePosition(position);
  return `${vertical} ${horizontal}`;
}

export interface FloatingLayout {
  launcher: CSSProperties;
  panel: CSSProperties;
}

interface FloatingOptions {
  position: Position;
  offset: number;
  width: string;
  height: string;
  expanded: boolean;
}

export function floatingLayout({
  position,
  offset,
  width,
  height,
  expanded,
}: FloatingOptions): FloatingLayout {
  const { vertical, horizontal } = parsePosition(position);

  const launcher: CSSProperties = {
    ...axis(horizontal, 'left', offset),
    ...axis(vertical, 'top', offset),
  };

  if (expanded) {
    return {
      launcher: { ...launcher, display: 'none' },
      // Same edges as the compact panel, with the gap closed, so it grows out of its own corner.
      panel: {
        ...axis(horizontal, 'left', 0),
        ...axis(vertical, 'top', 0),
        width: '100vw',
        height: '100dvh',
        borderRadius: 0,
        borderWidth: 0,
      },
    };
  }

  // Beside the launcher when it sits mid-edge, above or below it otherwise.
  const beside = vertical === 'center';
  const step = offset + LAUNCHER_SIZE + GAP;
  const reservedX = beside ? offset + step : offset * 2;
  const reservedY = beside ? offset * 2 : offset + step;

  return {
    launcher,
    panel: {
      ...axis(horizontal, 'left', beside ? step : offset),
      ...axis(vertical, 'top', beside ? offset : step),
      width: `min(${width}, calc(100vw - ${reservedX}px))`,
      height: `min(${height}, calc(100vh - ${reservedY}px))`,
    },
  };
}
