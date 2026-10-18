// 20 · Cart with Coupons: reference solution.
// Read this only after your own attempt passes (or after 90 minutes).

/** Money is always an integer number of paise. */
export type Paise = number;

export interface Product {
  readonly sku: string;
  readonly name: string;
  readonly pricePaise: Paise;
  readonly category: string;
}

export interface CartLine {
  readonly sku: string;
  readonly category: string;
  readonly quantity: number;
  readonly unitPricePaise: Paise;
  readonly linePaise: Paise;
}

export type CartStatus = 'OPEN' | 'CHECKED_OUT' | 'EXPIRED';

export interface CartView {
  readonly id: string;
  readonly status: CartStatus;
  readonly lines: readonly CartLine[];
  readonly coupons: readonly string[];
}

export interface AppliedDiscount {
  readonly code: string;
  readonly amountPaise: Paise;
}

export interface PriceBreakdown {
  readonly subtotalPaise: Paise;
  readonly discounts: readonly AppliedDiscount[];
  readonly totalPaise: Paise;
}

export interface Order extends PriceBreakdown {
  readonly id: string;
  readonly cartId: string;
  readonly lines: readonly CartLine[];
}

export interface BestCoupons {
  readonly codes: readonly string[];
  readonly discountPaise: Paise;
}

/** A coupon only computes its discount. Validity rules live in the shop. */
export interface Coupon {
  readonly code: string;
  readonly stackable: boolean;
  readonly minCartPaise?: Paise;
  readonly expiresAt?: number;
  /** Discount in paise for these lines. Return 0 if the coupon does not apply. */
  discountFor(lines: readonly CartLine[], subtotalPaise: Paise): Paise;
}

export interface CouponOptions {
  stackable?: boolean;
  minCartPaise?: Paise;
  expiresAt?: number;
}

export interface ShopConfig {
  products: Product[];
  reservationTtlMs?: number;
  clock?: () => number;
}

export class FlatOff implements Coupon {
  readonly stackable: boolean;
  readonly minCartPaise?: Paise;
  readonly expiresAt?: number;

  constructor(readonly code: string, private readonly amountPaise: Paise, opts: CouponOptions = {}) {
    this.stackable = opts.stackable ?? false;
    this.minCartPaise = opts.minCartPaise;
    this.expiresAt = opts.expiresAt;
  }

  discountFor(_lines: readonly CartLine[], subtotalPaise: Paise): Paise {
    return Math.min(this.amountPaise, subtotalPaise);
  }
}

export class PercentOff implements Coupon {
  readonly stackable: boolean;
  readonly minCartPaise?: Paise;
  readonly expiresAt?: number;

  constructor(
    readonly code: string,
    private readonly percent: number,
    private readonly maxPaise = Infinity,
    opts: CouponOptions = {},
  ) {
    this.stackable = opts.stackable ?? false;
    this.minCartPaise = opts.minCartPaise;
    this.expiresAt = opts.expiresAt;
  }

  discountFor(_lines: readonly CartLine[], subtotalPaise: Paise): Paise {
    return Math.min(Math.floor((subtotalPaise * this.percent) / 100), this.maxPaise);
  }
}

export class CategoryPercentOff implements Coupon {
  readonly stackable: boolean;
  readonly minCartPaise?: Paise;
  readonly expiresAt?: number;

  constructor(
    readonly code: string,
    private readonly category: string,
    private readonly percent: number,
    opts: CouponOptions = {},
  ) {
    this.stackable = opts.stackable ?? false;
    this.minCartPaise = opts.minCartPaise;
    this.expiresAt = opts.expiresAt;
  }

  discountFor(lines: readonly CartLine[]): Paise {
    const base = lines.filter((l) => l.category === this.category).reduce((s, l) => s + l.linePaise, 0);
    return Math.floor((base * this.percent) / 100);
  }
}

interface CartRecord {
  id: string;
  status: CartStatus;
  items: Map<string, number>; // sku → qty, also the reserved qty
  coupons: string[];
  expiresAt: number;
}

interface CheckContext {
  coupon: Coupon;
  lines: readonly CartLine[];
  subtotalPaise: Paise;
  now: number;
}

// Chain of rules. The first rule that returns a message rejects the coupon.
// A new rule (first order only, one use per user) is one more function here.
type CouponRule = (ctx: CheckContext) => string | null;

