import type { LogLevel } from '@nestjs/common';

const ORDER: LogLevel[] = ['fatal', 'error', 'warn', 'log', 'debug', 'verbose'];

const NAMES: Record<string, LogLevel> = {
  fatal: 'fatal',
  error: 'error',
  warn: 'warn',
  warning: 'warn',
  info: 'log',
  log: 'log',
  debug: 'debug',
  verbose: 'verbose',
};

/** `LOG_LEVEL=info` shows info, warnings and errors; `debug` adds the debug lines. Unknown = info. */
export function logLevels(level: string | undefined): LogLevel[] {
  const wanted = NAMES[(level ?? 'info').trim().toLowerCase()] ?? 'log';
  return ORDER.slice(0, ORDER.indexOf(wanted) + 1);
}
