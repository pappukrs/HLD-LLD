// P15 · Template Method
// Run: npx tsx lld/concepts/patterns/p15-template-method.ts
import { Readable, Transform, Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

interface Notification {
  id: string;
  to: string;
  template: string;
  vars: Record<string, string>;
}

const auditLog: string[] = [];

// ---------- before: copied flows drift apart ----------
class SmsSenderBefore {
  async send(n: Notification): Promise<string> {
    const body = n.template.replace(/\{(\w+)\}/g, (_, k: string) => n.vars[k] ?? '').slice(0, 160);
    return `sms_${n.to}: ${body}`; // no validation, no audit log
  }
}

// ---------- after: the skeleton lives in the base class ----------
abstract class NotificationSender {
  protected abstract readonly channel: string;

  // the template method: do not override
  async send(n: Notification): Promise<string> {
    this.validate(n);
    const body = this.render(n);
    const id = await this.deliver(n.to, body);
    auditLog.push(`${this.channel}:${n.id}:${id}`); // shared step, always runs
    this.afterSend(n, id);
    return id;
  }

  protected abstract validate(n: Notification): void;
  protected abstract deliver(to: string, body: string): Promise<string>;
  protected render(n: Notification): string {
    return n.template.replace(/\{(\w+)\}/g, (_, k: string) => n.vars[k] ?? '');
  }
  protected afterSend(_n: Notification, _id: string): void {} // hook
}

class EmailSender extends NotificationSender {
  protected readonly channel: string = 'EMAIL';
  protected validate(n: Notification) {
    if (!n.to.includes('@')) throw new Error(`bad email ${n.to}`);
  }
  protected async deliver(to: string, body: string) {
    console.log(`  EMAIL to ${to}: ${body}`);
    return `em_${seq++}`;
  }
}

class SmsSender extends NotificationSender {
  protected readonly channel: string = 'SMS';
  protected validate(n: Notification) {
    if (!/^\d{10}$/.test(n.to)) throw new Error(`bad phone ${n.to}`);
  }
  protected render(n: Notification) {
    return super.render(n).slice(0, 40); // short for the demo; real SMS limit is 160
  }
  protected async deliver(to: string, body: string) {
    console.log(`  SMS to ${to}: ${body}`);
    return `sms_${seq++}`;
  }
}

class WhatsAppSender extends SmsSender {
  protected readonly channel: string = 'WHATSAPP';
  protected afterSend(n: Notification, id: string) {
    console.log(`  (hook) waiting for delivery receipt of ${id} for ${n.id}`);
  }
}
let seq = 1;

// ---------- Node streams: _transform is a step in Node's template ----------
class MaskCardNumbers extends Transform {
  _transform(chunk: Buffer, _enc: BufferEncoding, cb: (err: Error | null, data?: string) => void) {
    cb(null, chunk.toString().replace(/\b(\d{4})\d{8}(\d{4})\b/g, '$1********$2'));
  }
}

async function main() {
  const msg: Notification = {
    id: 'ntf_1',
    to: '9876543210',
    template: 'Hi {name}, Rs {amount} was debited from your account for order {order}.',
    vars: { name: 'Asha', amount: '499', order: 'ord_77' },
  };

  console.log('--- before ---');
  console.log(' ', await new SmsSenderBefore().send({ ...msg, to: 'not-a-phone' }), '(accepted a bad phone, no audit)');

  console.log('\n--- after ---');
  const senders: NotificationSender[] = [new SmsSender(), new EmailSender(), new WhatsAppSender()];
  for (const s of senders) {
    const to = s instanceof EmailSender ? 'asha@example.com' : msg.to;
    await s.send({ ...msg, to });
  }
  try {
    await new SmsSender().send({ ...msg, to: 'not-a-phone' });
  } catch (e) {
    console.log(`  expected error: ${(e as Error).message}`);
  }
  console.log('  audit log:', auditLog);

  console.log('\n--- Node Transform stream fills a step of the stream template ---');
  const chunks: string[] = [];
  await pipeline(
    Readable.from(['card 4111111111111111 charged\n']),
    new MaskCardNumbers(),
    new Writable({
      write(chunk: Buffer, _enc, cb) { chunks.push(chunk.toString()); cb(); },
    }),
  );
  console.log(' ', chunks.join('').trim());
}

await main();

export {};
