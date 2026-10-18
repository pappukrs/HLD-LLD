// P04 · Prototype
// Run: npx tsx lld/concepts/patterns/p04-prototype.ts

interface RetryPolicy { max: number; backoffMs: number }
interface Cloneable<T> { clone(): T }

// ---------- before: shallow spread shares nested data ----------
function before() {
  const template = { channel: 'EMAIL', retry: { max: 3, backoffMs: 500 }, tags: ['txn'] };
  const otp = { ...template };
  otp.retry.max = 1;
  otp.tags.push('otp');
  console.log('template after editing the "copy":', template);
}

// ---------- after: prototype with a correct clone() + registry ----------
class NotificationTemplate implements Cloneable<NotificationTemplate> {
  constructor(
    public channel: 'EMAIL' | 'SMS',
    public subject: string,
    public retry: RetryPolicy,
    public tags: string[],
  ) {}

  clone(): NotificationTemplate {
    // deep-copy the parts a clone may change
    return new NotificationTemplate(this.channel, this.subject, { ...this.retry }, [...this.tags]);
  }

  render(vars: Record<string, string>): string {
    return this.subject.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? `{${k}}`);
  }
}

class TemplateRegistry {
  private prototypes = new Map<string, NotificationTemplate>();
  register(name: string, t: NotificationTemplate): void {
    this.prototypes.set(name, t);
  }
  create(name: string): NotificationTemplate {
    const proto = this.prototypes.get(name);
    if (!proto) throw new Error(`No template ${name}`);
    return proto.clone();
  }
}

function after() {
  const registry = new TemplateRegistry();
  registry.register(
    'transactional',
    new NotificationTemplate('EMAIL', 'Payment of {amount} received', { max: 3, backoffMs: 500 }, ['txn']),
  );

  const otp = registry.create('transactional');
  otp.channel = 'SMS';
  otp.subject = 'Your OTP is {otp}';
  otp.retry.max = 1;
  otp.tags.push('otp');

  const receipt = registry.create('transactional');
  console.log('otp      :', otp.channel, otp.retry, otp.tags, '->', otp.render({ otp: '482913' }));
  console.log('receipt  :', receipt.channel, receipt.retry, receipt.tags, '->', receipt.render({ amount: 'Rs 499' }));
  console.log('otp instanceof NotificationTemplate:', otp instanceof NotificationTemplate);
}

// ---------- structuredClone: deep copy for plain data, drops prototypes ----------
function structured() {
  const cart = { id: 'c1', items: [{ sku: 'A', qty: 1 }], createdAt: new Date(0), seen: new Set(['A']) };
  const copy = structuredClone(cart);
  copy.items[0]!.qty = 5;
  console.log('original qty:', cart.items[0]!.qty, '| copy qty:', copy.items[0]!.qty);
  console.log('Date kept:', copy.createdAt instanceof Date, '| Set kept:', copy.seen instanceof Set);

  const t = new NotificationTemplate('EMAIL', 'x', { max: 1, backoffMs: 1 }, []);
  const plain = structuredClone(t);
  console.log('class instance kept by structuredClone:', plain instanceof NotificationTemplate);
}

console.log('--- before: shallow copy ---');
before();
console.log('\n--- after: prototype registry ---');
after();
console.log('\n--- structuredClone ---');
structured();

export {};
