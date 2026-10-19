# 20 · Cart with Coupons

> Asked at: Flipkart, Myntra, Meesho, Swiggy Instamart, Zepto, Amazon.
> Time box: **90 min** (15 min design, 60 min code, 15 min tests and extensions)
> Patterns you should reach for: **Strategy** (each coupon type), **Chain of Responsibility** (coupon validity rules), lazy expiry for reservations

## Problem statement (as the interviewer says it)

"Design a shopping cart. Users add and remove products. Stock is limited, so two users must not buy the last item.
Users can apply coupons: flat off, percent off, category offers. Some coupons stack, some do not. Show the user the best coupon."

## Step 1: clarify (ask these out loud)

Ask these before writing any code. The assumed answers below are what the tests expect.

| Question | Assumed answer |
|---|---|
| Money? | Integer paise. Percent discounts round **down** (`Math.floor`) |
| When is stock reserved? | On `addItem`. `removeItem` releases it. Checkout turns it into a sale |
| How long is a reservation held? | A TTL (default 15 min) from the **last add**. After that the cart is `EXPIRED` and its stock is free again |
| What can you do with an expired or checked-out cart? | Read it. Every write throws |
| Coupon types? | `FlatOff`, `PercentOff` (optional max cap), `CategoryPercentOff`. Any `Coupon` implementation must work |
| When is a coupon valid? | Not expired, cart ≥ `minCartPaise`, and its discount is > 0 for this cart |
| Stacking rule? | A **non-stackable** coupon must be the only coupon. Stackable coupons combine with each other |
| How do stacked discounts combine? | Each coupon is computed on the **subtotal**. The total never goes below 0 |
| The cart changes after a coupon is applied? | Coupons are re-checked on every `price`. A coupon that no longer qualifies gives 0, but stays applied |
| Best coupon? | Compare each valid non-stackable coupon alone with all valid stackable coupons together. Tie → fewer coupons |
| Per-user limits, payment-method offers, taxes, shipping? | Out of scope. Mention them as extensions |

## Step 2: public API (what the tests call)

```ts
const shop = new Shop({
  products: [{ sku: 'MUG', name: 'Mug', pricePaise: 20_000, category: 'home' }],
  reservationTtlMs: 15 * 60_000,
  clock: () => Date.now(),           // injectable, so tests control time
});
shop.addStock('MUG', 10);
shop.available('MUG');               // → stock − active reservations

shop.registerCoupon(new FlatOff('FLAT100', 10_000, { stackable: true, minCartPaise: 50_000 }));
shop.registerCoupon(new PercentOff('TEN', 10, 50_000));           // 10%, max ₹500
shop.registerCoupon(new CategoryPercentOff('HOME5', 'home', 5));

const cartId = shop.createCart();
shop.addItem(cartId, 'MUG', 3);
shop.removeItem(cartId, 'MUG', 1);   // omit qty to remove the whole line
shop.applyCoupon(cartId, 'TEN');
shop.removeCoupon(cartId, 'TEN');
shop.price(cartId);                  // → { subtotalPaise, discounts: [{ code, amountPaise }], totalPaise }
shop.bestCoupons(cartId);            // → { codes, discountPaise }
shop.cart(cartId);                   // → { id, status, lines, coupons }
shop.checkout(cartId);               // → Order { id, cartId, lines, subtotalPaise, discounts, totalPaise }
```

The internals are **your design**. The tests only use the API above.

## Step 3: entities (try them yourself first)

<details>
<summary>Reveal a good entity list</summary>

- `Shop`: the facade. Owns products, stock, coupons and carts
- `CartRecord`: id, status, `sku → qty`, applied coupon codes, `expiresAt`. The cart quantity **is** the reservation, so you never keep two numbers in sync
- Inventory: `available = stock − sum of qty in OPEN carts`. Expiry is **lazy**: before any read, mark carts past `expiresAt` as EXPIRED. No timers, so tests stay deterministic
- `Coupon` (interface, a Strategy): `code`, `stackable`, `minCartPaise?`, `expiresAt?`, `discountFor(lines, subtotal)`. A coupon only does the maths
- Validity rules: a list of small functions run in order (expired → min cart → applies at all). The first failure wins. This is Chain of Responsibility. A new rule is one new function
- The stacking rule is checked in `applyCoupon`, because it depends on the other applied coupons, not on the cart
- Pricing: `priceWith(lines, coupons)` is a pure function. `price`, `bestCoupons` and `checkout` all reuse it

</details>

## Step 4: implement

- Write your code in `starter.ts`. Keep the exported names.
- Run `npx vitest run lld/problems/20-ecommerce-cart-coupons` until it's green.
- Don't open `reference.ts` until your tests pass, or until you've spent 90 minutes.

## Step 5: extensions interviewers ask after you finish

1. **Two users, one phone, many servers.** Reserve with a conditional update: `UPDATE inventory SET reserved = reserved + 1 WHERE sku = ? AND stock - reserved >= 1`. Or keep the counter in Redis and use `DECRBY` inside a Lua script. Expire reservations with a sweeper job or Redis key TTLs.
2. **Reserve on add or on checkout?** On add is fair to the user but holds stock that may never sell. On checkout (or payment start) is common for flash sales. Say the trade-off.
3. **Stacking applied on the running total.** Then order matters (percent first gives a bigger discount than flat first). You need a fixed priority per coupon type, and best-coupon search must try orders.
4. **Many stackable coupons with caps or conflicts.** "All stackables together" is no longer always best. Search subsets (2^n is fine for n ≤ 10 per cart), or treat it as a small knapsack.
5. **One use per user, first order only, payment-method offers.** New validity rules that need a user context. Add a `user` to the check context.
6. **Show the discount per line** (needed for GST invoices and partial returns). Split each coupon's discount across lines in proportion to line value.

## Self-check before you call it done

- [ ] No `switch (coupon.type)` in the shop. Each coupon type computes its own discount.
- [ ] Validity rules are a list, not one long `if` block.
- [ ] Time is injected. Reservation expiry needs no timers or sleeps.
- [ ] No floats. Percent discounts use `Math.floor`.
- [ ] A failed `addItem` or `applyCoupon` leaves the cart unchanged.

## Concepts used

- [Strategy pattern](../../4-behavioral/L20-strategy/README.md) · [Chain of Responsibility](../../4-behavioral/L25-chain-of-responsibility/README.md) · [SOLID](../../1-foundations/L04-solid-srp-ocp/README.md) · [Concurrency in Node LLD](../../5-machine-coding/L32-concurrency-in-node/README.md)
- Related problem: [BookMyShow seat locking](../13-bookmyshow) (the same reserve-then-confirm idea)
- Visuals: [Decorator and Chain of Responsibility](../../3-structural/L14-decorator/visual.html) · [Strategy + Factory](../../4-behavioral/L20-strategy/visual.html) · [Seat locking and race conditions](../../5-machine-coding/L32-concurrency-in-node/visual.html)
