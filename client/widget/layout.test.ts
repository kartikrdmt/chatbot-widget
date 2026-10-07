import { describe, expect, it } from 'vitest';

import { floatingLayout, isPosition, panelOrigin, POSITIONS, toCssSize } from './layout';

const layout = (position: (typeof POSITIONS)[number], expanded = false) =>
  floatingLayout({ position, offset: 24, width: '380px', height: '600px', expanded });

describe('floating layout', () => {
  it('knows exactly eight positions', () => {
    expect(POSITIONS).toHaveLength(8);
    expect(isPosition('bottom-center')).toBe(true);
    expect(isPosition('middle')).toBe(false);
    expect(isPosition(undefined)).toBe(false);
  });

  it.each([
    ['bottom-right', { bottom: 24, right: 24 }],
    ['bottom-left', { bottom: 24, left: 24 }],
    ['top-right', { top: 24, right: 24 }],
    ['top-left', { top: 24, left: 24 }],
  ] as const)('pins the launcher of %s to its corner', (position, edges) => {
    expect(layout(position).launcher).toEqual(edges);
  });

  it('centres the launcher with auto margins on the centred axis', () => {
    expect(layout('bottom-center').launcher).toMatchObject({
      bottom: 24,
      left: 0,
      right: 0,
      marginLeft: 'auto',
      marginRight: 'auto',
    });
    expect(layout('left-center').launcher).toMatchObject({
      left: 24,
      top: 0,
      bottom: 0,
      marginTop: 'auto',
      marginBottom: 'auto',
    });
  });

  it('puts the panel above or below the launcher, or beside it when it sits mid-edge', () => {
    expect(layout('bottom-right').panel).toMatchObject({ bottom: 96, right: 24 });
    expect(layout('top-left').panel).toMatchObject({ top: 96, left: 24 });
    expect(layout('left-center').panel).toMatchObject({ left: 96, top: 0, bottom: 0 });
    expect(layout('right-center').panel).toMatchObject({ right: 96 });
  });

  it('never lets the panel outgrow the screen', () => {
    expect(layout('bottom-right').panel.width).toBe('min(380px, calc(100vw - 48px))');
    expect(layout('bottom-right').panel.height).toBe('min(600px, calc(100vh - 120px))');
  });

  it('expands from the same corner, so it grows out of the launcher', () => {
    const compact = layout('bottom-right').panel;
    const expanded = layout('bottom-right', true).panel;
    expect(Object.keys(expanded)).toEqual(expect.arrayContaining(['bottom', 'right']));
    expect(expanded).toMatchObject({ bottom: 0, right: 0, width: '100vw', height: '100dvh' });
    expect(compact).toMatchObject({ bottom: 96, right: 24 });
    expect(layout('bottom-right', true).launcher).toMatchObject({ display: 'none' });
  });

  it.each([
    ['bottom-right', 'bottom right'],
    ['top-left', 'top left'],
    ['bottom-center', 'bottom center'],
    ['left-center', 'center left'],
  ] as const)('unfolds %s from %s', (position, origin) => {
    expect(panelOrigin(position)).toBe(origin);
  });
});

describe('toCssSize', () => {
  it('accepts numbers and plain CSS lengths, and nothing else', () => {
    expect(toCssSize(420, '380px')).toBe('420px');
    expect(toCssSize('420', '380px')).toBe('420px');
    expect(toCssSize('90vw', '380px')).toBe('90vw');
    expect(toCssSize('calc(100vw - 1px)', '380px')).toBe('380px');
    expect(toCssSize('red; x', '380px')).toBe('380px');
    expect(toCssSize(undefined, '380px')).toBe('380px');
  });
});
