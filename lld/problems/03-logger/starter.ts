// 03 · Logger framework: your implementation goes here.
// Keep the exported names and signatures; the tests import them.
// Run: npx vitest run lld/problems/03-logger

export const LOG_LEVELS = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

export interface LogRecord {
  readonly level: LogLevel;
  readonly logger: string;
  readonly message: string;
  readonly timestamp: number;
  readonly context?: Record<string, unknown>;
}

export interface Formatter {
  format(record: LogRecord): string;
}

export interface Sink {
  write(line: string, record: LogRecord): void;
}

export interface LogHandlerOptions {
  minLevel: LogLevel;
  sink: Sink;
  formatter?: Formatter; // default: TextFormatter
  onError?: (error: unknown) => void; // default: write to stderr
}

export interface LoggerOptions {
  name: string;
  handler: LogHandler;
  level?: LogLevel; // default: INFO
  clock?: () => number;
}

export interface LogManagerConfig {
  handler: LogHandler;
  level?: LogLevel;
  clock?: () => number;
}

export class TextFormatter implements Formatter {
  format(r: LogRecord): string {
    throw new Error('TODO: "<ISO time> [LEVEL] logger: message" + " <context JSON>" if context');
  }
}

export class JsonFormatter implements Formatter {
  format(r: LogRecord): string {
    throw new Error('TODO: { timestamp (ISO), level, logger, message, context? }');
  }
}

export class ConsoleSink implements Sink {
  write(line: string, record: LogRecord): void {
    throw new Error('TODO: ERROR and FATAL to console.error, the rest to console.log');
  }
}

export class MemorySink implements Sink {
  readonly lines: string[] = [];

  write(line: string): void {
    throw new Error('TODO');
  }
}

export class LogHandler {
  constructor(options: LogHandlerOptions) {
    // TODO
  }

  /** Returns `next`, so you can write a.setNext(b).setNext(c). */
  setNext(next: LogHandler): LogHandler {
    throw new Error('TODO');
  }

  handle(record: LogRecord): void {
    throw new Error('TODO: write if level >= minLevel, never throw, then pass to next');
  }
}

export class Logger {
  readonly name: string = '';

  constructor(options: LoggerOptions) {
    // TODO
  }

  setLevel(level: LogLevel): void {
    throw new Error('TODO');
  }

  isEnabled(level: LogLevel): boolean {
    throw new Error('TODO');
  }

  log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    throw new Error('TODO');
  }

  debug(message: string, context?: Record<string, unknown>): void {
    throw new Error('TODO');
  }

  info(message: string, context?: Record<string, unknown>): void {
    throw new Error('TODO');
  }

  warn(message: string, context?: Record<string, unknown>): void {
    throw new Error('TODO');
  }

  error(message: string, context?: Record<string, unknown>): void {
    throw new Error('TODO');
  }

  fatal(message: string, context?: Record<string, unknown>): void {
    throw new Error('TODO');
  }
}

export class LogManager {
  private constructor() {}

  /** Applies to loggers created after this call. */
  static configure(config: LogManagerConfig): void {
    throw new Error('TODO');
  }

  static getLogger(name: string): Logger {
    throw new Error('TODO: one Logger per name');
  }

  static reset(): void {
    throw new Error('TODO: clear loggers and config');
  }
}
