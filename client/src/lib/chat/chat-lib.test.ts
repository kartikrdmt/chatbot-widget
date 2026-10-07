import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DeltaGate } from './delta-gate';
import { ReplaceableTimer } from './replaceable-timer';

describe('DeltaGate', () => {
  it('lets a reply through in order and drops repeats and late arrivals', () => {
    const gate = new DeltaGate();
    expect([0, 1, 1, 2, 0, 3].map((seq) => gate.accept('m1', seq))).toEqual([
      true,
      true,
      false,
      true,
      false,
      true,
    ]);
  });

  it('tracks each reply on its own', () => {
    const gate = new DeltaGate();
    expect(gate.accept('a', 0)).toBe(true);
    expect(gate.accept('b', 0)).toBe(true);
    expect(gate.accept('a', 0)).toBe(false);
  });

  it('accepts pieces that carry no number (an older server)', () => {
    const gate = new DeltaGate();
    expect(gate.accept('m1')).toBe(true);
    expect(gate.accept('m1')).toBe(true);
  });

  it('drops every piece that arrives after the reply is finished', () => {
    const gate = new DeltaGate();
    gate.accept('m1', 0);
    gate.finish('m1');
    expect(gate.accept('m1', 1)).toBe(false);
    expect(gate.accept('m1')).toBe(false);
    expect(gate.accept('m2', 0)).toBe(true);
  });
});

describe('ReplaceableTimer', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('fires once after its delay', () => {
    const timer = new ReplaceableTimer();
    const fired = vi.fn();
    timer.set(fired, 1_000);
    vi.advanceTimersByTime(999);
    expect(fired).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fired).toHaveBeenCalledTimes(1);
  });

  it('a new one replaces the old one, so the old one never fires', () => {
    const timer = new ReplaceableTimer();
    const first = vi.fn();
    const second = vi.fn();
    timer.set(first, 1_000);
    timer.set(second, 5_000);
    vi.advanceTimersByTime(10_000);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('can be cancelled', () => {
    const timer = new ReplaceableTimer();
    const fired = vi.fn();
    timer.set(fired, 1_000);
    timer.clear();
    vi.advanceTimersByTime(5_000);
    expect(fired).not.toHaveBeenCalled();
  });
});
