// P07 · Facade
// Run: npx tsx lld/concepts/patterns/p07-facade.ts

interface Item { sku: string; qty: number; price: number }
interface Order { id: string; userId: string; total: number; txnId: string }

class Inventory {
  private stock = new Map<string, number>([['SKU-PHONE', 2], ['SKU-CASE', 10]]);
  private reservations = new Map<string, Item[]>();
  private next = 0;
  reserve(items: Item[]): string {
    for (const i of items) {
      if ((this.stock.get(i.sku) ?? 0) < i.qty) throw new Error(`Out of stock: ${i.sku}`);
    }
    for (const i of items) this.stock.set(i.sku, this.stock.get(i.sku)! - i.qty);
    const id = `res_${++this.next}`;
    this.reservations.set(id, items);
    return id;
  }
  commit(resId: string): void { this.reservations.delete(resId); }
  release(resId: string): void {
    for (const i of this.reservations.get(resId) ?? []) this.stock.set(i.sku, this.stock.get(i.sku)! + i.qty);
    this.reservations.delete(resId);
  }
  available(sku: string): number { return this.stock.get(sku) ?? 0; }
}

class Pricing {
  total(items: Item[], coupon?: string): number {
    const sum = items.reduce((s, i) => s + i.qty * i.price, 0);
    return coupon === 'FLAT100' ? Math.max(0, sum - 100) : sum;
  }
}

class Payments {
  constructor(private readonly declineAbove: number) {}
  async charge(userId: string, amount: number): Promise<string> {
    if (amount > this.declineAbove) throw new Error(`Payment declined for ${userId}`);
    return `txn_${userId}_${amount}`;
  }
}

class Orders {
  private next = 0;
  create(userId: string, total: number, txnId: string): Order {
    return { id: `ord_${++this.next}`, userId, total, txnId };
  }
}

class Notifier {
  async send(userId: string, msg: string): Promise<void> { console.log(`  notify ${userId}: ${msg}`); }
}

// ---------- the facade ----------
class CheckoutService {
  constructor(
    private readonly inventory: Inventory,
    private readonly pricing: Pricing,
    private readonly payments: Payments,
    private readonly orders: Orders,
    private readonly notifier: Notifier,
  ) {}

  async checkout(userId: string, items: Item[], coupon?: string): Promise<Order> {
    const reservation = this.inventory.reserve(items);
    try {
      const total = this.pricing.total(items, coupon);
      const txnId = await this.payments.charge(userId, total);
      const order = this.orders.create(userId, total, txnId);
      this.inventory.commit(reservation);
      void this.notifier.send(userId, `Order ${order.id} placed, paid ${total}`);
      return order;
    } catch (e) {
      this.inventory.release(reservation); // compensation lives in one place
      throw e;
    }
  }
}

async function main() {
  const inventory = new Inventory();
  const pricing = new Pricing();
  const payments = new Payments(50_000);

  console.log('--- before: caller orchestrates and forgets cleanup ---');
  const cart: Item[] = [{ sku: 'SKU-PHONE', qty: 1, price: 60_000 }];
  try {
    inventory.reserve(cart);
    await payments.charge('u1', pricing.total(cart));
  } catch (e) {
    console.log(`  error: ${(e as Error).message}`);
  }
  console.log(`  phones left: ${inventory.available('SKU-PHONE')} (one phone is stuck in a reservation)`);

  console.log('\n--- after: one call, correct order and compensation ---');
  const inv2 = new Inventory();
  const checkout = new CheckoutService(inv2, pricing, payments, new Orders(), new Notifier());
  try {
    await checkout.checkout('u1', cart);
  } catch (e) {
    console.log(`  error: ${(e as Error).message}`);
  }
  console.log(`  phones left: ${inv2.available('SKU-PHONE')} (released)`);

  const order = await checkout.checkout('u2', [
    { sku: 'SKU-PHONE', qty: 1, price: 30_000 },
    { sku: 'SKU-CASE', qty: 2, price: 500 },
  ], 'FLAT100');
  console.log('  order:', order);
  console.log(`  phones left: ${inv2.available('SKU-PHONE')}, cases left: ${inv2.available('SKU-CASE')}`);
}

await main();

export {};
