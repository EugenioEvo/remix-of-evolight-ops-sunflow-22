type LogLevel = 'info' | 'warn' | 'error' | 'debug';

const formatTimestamp = (): string => new Date().toISOString();

const formatMessage = (level: LogLevel, args: unknown[]): [string, ...unknown[]] => {
  const prefix = `[${formatTimestamp()}] [${level.toUpperCase()}]`;
  if (typeof args[0] === 'string') {
    return [`${prefix} ${args[0]}`, ...args.slice(1)];
  }
  return [prefix, ...args];
};

const shouldLog = (level: LogLevel): boolean => {
  if (import.meta.env.PROD) {
    return level === 'error';
  }
  return true;
};

const logger = {
  info: (...args: unknown[]): void => {
    if (!shouldLog('info')) return;
    console.log(...formatMessage('info', args));
  },

  warn: (...args: unknown[]): void => {
    if (!shouldLog('warn')) return;
    console.warn(...formatMessage('warn', args));
  },

  error: (...args: unknown[]): void => {
    if (!shouldLog('error')) return;
    console.error(...formatMessage('error', args));
  },

  debug: (...args: unknown[]): void => {
    if (!shouldLog('debug')) return;
    console.debug(...formatMessage('debug', args));
  },
};

export default logger;