const VALIDITY_RULES: CouponRule[] = [
  ({ coupon, now }) => (coupon.expiresAt !== undefined && now >= coupon.expiresAt ? 'expired' : null),
  ({ coupon, subtotalPaise }) =>
    coupon.minCartPaise !== undefined && subtotalPaise < coupon.minCartPaise ? `needs a cart of ${coupon.minCartPaise}` : null,
  ({ coupon, lines, subtotalPaise }) => (coupon.discountFor(lines, subtotalPaise) <= 0 ? 'does not apply to this cart' : null),
];

export class Shop {
  private readonly products = new Map<string, Product>();
  private readonly stock = new Map<string, number>();
  private readonly coupons = new Map<string, Coupon>();
  private readonly carts = new Map<string, CartRecord>();
  private readonly ttlMs: number;
  private readonly clock: () => number;
  private nextCart = 1;
  private nextOrder = 1;

  constructor(config: ShopConfig) {
    for (const p of config.products) {
      if (!Number.isSafeInteger(p.pricePaise) || p.pricePaise <= 0) throw new Error(`Bad price for ${p.sku}`);
      this.products.set(p.sku, p);
      this.stock.set(p.sku, 0);
    }
    this.ttlMs = config.reservationTtlMs ?? 15 * 60_000;
    this.clock = config.clock ?? Date.now;
  }

  addStock(sku: string, quantity: number): void {
    this.product(sku);
    assertQty(quantity);
    this.stock.set(sku, this.stock.get(sku)! + quantity);
  }

  /** Stock minus what open carts have reserved. */
  available(sku: string): number {
    this.product(sku);
    this.expireCarts();
    let reserved = 0;
    for (const c of this.carts.values()) {
      if (c.status === 'OPEN') reserved += c.items.get(sku) ?? 0;
    }
    return this.stock.get(sku)! - reserved;
  }

  registerCoupon(coupon: Coupon): void {
    if (this.coupons.has(coupon.code)) throw new Error(`Coupon ${coupon.code} already exists`);
    this.coupons.set(coupon.code, coupon);
  }

  createCart(): string {
    const id = `C${this.nextCart++}`;
    this.carts.set(id, { id, status: 'OPEN', items: new Map(), coupons: [], expiresAt: this.clock() + this.ttlMs });
    return id;
  }

  /** Reserves stock right away. Each add refreshes the reservation timer. */
  addItem(cartId: string, sku: string, quantity: number): void {
    const cart = this.openCart(cartId);
    this.product(sku);
    assertQty(quantity);
    if (this.available(sku) < quantity) throw new Error(`Not enough stock for ${sku}`);
    cart.items.set(sku, (cart.items.get(sku) ?? 0) + quantity);
    cart.expiresAt = this.clock() + this.ttlMs;
  }

  /** Removes `quantity` (or the whole line) and releases that stock. */
  removeItem(cartId: string, sku: string, quantity?: number): void {
    const cart = this.openCart(cartId);
    const current = cart.items.get(sku);
    if (current === undefined) throw new Error(`${sku} is not in the cart`);
    const remove = quantity ?? current;
    assertQty(remove);
    if (remove > current) throw new Error(`Cart has only ${current} of ${sku}`);
    if (remove === current) cart.items.delete(sku);
    else cart.items.set(sku, current - remove);
  }

  cart(cartId: string): CartView {
    this.expireCarts();
    const cart = this.getCart(cartId);
    return { id: cart.id, status: cart.status, lines: this.lines(cart), coupons: [...cart.coupons] };
  }

  applyCoupon(cartId: string, code: string): void {
    const cart = this.openCart(cartId);
    const coupon = this.coupons.get(code);
    if (!coupon) throw new Error(`Unknown coupon ${code}`);
    if (cart.coupons.includes(code)) throw new Error(`Coupon ${code} already applied`);

    // Stacking: a non-stackable coupon must be the only one.
    const applied = cart.coupons.map((c) => this.coupons.get(c)!);
    if (applied.length > 0 && (!coupon.stackable || applied.some((c) => !c.stackable))) {
      throw new Error(`Coupon ${code} cannot be combined with ${cart.coupons.join(', ')}`);
    }
    const reason = this.check(coupon, this.lines(cart));
    if (reason) throw new Error(`Coupon ${code} ${reason}`);
    cart.coupons.push(code);
  }

