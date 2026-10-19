# L33 · Domain modelling in TS: value objects, enums, errors

> **Time:** ~35 min · **Visual:** [visual.html](visual.html) · **Code:** [demo.ts](demo.ts) (`npx tsx lld/5-machine-coding/L33-domain-modeling/demo.ts`)
> **Builds on:** [L01 Classes and interfaces](../../1-foundations/L01-classes-and-interfaces/README.md) · [L22 State](../../4-behavioral/L22-state/README.md) · [L30 Machine-coding framework](../L30-machine-coding-framework/README.md) · **Used in:** [Payment wallet](../../problems/19-payment-wallet/README.md), [Splitwise](../../problems/09-splitwise/README.md), [E-commerce cart and coupons](../../problems/20-ecommerce-cart-coupons/README.md), [Vending machine](../../problems/06-vending-machine/README.md), [Ride sharing](../../problems/17-ride-sharing/README.md)

## The idea in one line

Use the type system and small immutable classes so **wrong states cannot be written**: value objects for things like money, union types for fixed sets and states, entities that guard their own rules, and named error classes for every way a use case can fail.

## Why it matters (the problem it solves)

```ts
// Before: primitive obsession and stringly-typed state
class Payment {
  amount: number;            // rupees? paise? 0.1 + 0.2 = 0.30000000000000004
  currency: string;          // 'INR', 'inr', 'Rs'?
  status: string = 'created';// 'captured'? 'CAPTURED'? 'capturd'?
  txnId?: string;            // set only when captured... maybe
  failureReason?: string;    // set only when failed... maybe
}
function refund(p: Payment, amount: number) {
  if (amount > p.amount) return false;   // why did it fail? the caller can't tell
  p.amount -= amount;                    // anyone can also do p.amount = -5
  return true;
}
```

- The compiler cannot catch `status = 'capturd'`, or a captured payment with no `txnId`.
- `number` for money gives floating-point errors and mixes currencies.
- `return false` hides *why* it failed; the API layer cannot map it to 400 vs 404 vs 409.
- Any code can set `amount` to a negative number. Rules live everywhere and nowhere.

Interviewers read your types first. Good types show you think about invariants.

## How it works

### Entity vs value object

| | Entity | Value object |
|---|---|---|
| Identity | Has an id; two with the same fields are still different | No id; equal if all fields are equal |
| Mutability | Changes over time (through methods) | Immutable; operations return a new one |
| Examples | `Order`, `Wallet`, `Booking`, `Ride` | `Money`, `Email`, `DateRange`, `GeoPoint`, `SeatNo` |
| Validation | Guards transitions (`cancel()` only if not shipped) | Validates once in the factory, then always valid |

```
           Order (entity, id = ORD-1)
           ├── status: OrderStatus      (union / discriminated union)
           ├── total:  Money            (value object: paise + currency)
           ├── lines:  readonly Line[]  (value objects)
           └── methods: addLine(), pay(), cancel()  → throw DomainError on a broken rule
```

### Value objects: make invalid values impossible

```ts
class Money {
  private constructor(readonly paise: bigint, readonly currency: 'INR' | 'USD') {}
  static inr(rupees: number) {
    if (!Number.isFinite(rupees) || rupees < 0) throw new ValidationError(`bad amount ${rupees}`);
    return new Money(BigInt(Math.round(rupees * 100)), 'INR');
  }
  add(o: Money) { this.same(o); return new Money(this.paise + o.paise, this.currency); }
  private same(o: Money) { if (o.currency !== this.currency) throw new CurrencyMismatch(); }
}
```

Rules:

1. **Private constructor + static factory** that validates. If you hold a `Money`, it is valid.
2. **Immutable.** `readonly` fields; operations return new objects.
3. **Store money as integer minor units** (paise, cents). `bigint` or integer `number`. Never floats.
4. **Equality by value**: `a.equals(b)`, not `a === b`.

### Branded types: cheap value objects for ids

```ts
type UserId = string & { readonly __brand: 'UserId' };
type OrderId = string & { readonly __brand: 'OrderId' };
const UserId = (s: string) => s as UserId;
function cancel(orderId: OrderId) { /* ... */ }
cancel(UserId('u1'));   // compile error: a UserId is not an OrderId
```

