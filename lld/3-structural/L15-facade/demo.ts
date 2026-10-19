// L15 Facade: one CheckoutService hides five subsystems, their order, and the rollback.
// Run: npx tsx lld/3-structural/L15-facade/demo.ts

type Item = { sku: string; qty: number; price: number };
type Order = { id: string; userId: string; total: number; txnId: string };

class Inventory {
  private stock = new Map<string, number>([['tshirt', 5], ['mug', 2]]);
  private holds = new Map<string, Item[]>();
  private seq = 0;
  reserve(items: Item[]): string {
    for (const i of items) {
      if ((this.stock.get(i.sku) ?? 0) < i.qty) throw new Error(`OUT_OF_STOCK ${i.sku}`);
    }
    items.forEach((i) => this.stock.set(i.sku, this.stock.get(i.sku)! - i.qty));
    const id = `hold-${++this.seq}`;
    this.holds.set(id, items);
    console.log(`  [inventory] reserved ${id}`);
    return id;
  }
  commit(id: string): void { this.holds.delete(id); console.log(`  [inventory] committed ${id}`); }
  release(id: string): void {
    this.holds.get(id)?.forEach((i) => this.stock.set(i.sku, this.stock.get(i.sku)! + i.qty));
    this.holds.delete(id);
    console.log(`  [inventory] released ${id}`);
  }
  left(sku: string): number { return this.stock.get(sku) ?? 0; }
}

class Pricing {
  total(items: Item[], coupon?: string): number {
    const sum = items.reduce((s, i) => s + i.qty * i.price, 0);
    const total = coupon === 'FLAT100' ? Math.max(0, sum - 100) : sum;
    console.log(`  [pricing] subtotal=${sum} coupon=${coupon ?? '-'} total=${total}`);
    return total;
  }
}

class Payments {
  constructor(private failFor = new Set<string>()) {}
  async charge(userId: string, amount: number): Promise<string> {
    if (this.failFor.has(userId)) throw new Error('CARD_DECLINED');
    console.log(`  [payments] charged ${userId} Rs ${amount}`);
    return `txn-${userId}-${amount}`;
  }
}

class Orders {
  private n = 0;
  create(userId: string, total: number, txnId: string): Order {
    const o = { id: `ord-${++this.n}`, userId, total, txnId };
    console.log(`  [orders] created ${o.id}`);
    return o;
  }
}

class Notifier {
  async send(userId: string, text: string): Promise<void> {
    if (userId === 'slow-mail') throw new Error('SMTP timeout');
    console.log(`  [notifier] -> ${userId}: ${text}`);
  }
}

// ---- The facade: one method, fixed order, compensation in one place ----
class CheckoutService {
  constructor(
    private inventory: Inventory,
    private pricing: Pricing,
    private payments: Payments,
    private orders: Orders,
    private notifier: Notifier,
  ) {}

  async checkout(userId: string, items: Item[], coupon?: string): Promise<Order> {
    const hold = this.inventory.reserve(items);
    try {
      const total = this.pricing.total(items, coupon);
      const txnId = await this.payments.charge(userId, total);
      const order = this.orders.create(userId, total, txnId);
      this.inventory.commit(hold);
      // side effect: never fail or slow a paid order because of email
      void this.notifier
        .send(userId, `Order ${order.id} placed`)
        .catch((e: Error) => console.log(`  [notifier] failed, logged only: ${e.message}`));
      return order;
    } catch (e) {
      this.inventory.release(hold);
      throw e;
    }
  }
}

async function main(): Promise<void> {
  const inventory = new Inventory();
  const shop = new CheckoutService(inventory, new Pricing(), new Payments(new Set(['broke'])), new Orders(), new Notifier());
  const cart: Item[] = [{ sku: 'tshirt', qty: 2, price: 499 }, { sku: 'mug', qty: 1, price: 299 }];

  console.log('== 1. Happy path: the caller makes ONE call');
  const o = await shop.checkout('pappu', cart, 'FLAT100');
  console.log(`  caller got ${o.id}, total Rs ${o.total}. tshirts left=${inventory.left('tshirt')}\n`);

  console.log('== 2. Payment fails: the facade releases the stock');
  try {
    await shop.checkout('broke', [{ sku: 'tshirt', qty: 2, price: 499 }]);
  } catch (e) {
    console.log(`  caller got error ${(e as Error).message}. tshirts left=${inventory.left('tshirt')} (unchanged)\n`);
  }

  console.log('== 3. Email fails: the order still succeeds');
  const o3 = await shop.checkout('slow-mail', [{ sku: 'mug', qty: 1, price: 299 }]);
  await Promise.resolve(); // let the fire-and-forget catch print
  console.log(`  caller got ${o3.id} anyway\n`);

  console.log('== 4. Out of stock: fails before any money moves');
  try {
    await shop.checkout('pappu', [{ sku: 'mug', qty: 5, price: 299 }]);
  } catch (e) {
    console.log(`  caller got error ${(e as Error).message}`);
  }

  console.log('\nTakeaway: controllers, jobs and tests call checkout(); the order of steps and the rollback live in one class.');
}

main();

export {};
