// L14 · Decorator: run with `npx tsx lld/3-structural/L14-decorator/demo.ts`
// Domain: a Notifier wrapped with retry, logging and rate limiting. Shows that the order of layers
// changes behaviour, and the same idea as plain higher-order functions.

export {};

const section = (t: string) => console.log(`\n=== ${t} ===`);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Message { to: string; body: string; idempotencyKey: string }
interface Notifier { send(msg: Message): Promise<string> }

// ---------- the plain core ----------
class EmailNotifier implements Notifier {
  calls = 0;
  constructor(private failFirst = 0) {}
  async send(msg: Message) {
    this.calls++;
    if (this.calls <= this.failFirst) throw new Error('SMTP timeout');
    return `250 OK to ${msg.to}`;
  }
}

// ---------- decorators: same interface, hold an inner Notifier ----------
class RetryNotifier implements Notifier {
  constructor(private inner: Notifier, private tries = 3, private baseMs = 5) {}
  async send(msg: Message) {
    for (let i = 1; ; i++) {
      try { return await this.inner.send(msg); } catch (e) {
        if (i >= this.tries) throw e;
        await sleep(this.baseMs * 2 ** i); // exponential backoff (tiny for the demo)
      }
    }
  }
}

class LoggingNotifier implements Notifier {
  static lines: string[] = [];
  constructor(private inner: Notifier) {}
  async send(msg: Message) {
    const t = Date.now();
    LoggingNotifier.lines.push(`start ${msg.idempotencyKey}`);
    try {
      const r = await this.inner.send(msg);
      LoggingNotifier.lines.push(`ok in ${Date.now() - t}ms`);
      return r;
    } catch (e) {
      LoggingNotifier.lines.push(`failed: ${(e as Error).message}`);
      throw e;
    }
  }
}

class RateLimitedError extends Error { override name = 'RateLimitedError'; }
class TokenBucket {
  constructor(public tokens: number) {}
  take() { if (this.tokens <= 0) return false; this.tokens--; return true; }
}
class RateLimitNotifier implements Notifier {
  constructor(private inner: Notifier, private bucket: TokenBucket) {}
  send(msg: Message) {
    if (!this.bucket.take()) return Promise.reject(new RateLimitedError('bucket empty'));
    return this.inner.send(msg);
  }
}

// ---------- run one send through a given stack and report what happened ----------
async function run(label: string, build: (core: EmailNotifier, bucket: TokenBucket) => Notifier, opts = { failFirst: 1, tokens: 5 }) {
  const core = new EmailNotifier(opts.failFirst);
  const bucket = new TokenBucket(opts.tokens);
  LoggingNotifier.lines = [];
  const notifier = build(core, bucket);
  let result: string;
  try { result = await notifier.send({ to: 'pappu@example.in', body: 'Receipt #81', idempotencyKey: 'ntf_81' }); }
  catch (e) { result = `${(e as Error).name}: ${(e as Error).message}`; }
  console.log(`${label.padEnd(36)} -> ${result}`);
  console.log(`${''.padEnd(36)}    SMTP calls=${core.calls} tokens used=${opts.tokens - bucket.tokens} log lines=${LoggingNotifier.lines.length}`);
}

// ---------- function form ----------
type Send = (msg: Message) => Promise<string>;
const withRetry = (f: Send, tries = 3): Send => async (m) => {
  for (let i = 1; ; i++) { try { return await f(m); } catch (e) { if (i >= tries) throw e; } }
};
const withTiming = (f: Send, out: string[]): Send => async (m) => {
  const t = Date.now();
  try { return await f(m); } finally { out.push(`took ${Date.now() - t}ms`); }
};

async function main() {
  section('1. Before: subclass explosion');
  console.log('RetryEmail, LoggingEmail, RetryLoggingEmail, RetryLoggingRateLimitedEmail, ... x SMS x Push = 21 classes');

  section('2. Stack: RateLimit(Logging(Retry(Email))), SMTP fails once');
  await run('RateLimit > Logging > Retry > Email', (c, b) => new RateLimitNotifier(new LoggingNotifier(new RetryNotifier(c)), b));

  section('3. Outer layer stops the call (bucket empty)');
  await run('RateLimit > Logging > Retry > Email', (c, b) => new RateLimitNotifier(new LoggingNotifier(new RetryNotifier(c)), b), { failFirst: 0, tokens: 0 });

  section('4. Order matters');
  await run('RateLimit > Retry > Logging > Email', (c, b) => new RateLimitNotifier(new RetryNotifier(new LoggingNotifier(c)), b));
  await run('Retry > RateLimit > Logging > Email', (c, b) => new RetryNotifier(new RateLimitNotifier(new LoggingNotifier(c), b)));
  console.log('-> logging inside retry logs every attempt; retry outside the limiter spends a token per attempt');

  section('5. Same idea with higher-order functions');
  const timings: string[] = [];
  const email = new EmailNotifier(2);
  const send = withTiming(withRetry((m) => email.send(m)), timings);
  console.log(await send({ to: 'ops@example.in', body: 'Alert', idempotencyKey: 'ntf_82' }), '| attempts:', email.calls, '|', timings[0]);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