  removeCoupon(cartId: string, code: string): void {
    const cart = this.openCart(cartId);
    const i = cart.coupons.indexOf(code);
    if (i === -1) throw new Error(`Coupon ${code} is not applied`);
    cart.coupons.splice(i, 1);
  }

  /** Coupons are re-checked every time: a coupon that stopped qualifying gives no discount. */
  price(cartId: string): PriceBreakdown {
    const cart = this.getCart(cartId);
    return this.priceWith(this.lines(cart), cart.coupons.map((c) => this.coupons.get(c)!));
  }

  /** Best legal set: any one non-stackable coupon alone, or all valid stackable coupons together. */
  bestCoupons(cartId: string): BestCoupons {
    const lines = this.lines(this.getCart(cartId));
    const valid = [...this.coupons.values()].filter((c) => this.check(c, lines) === null);
    const candidates: Coupon[][] = valid.filter((c) => !c.stackable).map((c) => [c]);
    const stackables = valid.filter((c) => c.stackable);
    if (stackables.length > 0) candidates.push(stackables);

    let best: BestCoupons = { codes: [], discountPaise: 0 };
    for (const set of candidates) {
      const { subtotalPaise, totalPaise } = this.priceWith(lines, set);
      const discountPaise = subtotalPaise - totalPaise;
      const better =
        discountPaise > best.discountPaise ||
        (discountPaise === best.discountPaise && discountPaise > 0 && set.length < best.codes.length);
      if (better) best = { codes: set.map((c) => c.code), discountPaise };
    }
    return best;
  }

  checkout(cartId: string): Order {
    const cart = this.openCart(cartId);
    const lines = this.lines(cart);
    if (lines.length === 0) throw new Error('Cart is empty');
    const breakdown = this.price(cartId);

    // Reserved stock becomes sold stock.
    for (const [sku, qty] of cart.items) this.stock.set(sku, this.stock.get(sku)! - qty);
    cart.status = 'CHECKED_OUT';
    return { id: `O${this.nextOrder++}`, cartId, lines, ...breakdown };
  }

  private priceWith(lines: readonly CartLine[], coupons: Coupon[]): PriceBreakdown {
    const subtotalPaise = lines.reduce((s, l) => s + l.linePaise, 0);
    const discounts: AppliedDiscount[] = [];
    let remaining = subtotalPaise;
    // Each coupon is computed on the subtotal, so the order of coupons does not matter.
    // The running total only stops the sum from going below zero.
    for (const c of coupons) {
      if (this.check(c, lines) !== null) continue;
      const amountPaise = Math.min(c.discountFor(lines, subtotalPaise), remaining);
      if (amountPaise <= 0) continue;
      remaining -= amountPaise;
      discounts.push({ code: c.code, amountPaise });
    }
    return { subtotalPaise, discounts, totalPaise: remaining };
  }

  private check(coupon: Coupon, lines: readonly CartLine[]): string | null {
    const ctx: CheckContext = {
      coupon,
      lines,
      subtotalPaise: lines.reduce((s, l) => s + l.linePaise, 0),
      now: this.clock(),
    };
    for (const rule of VALIDITY_RULES) {
      const reason = rule(ctx);
      if (reason) return reason;
    }
    return null;
  }

  private lines(cart: CartRecord): CartLine[] {
    return [...cart.items].map(([sku, quantity]) => {
      const p = this.product(sku);
      return { sku, category: p.category, quantity, unitPricePaise: p.pricePaise, linePaise: p.pricePaise * quantity };
    });
  }

  // Lazy expiry: no timers. Any read of stock first drops stale reservations.
  private expireCarts(): void {
    const now = this.clock();
    for (const c of this.carts.values()) {
      if (c.status === 'OPEN' && now >= c.expiresAt) c.status = 'EXPIRED';
    }
  }

  private openCart(id: string): CartRecord {
    this.expireCarts();
    const cart = this.getCart(id);
    if (cart.status !== 'OPEN') throw new Error(`Cart ${id} is ${cart.status}`);
    return cart;
  }

  private getCart(id: string): CartRecord {
    const c = this.carts.get(id);
    if (!c) throw new Error(`Unknown cart ${id}`);
    return c;
  }

  private product(sku: string): Product {
    const p = this.products.get(sku);
    if (!p) throw new Error(`Unknown product ${sku}`);
    return p;
  }
}

function assertQty(q: number): void {
  if (!Number.isSafeInteger(q) || q <= 0) throw new Error(`Quantity must be a positive integer, got ${q}`);
}
