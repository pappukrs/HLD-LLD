import * as starter from './starter';
import * as reference from './reference';
import type { Formatter, LogRecord } from './reference';

// `npm test` checks your starter.ts; `npm run test:ref` checks the reference.
const { Logger, LogHandler, LogManager, MemorySink, TextFormatter, JsonFormatter } = (
  process.env.REF ? reference : starter
) as typeof reference;

const clock = () => 0; // 1970-01-01T00:00:00.000Z

function makeLogger(level?: reference.LogLevel) {
  const sink = new MemorySink();
  const handler = new LogHandler({ minLevel: 'DEBUG', sink });
  const logger = new Logger({ name: 'app', handler, level, clock });
  return { logger, sink };
}

describe('03 · Logger', () => {
  describe('levels', () => {
    it('writes INFO and above by default and drops DEBUG', () => {
      const { logger, sink } = makeLogger();
      logger.debug('d');
      logger.info('i');
      logger.warn('w');
      logger.error('e');
      logger.fatal('f');
      expect(sink.lines).toHaveLength(4);
      expect(sink.lines[0]).toContain('[INFO]');
    });

    it('changes the level at runtime', () => {
      const { logger, sink } = makeLogger('ERROR');
      logger.warn('hidden');
      expect(logger.isEnabled('WARN')).toBe(false);
      logger.setLevel('DEBUG');
      logger.debug('shown');
      expect(logger.isEnabled('DEBUG')).toBe(true);
      expect(sink.lines).toHaveLength(1);
    });
  });

  describe('formatters', () => {
    it('formats plain text with the injected time, level, name and message', () => {
      const { logger, sink } = makeLogger();
      logger.info('server started');
      expect(sink.lines[0]).toBe('1970-01-01T00:00:00.000Z [INFO] app: server started');
    });

    it('appends the context as JSON in text format', () => {
      const { logger, sink } = makeLogger();
      logger.warn('slow query', { ms: 812 });
      expect(sink.lines[0]).toBe('1970-01-01T00:00:00.000Z [WARN] app: slow query {"ms":812}');
    });

    it('formats one JSON object per line', () => {
      const sink = new MemorySink();
      const handler = new LogHandler({ minLevel: 'DEBUG', sink, formatter: new JsonFormatter() });
      new Logger({ name: 'payments', handler, clock }).error('capture failed', { orderId: 'o1' });
      expect(JSON.parse(sink.lines[0])).toEqual({
        timestamp: '1970-01-01T00:00:00.000Z',
        level: 'ERROR',
        logger: 'payments',
        message: 'capture failed',
        context: { orderId: 'o1' },
      });
    });
  });

  describe('chain of handlers', () => {
    it('sends each record to every handler whose level allows it', () => {
      const all = new MemorySink();
      const errors = new MemorySink();
      const head = new LogHandler({ minLevel: 'INFO', sink: all });
      head.setNext(new LogHandler({ minLevel: 'ERROR', sink: errors }));
      const logger = new Logger({ name: 'app', handler: head, level: 'DEBUG', clock });

      logger.debug('d');
      logger.info('i');
      logger.error('e');
      expect(all.lines).toHaveLength(2);
      expect(errors.lines).toHaveLength(1);
      expect(errors.lines[0]).toContain('[ERROR]');
    });

    it('returns the next handler from setNext so chains read left to right', () => {
      const a = new MemorySink();
      const b = new MemorySink();
      const c = new MemorySink();
      const head = new LogHandler({ minLevel: 'DEBUG', sink: a });
      head
        .setNext(new LogHandler({ minLevel: 'DEBUG', sink: b }))
        .setNext(new LogHandler({ minLevel: 'DEBUG', sink: c }));
      new Logger({ name: 'app', handler: head, clock }).info('x');
      expect([a.lines.length, b.lines.length, c.lines.length]).toEqual([1, 1, 1]);
    });

    it('never throws to the caller when a sink fails, and keeps the chain going', () => {
      const errors: unknown[] = [];
      const broken = { write: () => { throw new Error('disk full'); } };
      const good = new MemorySink();
      const head = new LogHandler({ minLevel: 'DEBUG', sink: broken, onError: (e) => errors.push(e) });
      head.setNext(new LogHandler({ minLevel: 'DEBUG', sink: good }));
      const logger = new Logger({ name: 'app', handler: head, clock });

      expect(() => logger.info('hello')).not.toThrow();
      expect(good.lines).toHaveLength(1);
      expect(errors).toHaveLength(1);
    });
  });

  describe('LogManager (singleton registry)', () => {
    afterEach(() => LogManager.reset());

    it('returns the same logger for the same name and a new one for a new name', () => {
      LogManager.configure({ handler: new LogHandler({ minLevel: 'DEBUG', sink: new MemorySink() }) });
      const a1 = LogManager.getLogger('orders');
      const a2 = LogManager.getLogger('orders');
      const b = LogManager.getLogger('payments');
      expect(a1).toBe(a2);
      expect(b).not.toBe(a1);
      expect(b.name).toBe('payments');
    });

    it('builds loggers from the configured handler, level and clock', () => {
      const sink = new MemorySink();
      LogManager.configure({ handler: new LogHandler({ minLevel: 'DEBUG', sink }), level: 'WARN', clock });
      const log = LogManager.getLogger('orders');
      log.info('dropped');
      log.warn('kept');
      expect(sink.lines).toEqual(['1970-01-01T00:00:00.000Z [WARN] orders: kept']);
    });

    it('forgets old loggers after reset', () => {
      LogManager.configure({ handler: new LogHandler({ minLevel: 'DEBUG', sink: new MemorySink() }) });
      const before = LogManager.getLogger('orders');
      LogManager.reset();
      expect(LogManager.getLogger('orders')).not.toBe(before);
    });
  });

  describe('extensibility', () => {
    it('accepts any Formatter, for example one that masks card numbers', () => {
      class MaskingFormatter implements Formatter {
        constructor(private readonly inner: Formatter) {}
        format(r: LogRecord): string {
          return this.inner.format(r).replace(/\b(\d{6})\d{6}(\d{4})\b/g, '$1******$2');
        }
      }
      const sink = new MemorySink();
      const handler = new LogHandler({ minLevel: 'DEBUG', sink, formatter: new MaskingFormatter(new TextFormatter()) });
      new Logger({ name: 'pay', handler, clock }).info('card 4111111111111111 declined');
      expect(sink.lines[0]).toBe('1970-01-01T00:00:00.000Z [INFO] pay: card 411111******1111 declined');
    });
  });
});
