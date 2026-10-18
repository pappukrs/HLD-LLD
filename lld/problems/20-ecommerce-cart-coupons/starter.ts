// 20 · Cart with Coupons: your implementation goes here.
// Keep the exported names and signatures; the tests import them.
// Run: npx vitest run lld/problems/20-ecommerce-cart-coupons

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
    throw new Error('TODO: never more than the subtotal');
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
    throw new Error('TODO: floor(subtotal × percent / 100), capped at maxPaise');
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
    throw new Error('TODO: percent of the lines in this category only');
  }
}

export class Shop {
  constructor(config: ShopConfig) {
    // TODO: products, stock, coupons, carts, TTL (default 15 min), clock
  }

  addStock(sku: string, quantity: number): void {
    throw new Error('TODO');
  }

  /** Stock minus what open (not expired) carts have reserved. */
  available(sku: string): number {
    throw new Error('TODO');
  }

  registerCoupon(coupon: Coupon): void {
    throw new Error('TODO');
  }

  createCart(): string {
    throw new Error('TODO');
  }

  /** Reserves stock right away. Each add refreshes the reservation timer. */
  addItem(cartId: string, sku: string, quantity: number): void {
    throw new Error('TODO');
  }

  /** Removes `quantity` (or the whole line) and releases that stock. */
  removeItem(cartId: string, sku: string, quantity?: number): void {
    throw new Error('TODO');
  }

  cart(cartId: string): CartView {
    throw new Error('TODO');
  }

  applyCoupon(cartId: string, code: string): void {
    throw new Error('TODO: validate (expiry, min cart, applies at all) and the stacking rule');
  }

  removeCoupon(cartId: string, code: string): void {
    throw new Error('TODO');
  }

  /** Re-checks applied coupons: one that stopped qualifying gives no discount. */
  price(cartId: string): PriceBreakdown {
    throw new Error('TODO');
  }

  /** Best legal set: any one non-stackable coupon alone, or all valid stackable coupons together. */
  bestCoupons(cartId: string): BestCoupons {
    throw new Error('TODO');
  }

  checkout(cartId: string): Order {
    throw new Error('TODO');
  }
}
