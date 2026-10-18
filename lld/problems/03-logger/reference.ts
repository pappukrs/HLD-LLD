// 03 · Logger framework: reference solution.
// Read this only after your own attempt passes (or after 60 minutes).

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

// Comparing indexes keeps the level order in one place.
const rank = (level: LogLevel): number => LOG_LEVELS.indexOf(level);

export class TextFormatter implements Formatter {
  format(r: LogRecord): string {
    const base = `${new Date(r.timestamp).toISOString()} [${r.level}] ${r.logger}: ${r.message}`;
    return r.context ? `${base} ${JSON.stringify(r.context)}` : base;
  }
}

export class JsonFormatter implements Formatter {
  format(r: LogRecord): string {
    // Context goes under its own key so it can never overwrite level or message.
    return JSON.stringify({
      timestamp: new Date(r.timestamp).toISOString(),
      level: r.level,
      logger: r.logger,
      message: r.message,
      ...(r.context ? { context: r.context } : {}),
    });
  }
}

export class ConsoleSink implements Sink {
  write(line: string, record: LogRecord): void {
    if (rank(record.level) >= rank('ERROR')) console.error(line);
    else console.log(line);
  }
}

export class MemorySink implements Sink {
  readonly lines: string[] = [];

  write(line: string): void {
    this.lines.push(line);
  }
}

// Chain of Responsibility: every handler sees every record, writes it if the
// level is high enough, then passes it on. Adding a destination = adding a link.
export class LogHandler {
  private next: LogHandler | null = null;
  private readonly minLevel: LogLevel;
  private readonly sink: Sink;
  private readonly formatter: Formatter;
  private readonly onError: (error: unknown) => void;

  constructor(options: LogHandlerOptions) {
    this.minLevel = options.minLevel;
    this.sink = options.sink;
    this.formatter = options.formatter ?? new TextFormatter();
    this.onError = options.onError ?? ((e) => process.stderr.write(`Log sink failed: ${String(e)}\n`));
  }

  /** Returns `next`, so you can write a.setNext(b).setNext(c). */
  setNext(next: LogHandler): LogHandler {
    this.next = next;
    return next;
  }

  handle(record: LogRecord): void {
    if (rank(record.level) >= rank(this.minLevel)) {
      // Logging must never crash the caller or block the other handlers.
      try {
        this.sink.write(this.formatter.format(record), record);
      } catch (e) {
        this.onError(e);
      }
    }
    this.next?.handle(record);
  }
}

export class Logger {
  readonly name: string;
  private level: LogLevel;
  private readonly handler: LogHandler;
  private readonly clock: () => number;

  constructor(options: LoggerOptions) {
    this.name = options.name;
    this.handler = options.handler;
    this.level = options.level ?? 'INFO';
    this.clock = options.clock ?? Date.now;
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  isEnabled(level: LogLevel): boolean {
    return rank(level) >= rank(this.level);
  }

  log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    // Cheap check first, so disabled DEBUG calls cost almost nothing.
    if (!this.isEnabled(level)) return;
    this.handler.handle({ level, logger: this.name, message, timestamp: this.clock(), context });
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.log('DEBUG', message, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.log('INFO', message, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.log('WARN', message, context);
  }

  error(message: string, context?: Record<string, unknown>): void {
    this.log('ERROR', message, context);
  }

  fatal(message: string, context?: Record<string, unknown>): void {
    this.log('FATAL', message, context);
  }
}

const defaultConfig = (): LogManagerConfig => ({
  handler: new LogHandler({ minLevel: 'DEBUG', sink: new ConsoleSink() }),
});

// Singleton registry: one Logger per name for the whole process.
// reset() exists because global state leaks between tests otherwise.
export class LogManager {
  private static config: LogManagerConfig = defaultConfig();
  private static readonly loggers = new Map<string, Logger>();

  private constructor() {}

  /** Applies to loggers created after this call. */
  static configure(config: LogManagerConfig): void {
    LogManager.config = config;
  }

  static getLogger(name: string): Logger {
    let logger = LogManager.loggers.get(name);
    if (!logger) {
      const { handler, level, clock } = LogManager.config;
      logger = new Logger({ name, handler, level, clock });
      LogManager.loggers.set(name, logger);
    }
    return logger;
  }

  static reset(): void {
    LogManager.loggers.clear();
    LogManager.config = defaultConfig();
  }
}
