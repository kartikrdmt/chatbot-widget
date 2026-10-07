import { describe, expect, it } from 'vitest';

import { parseConfig } from './parse-config';

describe('parseConfig', () => {
  it('opens the chat with defaults when the config is unreadable', () => {
    for (const raw of [null, undefined, 'text', 42, []]) {
      const config = parseConfig(raw);
      expect(config.copy.title).toBe('How can we help?');
      expect(config.launcher.position).toBe('bottom-right');
    }
  });

  it('keeps the good fields and defaults the bad ones', () => {
    const config = parseConfig({
      copy: { title: 'Acme Support', greeting: 'g'.repeat(900) },
      launcher: { offset: 5_000 },
    });
    expect(config.copy.title).toBe('Acme Support');
    expect(config.copy.greeting).toBe('Hi there! How can I help you today?');
    expect(config.launcher.offset).toBe(24);
  });
});