Zero runtime cost. Stops swapped-argument bugs like `transfer(toId, fromId)`.

### Fixed sets: union literals vs enums

```ts
type SpotSize = 'SMALL' | 'MEDIUM' | 'LARGE';          // type only, zero runtime code
const CHANNELS = ['EMAIL', 'SMS', 'PUSH'] as const;     // a list you can loop over...
type Channel = (typeof CHANNELS)[number];               // ...and the union from it
enum VehicleType { BIKE = 'BIKE', CAR = 'CAR' }         // string enum: runtime object + type
const RATE: Record<SpotSize, number> = { SMALL: 10, MEDIUM: 20, LARGE: 50 }; // every key required
```

Prefer union literals or `as const` arrays. String enums are fine. **Avoid numeric enums**: any number is accepted and reverse mapping surprises people.

### States: discriminated unions + exhaustive switch

```ts
type Payment =
  | { status: 'CREATED';  id: PaymentId; amount: Money }
  | { status: 'CAPTURED'; id: PaymentId; amount: Money; txnId: string }
  | { status: 'FAILED';   id: PaymentId; amount: Money; reason: string };

function label(p: Payment) {
  switch (p.status) {
    case 'CREATED':  return 'pending';
    case 'CAPTURED': return `paid (${p.txnId})`;       // txnId is known to exist here
    case 'FAILED':   return `failed: ${p.reason}`;
    default: { const x: never = p; return x; }         // compile error if a state is added and missed
  }
}
```

A "captured payment without a `txnId`" cannot be written. For states with lots of behaviour, move to the State pattern (L22). For legal transitions, keep a table:

```ts
const NEXT: Record<Payment['status'], Payment['status'][]> = { CREATED: ['CAPTURED', 'FAILED'], CAPTURED: [], FAILED: [] };
```

### Errors: a small typed hierarchy

```
DomainError (abstract, has code + httpStatus)
├── ValidationError        400   bad input at the boundary
├── NotFoundError          404   id does not exist
├── ConflictError          409   state does not allow it (already captured, seat taken)
│   └── InvalidTransition
└── InsufficientFundsError 422   a business rule said no
```

```ts
abstract class DomainError extends Error {
  abstract readonly code: string;
  abstract readonly httpStatus: number;
  constructor(message: string) { super(message); this.name = new.target.name; }
}
class NotFoundError extends DomainError { readonly code = 'NOT_FOUND'; readonly httpStatus = 404; }
```

The API layer maps any `DomainError` with one `catch`, and tests can assert `toThrow(InsufficientFundsError)`.

**Throw or return a Result?** Throw for rule violations in a machine-coding round: it is shorter and reads well. A `Result<T, E>` (`{ ok: true, value } | { ok: false, error }`) is good when failure is a normal, frequent outcome (parsing input, validating a form) and you want the compiler to force handling.

### How to spot it in a problem statement

- Amounts, prices, balances, fares → `Money`.
- "status", "state", "can only X after Y" → discriminated union + transition table.
- "types of", "one of" (vehicle types, channels, split types) → union literals, `Record<Union, ...>` tables.
- "should fail if", "not allowed", "invalid" → a named error class per case.
- Ids of different things passed around → branded ids.

## In TypeScript

**Before:** `status: string`, `amount: number`, `return false`. **After** (the core of [demo.ts](demo.ts)):

```ts
class Wallet {
  private constructor(readonly id: WalletId, private balance: Money, private status: 'ACTIVE' | 'FROZEN') {}
  static open(id: WalletId) { return new Wallet(id, Money.zero('INR'), 'ACTIVE'); }
  debit(amount: Money) {
    if (this.status === 'FROZEN') throw new ConflictError(`wallet ${this.id} is frozen`);
    if (this.balance.lessThan(amount)) throw new InsufficientFundsError(this.balance, amount);
    this.balance = this.balance.subtract(amount);   // the only way balance changes
  }
}
```

## Trade-offs / when NOT to use it

