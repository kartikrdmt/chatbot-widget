import { logLevels } from './log-levels.js';

describe('logLevels', () => {
  it('hides debug lines by default', () => {
    expect(logLevels(undefined)).toEqual(['fatal', 'error', 'warn', 'log']);
    expect(logLevels('info')).not.toContain('debug');
  });

  it('shows debug lines when asked', () => {
    expect(logLevels('debug')).toContain('debug');
    expect(logLevels('DEBUG')).toContain('debug');
  });

  it('can be quieter', () => {
    expect(logLevels('warn')).toEqual(['fatal', 'error', 'warn']);
    expect(logLevels('error')).toEqual(['fatal', 'error']);
  });

  it('falls back to info for anything it does not know', () => {
    expect(logLevels('loud')).toEqual(['fatal', 'error', 'warn', 'log']);
  });
});
