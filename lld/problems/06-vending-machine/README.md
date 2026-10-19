# 06 · Vending Machine

> Asked at: Amazon, Flipkart, PhonePe, Swiggy, Juspay. The standard test of the State pattern.
> Time box: **60 min** (10 min design, 40 min code, 10 min tests and extensions)
> Patterns you should reach for: **State** (machine behaviour), **Strategy** (making change)

## Problem statement (as the interviewer says it)

"Design a vending machine. It sells products from slots. Users insert coins, pick a product, and get the product and their change.
They can cancel and get their money back. An operator can put the machine in maintenance to restock it.
The machine has a limited number of coins for change."

## Step 1: clarify (ask these out loud)

Ask these before writing any code. The assumed answers below are what the tests expect.

| Question | Assumed answer |
|---|---|
| Which coins? | ₹1, ₹2, ₹5, ₹10. Any other coin is rejected |
| Notes, cards, UPI? | Out of scope. Mention them as extensions |
| States? | `IDLE` → (coin) → `HAS_MONEY` → (select ok or cancel) → `IDLE`. `IDLE` ↔ `MAINTENANCE` |
| Select with no money? | Throw |
| Not enough money, unknown code, sold out? | Throw. Keep the money and stay in `HAS_MONEY` |
| How is change made? | Fewest coins, largest first (greedy), from the coins in the machine **plus** the coins just inserted |
| Machine cannot make change? | Throw. Nothing changes: no stock taken, no coins kept. The user can cancel |
| Cancel? | Return the exact coins inserted. Cancel in `IDLE` returns `[]` |
| Maintenance? | Only from `IDLE`. No coins or sales in maintenance |
| Restock (`addProduct`)? | Allowed in `IDLE` and `MAINTENANCE`, not during a purchase. Adds to the existing quantity |
| One purchase per session? | Yes. After a sale the change comes back and the machine is `IDLE` |

## Step 2: public API (what the tests call)

```ts
const vm = new VendingMachine({
  float: { 1: 10, 2: 10, 5: 10, 10: 10 },   // coins for change
  changeMaker: new GreedyChangeMaker(),       // optional, this is the default
});

vm.addProduct('A1', 'Chips', 15, 5);           // code, name, price, quantity
vm.insertCoin(10);
vm.insertCoin(10);
vm.state;                                      // → 'HAS_MONEY'
vm.balance;                                    // → 20
vm.select('A1');                               // → { product: { code, name, price }, change: [5] }
vm.cancel();                                   // → Coin[] (the inserted coins)
vm.startMaintenance();  vm.endMaintenance();
vm.stock('A1');  vm.coinCount(10);             // → number

interface ChangeMaker { makeChange(amount: number, available: ReadonlyMap<Coin, number>): Coin[] | null }
```

## Step 3: entities (try them yourself first)

<details>
<summary>Reveal a good entity list</summary>

- `VendingMachine`: the facade. Every action is delegated to the current state
- `State` (interface): `insertCoin`, `select`, `cancel`, `startMaintenance`, `endMaintenance`. One class per state: `IdleState`, `HasMoneyState`, `MaintenanceState`
- `Context`: the data the states work on (slots, coin inventory, inserted coins). Internal
- `Slot`: code, name, price, quantity
- `ChangeMaker` (Strategy): `GreedyChangeMaker` by default

Why the State pattern? Without it, every method starts with `if (state === 'IDLE') ... else if (state === 'HAS_MONEY') ...`. Adding a state (for example `DISPENSING` or `OUT_OF_ORDER`) means editing every method. With it, you add one class, and each class shows clearly what is legal in that state.

States hold no data, so one shared instance per state is enough.

Do all checks first and all changes last in `purchase`. Then a failure in the middle (no change) leaves nothing half-done. This is the same idea as a DB transaction.

</details>

## Step 4: implement

- Write your code in `starter.ts`. Keep the exported names.
- Run `npx vitest run lld/problems/06-vending-machine` until it's green.
- Don't open `reference.ts` until your tests pass, or until you've spent 60 minutes.

## Step 5: extensions interviewers ask after you finish

1. **Greedy fails with limited coins.** Machine has one ₹5 and three ₹2, change due is ₹6. Greedy takes ₹5 and is stuck, but 2+2+2 works. Fix: a bounded coin-change search (DP or backtracking) as another `ChangeMaker`. The test file has one.
2. **Dispensing can fail** (the product gets stuck). Add a `DISPENSING` state. If the motor reports failure, refund and mark the slot faulty.
3. **UPI or card payment.** Add a `Payment` strategy. A card payment is async: a `PAYMENT_PENDING` state waits for the bank callback, with a timeout that goes back to `IDLE`.
4. **Several products in one session.** Keep the balance after a sale and stay in `HAS_MONEY` until cancel or a timeout.
5. **Remote monitoring.** Emit events (sold, low stock, low coins) so a backend can plan restocking: the Observer pattern.
6. **Money as integers.** Prices here are whole rupees. If you add paise, keep amounts as integers in paise. Never use floats for money.

## Self-check before you call it done

- [ ] No `switch (state)` inside `VendingMachine`. It only delegates.
- [ ] A failed `select` leaves stock, coins and balance unchanged.
- [ ] Cancel returns the same coins the user inserted.
- [ ] Change making is a Strategy you can swap.
- [ ] You can draw the state diagram with every arrow and its trigger.

## Concepts used

- [State pattern](../../4-behavioral/L22-state/README.md) · [Strategy](../../4-behavioral/L20-strategy/README.md) · [SOLID](../../1-foundations/L04-solid-srp-ocp/README.md) · [Machine-coding framework](../../5-machine-coding/L30-machine-coding-framework/README.md)
- Visual: [State pattern: vending machine](../../4-behavioral/L22-state/visual.html)
