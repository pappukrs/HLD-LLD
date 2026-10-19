// L03 demo: composition over inheritance with a notifier.
// Run: npx tsx lld/1-foundations/L03-composition-over-inheritance/demo.ts
export {};

console.log('--- 1. Inheritance: one class per combination ---');
const classesWithInheritance = (channels: number, features: number) => channels * 2 ** features;
const classesWithComposition = (channels: number, features: number) => channels + features + 1;
for (const [c, f] of [[2, 1], [2, 2], [3, 3], [4, 3]] as const) {
  console.log(`  ${c} channels, ${f} optional features: inheritance ${String(classesWithInheritance(c, f)).padStart(2)} classes, composition ${classesWithComposition(c, f)}`);
}

console.log('\n--- 2. Fragile base class: a child that depends on parent internals ---');
class CountingMap<K, V> extends Map<K, V> {
  writes = 0;
  override set(k: K, v: V) { this.writes++; return super.set(k, v); }
}
const inherited = new CountingMap([['a', 1], ['b', 2]]);
console.log(`  extends Map:  size=${inherited.size} writes=${inherited.writes}  <- wrong: Map's constructor called set() before 'writes = 0' ran`);

class ComposedCountingMap<K, V> {
  private readonly map = new Map<K, V>();
  writes = 0;
  constructor(entries: [K, V][] = []) { for (const [k, v] of entries) this.set(k, v); }
  set(k: K, v: V) { this.writes++; this.map.set(k, v); return this; }
  get size() { return this.map.size; }
}
const composed = new ComposedCountingMap([['a', 1], ['b', 2]]);
console.log(`  has a Map:    size=${composed.size} writes=${composed.writes}  <- correct: only the public contract is used`);

console.log('\n--- 3. Composition: a notifier with parts ---');
type SendFn = (to: string, msg: string) => Promise<void>;
interface Channel { readonly name: string; send: SendFn; }
interface SendPolicy { wrap(next: SendFn): SendFn; }

class EmailChannel implements Channel {
  readonly name = 'email';
  private calls = 0;
  async send(to: string, msg: string) {
    this.calls++;
    if (this.calls === 1) throw new Error('SMTP timeout'); // first call fails, to show retry
    console.log(`    [email] to ${to}: ${msg}`);
  }
}
class SmsChannel implements Channel {
  readonly name = 'sms';
  async send(to: string, msg: string) { console.log(`    [sms]   to ${to}: ${msg}`); }
}
class FakeChannel implements Channel {
  readonly name = 'fake';
  readonly sent: string[] = [];
  async send(to: string, msg: string) { this.sent.push(`${to}:${msg}`); }
}

class LoggingPolicy implements SendPolicy {
  wrap(next: SendFn): SendFn {
    return async (to, msg) => {
      console.log(`    log: sending to ${to}`);
      await next(to, msg);
      console.log('    log: done');
    };
  }
}
class RetryPolicy implements SendPolicy {
  constructor(private readonly attempts: number) {}
  wrap(next: SendFn): SendFn {
    return async (to, msg) => {
      for (let i = 1; ; i++) {
        try { return await next(to, msg); } catch (e) {
          console.log(`    retry: attempt ${i} failed (${(e as Error).message})`);
          if (i >= this.attempts) throw e;
        }
      }
    };
  }
}

class Notifier {
  constructor(private channel: Channel, private readonly policies: SendPolicy[] = []) {}
  setChannel(c: Channel) { this.channel = c; }
  get channelName() { return this.channel.name; }
  send(to: string, msg: string): Promise<void> {
    const base: SendFn = (t, m) => this.channel.send(t, m);
    const fn = this.policies.reduceRight<SendFn>((next, p) => p.wrap(next), base);
    return fn(to, msg);
  }
}

async function main() {
  const notifier = new Notifier(new EmailChannel(), [new LoggingPolicy(), new RetryPolicy(3)]);
  console.log(`  channel=${notifier.channelName}, policies=[logging, retry(3)]`);
  await notifier.send('pappu@example.com', 'Your payment of 499 succeeded');

  console.log('\n--- 4. Swap the part at runtime (user prefers SMS) ---');
  notifier.setChannel(new SmsChannel());
  console.log(`  same notifier object, channel=${notifier.channelName}`);
  await notifier.send('+91-98xxxxxx01', 'OTP 482913');

  console.log('\n--- 5. Test with a fake part: no network ---');
  const fake = new FakeChannel();
  await new Notifier(fake).send('u1', 'hello');
  console.log('  fake.sent =', fake.sent);
}

main().catch((e) => { console.error(e); process.exit(1); });
