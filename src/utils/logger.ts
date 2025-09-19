type Level = 'debug' | 'info' | 'warn' | 'error';

const LOG_PREFIX = '[AICompletion]';
const enabled = true; // Could be toggled via preferences later

function log(level: Level, message: string, ...args: unknown[]): void {
  if (!enabled) return;
  // eslint-disable-next-line no-console
  console[level](`${LOG_PREFIX} ${message}`, ...args);
}

export const logger = {
  debug: (msg: string, ...a: unknown[]): void => log('debug', msg, ...a),
  info: (msg: string, ...a: unknown[]): void => log('info', msg, ...a),
  warn: (msg: string, ...a: unknown[]): void => log('warn', msg, ...a),
  error: (msg: string, ...a: unknown[]): void => log('error', msg, ...a),
};