- Do not wrap every string. `Money`, ids and anything with rules earn a type; a `displayName` does not.
- Clever types (conditional types, deep mapped types) cost reading time in a 90-minute round. Keep it to unions, `Record`, `readonly`, small generics.
- `bigint` money does not serialise to JSON directly. Convert at the boundary (`paise.toString()`), or use integer `number` paise if amounts stay below 2^53.
- A `Result` type everywhere makes simple code noisy. Mix: throw for rule violations, `Result` for parsing.
- Class-heavy value objects allocate more objects. Irrelevant for LLD rounds; for hot paths, plain readonly records are fine.

## Common mistakes

- `amount: number` in rupees with decimals. `0.1 + 0.2 !== 0.3`.
- `readonly items: Item[]` and thinking the array is frozen. `push` still works; use `readonly Item[]`.
- `private` fields reached through `(x as any)`. It is compile-time only; use `#field` for real privacy if asked.
- Optional fields for state-specific data (`txnId?`) instead of a discriminated union.
- `throw new Error('failed')` everywhere, so callers match on message strings.
- Forgetting `this.name = new.target.name`, so logs show `Error` for every subclass.
- Validation scattered across services instead of in the value object factory.

## Say this in the interview

> "Money is a value object in paise with a currency, immutable, created through a factory that validates. So no float errors, and I can't add INR to USD by accident."

> "I model the payment as a discriminated union on status, so a captured payment always has a transaction id, and the exhaustive switch fails to compile if someone adds a state and forgets to handle it."

> "Every rule violation is a named `DomainError` subclass with a code and an HTTP status. The controller has one catch that maps them, and tests assert on the error class, not the message."

## Your experience hook

- Payment orchestration: provider amounts arrive in different units (paise vs rupees, string vs number). A `Money` value object at the adapter boundary is exactly where that bug class dies.
- Webhooks arriving out of order is why payment status should be a union with a legal-transition table: `CAPTURED → PENDING` gets rejected instead of overwriting.

## Self-test

<details><summary>1. Model a ride: REQUESTED, ACCEPTED (driverId), ONGOING (driverId, startedAt), COMPLETED (adds fare).</summary>

A discriminated union on `status`, each variant with only its own fields. Then a `switch` with a `never` default, and a transition table `REQUESTED → ACCEPTED → ONGOING → COMPLETED` (plus `CANCELLED` from the first two).
</details>

<details><summary>2. Why store money as integer paise?</summary>

Binary floats cannot represent most decimals exactly (`0.1 + 0.2 = 0.30000000000000004`). Integers are exact. Convert to rupees only for display.
</details>

<details><summary>3. <code>readonly seats: Seat[]</code>. Can a caller add a seat?</summary>

Yes, with `seats.push()`. `readonly` only blocks reassigning the property. Use `readonly Seat[]` (or `ReadonlyArray<Seat>`) to block mutation methods.
</details>

<details><summary>4. Entity or value object: an address on an order? A user?</summary>

The order's shipping address is a value object (no identity; replace it as a whole). A user is an entity (has an id and changes over time).
</details>

<details><summary>5. When would you return a Result instead of throwing?</summary>

When failure is an expected, frequent outcome the caller must handle, such as parsing user input or validating a CSV row. For "this should not happen given the rules", throw a typed error.
</details>

<details><summary>6. What does a branded type buy you?</summary>

Two ids that are both strings at runtime become different types at compile time, so `transfer(toId, fromId)` with swapped arguments does not compile. Zero runtime cost.
</details>

## Go deeper

- [L22 State pattern](../../4-behavioral/L22-state/README.md): when a union is not enough and each state needs behaviour
- [L31 Repository and DI](../L31-repository-and-di/README.md): where entities are loaded and saved
- [L34 Testing your design](../L34-testing-designs/README.md): asserting on typed errors
- [H38 Payments domain](../../../hld/6-building-blocks/H38-payments-domain/README.md): money, ledgers and payment states at scale
- Practice: [19 Payment wallet](../../problems/19-payment-wallet/README.md), [09 Splitwise](../../problems/09-splitwise/README.md)
- Books: *Effective TypeScript* (type design chapter); Evans, *Domain-Driven Design* (entities, value objects, aggregates)
