// L18 Bridge: message kind (abstraction) x delivery channel (implementor). M + N classes, not M x N.
// Run: npx tsx lld/3-structural/L18-bridge/demo.ts

// ---------- Implementor side: HOW it is delivered ----------
interface Channel {
  readonly name: string;
  readonly maxLength: number;
  deliver(to: string, body: string): Promise<void>;
}

class EmailChannel implements Channel {
  readonly name = 'email'; readonly maxLength = 100_000;
  async deliver(to: string, body: string): Promise<void> { console.log(`    [email -> ${to}] ${body}`); }
}
class SmsChannel implements Channel {
  readonly name = 'sms'; readonly maxLength = 60; // shortened so the trimming is visible
  down = false;
  async deliver(to: string, body: string): Promise<void> {
    if (this.down) throw new Error('SMS gateway 503');
    console.log(`    [sms   -> ${to}] ${body}`);
  }
}
class PushChannel implements Channel {
  readonly name = 'push'; readonly maxLength = 120;
  async deliver(to: string, body: string): Promise<void> { console.log(`    [push  -> ${to}] ${body}`); }
}

// ---------- Abstraction side: WHAT is sent ----------
abstract class Notification {
  constructor(protected channel: Channel) {} // the bridge
  setChannel(c: Channel): void { this.channel = c; }
  protected abstract body(): string;
  async send(to: string): Promise<void> {
    const full = this.body();
    const text = full.length > this.channel.maxLength ? full.slice(0, this.channel.maxLength - 3) + '...' : full;
    await this.channel.deliver(to, text);
  }
}

class OtpNotification extends Notification {
  constructor(ch: Channel, private code: string) { super(ch); }
  protected body(): string { return `OTP ${this.code}. Valid 5 min. Never share it.`; }
}
class OrderAlert extends Notification {
  constructor(ch: Channel, private orderId: string, private eta: string) { super(ch); }
  protected body(): string { return `Order ${this.orderId} is out for delivery. Arriving by ${this.eta}. Track it in the app.`; }
}
class Marketing extends Notification {
  constructor(ch: Channel, private offer: string) { super(ch); }
  protected body(): string { return `Weekend sale: ${this.offer}. Reply STOP to opt out.`; }
}

async function sendWithFallback(n: Notification, to: string, channels: Channel[]): Promise<string> {
  for (const ch of channels) {
    try {
      n.setChannel(ch);
      await n.send(to);
      return ch.name;
    } catch (e) {
      console.log(`    ${ch.name} failed (${(e as Error).message}), trying next`);
    }
  }
  throw new Error('ALL_CHANNELS_FAILED');
}

async function main(): Promise<void> {
  const email = new EmailChannel(), sms = new SmsChannel(), push = new PushChannel();

  console.log('== 1. Any kind x any channel, no OtpSms / AlertEmail classes');
  const kinds = (ch: Channel): Notification[] => [
    new OtpNotification(ch, '482913'),
    new OrderAlert(ch, 'ORD-77', '7:40 pm'),
    new Marketing(ch, 'flat 20% off shoes'),
  ];
  for (const ch of [email, sms, push]) {
    console.log(`  channel=${ch.name} (maxLength ${ch.maxLength})`);
    for (const n of kinds(ch)) await n.send('pappu');
  }

  console.log('\n== 2. Class count');
  for (const [m, n] of [[3, 3], [3, 4], [5, 6], [10, 8]]) {
    console.log(`  ${m} kinds x ${n} channels: inheritance ${String(m * n).padStart(2)} classes, bridge ${String(m + n).padStart(2)} classes`);
  }

  console.log('\n== 3. Add WhatsApp: ONE new class, every kind can use it');
  class WhatsAppChannel implements Channel {
    readonly name = 'whatsapp'; readonly maxLength = 4096;
    async deliver(to: string, body: string): Promise<void> { console.log(`    [wa    -> ${to}] ${body}`); }
  }
  const wa = new WhatsAppChannel();
  for (const n of kinds(wa)) await n.send('pappu');

  console.log('\n== 4. Add a Reminder kind: ONE new class, every channel can carry it');
  class Reminder extends Notification {
    constructor(ch: Channel, private what: string) { super(ch); }
    protected body(): string { return `Reminder: ${this.what}`; }
  }
  for (const ch of [email, sms, push, wa]) await new Reminder(ch, 'EMI due tomorrow').send('pappu');

  console.log('\n== 5. Runtime switch: SMS is down, the same OTP goes out on WhatsApp');
  sms.down = true;
  const used = await sendWithFallback(new OtpNotification(sms, '771204'), '+91-98xxxx', [sms, wa, email]);
  console.log(`  delivered via ${used}`);

  console.log('\nTakeaway: the kind decides WHAT to say, the channel decides HOW to deliver; each side grows on its own.');
}

main();

export {};
