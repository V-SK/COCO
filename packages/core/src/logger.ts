import pino, { type Logger } from 'pino';

export function createLogger(): Logger {
  return pino({
    name: 'coco',
    level: process.env.LOG_LEVEL ?? 'info',
  });
}
