import * as starter from './starter';
import * as reference from './reference';
import type { Coupon } from './reference';

// `npm test` checks your starter.ts; `npm run test:ref` checks the reference.
const { Shop, FlatOff, PercentOff, CategoryPercentOff } = (process.env.REF ? reference : starter) as typeof reference;

const MIN = 60_000;

function makeShop() {
  let now = 0;
  const shop = new Shop({
    products: [
      { sku: 'TSHIRT', name: 'T-shirt', pricePaise: 50_000, category: 'fashion' },
      { sku: 'PHONE', name: 'Phone', pricePaise: 1_000_000, category: 'electronics' },
      { sku: 'MUG', name: 'Mug', pricePaise: 20_000, category: 'home' },
    ],
    reservationTtlMs: 15 * MIN,
    clock: () => now,
  });
  shop.addStock('TSHIRT', 5);
  shop.addStock('PHONE', 1);
  shop.addStock('MUG', 10);
  return { shop, advance: (ms: number) => (now += ms) };
}

describe('20 · Cart with Coupons', () => {
  describe('cart and inventory', () => {
    it('reserves stock on add and releases it on remove', () => {
      const { shop } = makeShop();
      const c = shop.createCart();
      shop.addItem(c, 'TSHIRT', 2);
      expect(shop.available('TSHIRT')).toBe(3);
      shop.removeItem(c, 'TSHIRT', 1);
      expect(shop.available('TSHIRT')).toBe(4);
      shop.removeItem(c, 'TSHIRT');
      expect(shop.available('TSHIRT')).toBe(5);
      expect(shop.cart(c).lines).toEqual([]);
    });

    it('does not let two carts take the last item', () => {
      const { shop } = makeShop();
      const a = shop.createCart();
      const b = shop.createCart();
      shop.addItem(a, 'PHONE', 1);
      expect(() => shop.addItem(b, 'PHONE', 1)).toThrow();
    });

    it('expires the reservation after the TTL and frees the stock', () => {
      const { shop, advance } = makeShop();
      const a = shop.createCart();
      shop.addItem(a, 'PHONE', 1);
      advance(15 * MIN);
      expect(shop.available('PHONE')).toBe(1);
      expect(shop.cart(a).status).toBe('EXPIRED');
      expect(() => shop.checkout(a)).toThrow();
    });

    it('checkout turns the reservation into a sale', () => {
      const { shop } = makeShop();
      const c = shop.createCart();
      shop.addItem(c, 'MUG', 3);
      const order = shop.checkout(c);
      expect(order.totalPaise).toBe(60_000);
      expect(shop.available('MUG')).toBe(7);
      expect(() => shop.addItem(c, 'MUG', 1)).toThrow(); // cart is closed
      expect(() => shop.checkout(shop.createCart())).toThrow(); // empty cart
    });

    it('validates input', () => {
      const { shop } = makeShop();
      const c = shop.createCart();
      expect(() => shop.addItem(c, 'NOPE', 1)).toThrow();
      expect(() => shop.addItem(c, 'MUG', 0)).toThrow();
      expect(() => shop.addItem(c, 'MUG', 1.5)).toThrow();
      expect(() => shop.removeItem(c, 'MUG')).toThrow();
    });
  });

  describe('coupons', () => {
    it('applies a flat and a capped percent coupon in paise', () => {
      const { shop } = makeShop();
      shop.registerCoupon(new FlatOff('FLAT100', 10_000));
      shop.registerCoupon(new PercentOff('TEN', 10, 50_000));
      const a = shop.createCart();
      shop.addItem(a, 'TSHIRT', 1);
      shop.applyCoupon(a, 'FLAT100');
      expect(shop.price(a)).toEqual({ subtotalPaise: 50_000, discounts: [{ code: 'FLAT100', amountPaise: 10_000 }], totalPaise: 40_000 });

      const b = shop.createCart();
      shop.addItem(b, 'PHONE', 1);
      shop.applyCoupon(b, 'TEN');
      expect(shop.price(b).totalPaise).toBe(950_000); // 10% = 1,00,000 but capped at 50,000
    });

    it('stacks stackable coupons and never goes below zero', () => {
      const { shop } = makeShop();
      shop.registerCoupon(new FlatOff('A', 15_000, { stackable: true }));
      shop.registerCoupon(new FlatOff('B', 10_000, { stackable: true }));
      const c = shop.createCart();
      shop.addItem(c, 'MUG', 1); // 20,000
      shop.applyCoupon(c, 'A');
      shop.applyCoupon(c, 'B');
      const p = shop.price(c);
      expect(p.discounts).toEqual([
        { code: 'A', amountPaise: 15_000 },
        { code: 'B', amountPaise: 5_000 },
      ]);
      expect(p.totalPaise).toBe(0);
    });

    it('does not combine a non-stackable coupon with any other', () => {
      const { shop } = makeShop();
      shop.registerCoupon(new FlatOff('SOLO', 5_000));
      shop.registerCoupon(new FlatOff('S1', 1_000, { stackable: true }));
      const c = shop.createCart();
      shop.addItem(c, 'TSHIRT', 1);
      shop.applyCoupon(c, 'SOLO');
      expect(() => shop.applyCoupon(c, 'S1')).toThrow();
      shop.removeCoupon(c, 'SOLO');
      shop.applyCoupon(c, 'S1');
      expect(() => shop.applyCoupon(c, 'SOLO')).toThrow();
      expect(() => shop.applyCoupon(c, 'S1')).toThrow(); // already applied
    });

    it('rejects expired, unknown, below-minimum and not-applicable coupons', () => {
      const { shop, advance } = makeShop();
      shop.registerCoupon(new FlatOff('OLD', 1_000, { expiresAt: 5 * MIN }));
      shop.registerCoupon(new FlatOff('BIG', 1_000, { minCartPaise: 100_000 }));
      shop.registerCoupon(new CategoryPercentOff('TECH20', 'electronics', 20));
      const c = shop.createCart();
      shop.addItem(c, 'TSHIRT', 1);
      advance(5 * MIN);
      expect(() => shop.applyCoupon(c, 'OLD')).toThrow(/expired/);
      expect(() => shop.applyCoupon(c, 'NOPE')).toThrow();
      expect(() => shop.applyCoupon(c, 'BIG')).toThrow();
      expect(() => shop.applyCoupon(c, 'TECH20')).toThrow(); // no electronics in the cart
    });

    it('drops the discount when the cart falls below the coupon minimum', () => {
      const { shop } = makeShop();
      shop.registerCoupon(new FlatOff('MIN1K', 20_000, { minCartPaise: 100_000 }));
      const c = shop.createCart();
      shop.addItem(c, 'TSHIRT', 2); // 1,00,000
      shop.applyCoupon(c, 'MIN1K');
      expect(shop.price(c).totalPaise).toBe(80_000);
      shop.removeItem(c, 'TSHIRT', 1);
      expect(shop.price(c)).toEqual({ subtotalPaise: 50_000, discounts: [], totalPaise: 50_000 });
      expect(shop.checkout(c).totalPaise).toBe(50_000);
    });
  });

  describe('best coupon selection', () => {
    it('compares each non-stackable alone with all stackables together', () => {
      const { shop } = makeShop();
      shop.registerCoupon(new PercentOff('PCT15', 15)); // non-stackable
      shop.registerCoupon(new CategoryPercentOff('TECH10', 'electronics', 10, { stackable: true }));
      shop.registerCoupon(new FlatOff('FLAT500', 50_000, { stackable: true }));
      shop.registerCoupon(new FlatOff('HUGE', 1, { minCartPaise: 10_000_000 })); // not valid
      const c = shop.createCart();
      shop.addItem(c, 'PHONE', 1);  // 10,00,000
      shop.addItem(c, 'MUG', 1);    //    20,000
      // PCT15 alone = 1,53,000. TECH10 + FLAT500 = 1,00,000 + 50,000 = 1,50,000.
      expect(shop.bestCoupons(c)).toEqual({ codes: ['PCT15'], discountPaise: 153_000 });

      shop.removeItem(c, 'MUG');
      // PCT15 = 1,50,000. Stackables = 1,50,000. Tie → fewer coupons.
      expect(shop.bestCoupons(c).codes).toEqual(['PCT15']);
    });

    it('returns no coupons when none applies', () => {
      const { shop } = makeShop();
      shop.registerCoupon(new CategoryPercentOff('TECH10', 'electronics', 10));
      const c = shop.createCart();
      shop.addItem(c, 'MUG', 1);
      expect(shop.bestCoupons(c)).toEqual({ codes: [], discountPaise: 0 });
    });
  });

  describe('extensibility', () => {
    it('accepts any Coupon implementation (Open/Closed)', () => {
      const buy2Get1Mug: Coupon = {
        code: 'MUGS',
        stackable: true,
        discountFor: (lines) => {
          const mugs = lines.find((l) => l.sku === 'MUG');
          return mugs ? Math.floor(mugs.quantity / 3) * mugs.unitPricePaise : 0;
        },
      };
      const { shop } = makeShop();
      shop.registerCoupon(buy2Get1Mug);
      const c = shop.createCart();
      shop.addItem(c, 'MUG', 3);
      shop.applyCoupon(c, 'MUGS');
      expect(shop.price(c).totalPaise).toBe(40_000);
      expect(shop.bestCoupons(c)).toEqual({ codes: ['MUGS'], discountPaise: 20_000 });
    });
  });
});
