# 19 · Payment Wallet (ledger + idempotency)

> Asked at: Razorpay, Juspay, PhonePe, Paytm, Cred, Amazon Pay. Expect it at any fintech.
> Time box: **90 min** (15 min design, 60 min code, 15 min tests and extensions)
> Patterns you should reach for: **Double-entry ledger**, **Idempotency key** (a stored Command result), **Strategy** (fees), **Repository** (ledger store, if asked)

## Problem statement (as the interviewer says it)

"Design a wallet. Users add money, send money to other users, and get refunds.
The balance must always be correct. A client may retry the same request after a timeout, and we must not move the money twice."

## Step 1: clarify (ask these out loud)

Ask these before writing any code. The assumed answers below are what the tests expect.

| Question | Assumed answer |
|---|---|
| How is money stored? | Integer **paise** (`₹10.50` = `1050`). Floats are rejected. Amounts must be positive |
| Where is the balance stored? | Nowhere. It is **derived** from ledger entries: credits minus debits |
| What does one transaction write? | Double-entry: total debits = total credits. A transfer debits the sender and credits the receiver |
| Where does deposited money come from? | A system account `EXTERNAL` (bank, UPI). It is the only account that may go negative |
| Overdraft? | Not allowed. Insufficient funds throws, and nothing is written |
| Retries? | Every write takes an `idempotencyKey`. Same key + same request → the first result, no new entries |
| Same key, different request? | Throw. This is a client bug |
| Key of a failed request? | Not stored. The client can retry with the same key (for example, after a top-up) |
| Refunds? | Only for transfers. Partial refunds allowed. Total refunded ≤ original amount. The fee is not refunded |
| Refund when the receiver spent the money? | Fails with insufficient funds |
| Fees? | A pluggable `FeePolicy`. Default: no fee. The fee is credited to the `FEES` account |
| Currencies, KYC limits, holds/authorisations? | Out of scope. Mention them as extensions |

## Step 2: public API (what the tests call)

```ts
const wallet = new Wallet({
  feePolicy: new NoFee(),            // optional; any { feeFor(amountPaise): number }
  clock: () => Date.now(),           // injectable, so tests control time
});

wallet.openAccount('alice');
wallet.deposit('alice', 100_000, 'dep-1');                    // → Transaction
const t = wallet.transfer({ from: 'alice', to: 'bob', amountPaise: 25_050, idempotencyKey: 'pay-42' });
wallet.refund(t.id, 'refund-1', 10_000);                      // partial; omit the amount for the rest

wallet.balance('alice');           // → number (paise), derived from entries
wallet.entries('alice');           // → LedgerEntry[] { transactionId, accountId, direction, amountPaise, at }
wallet.getTransaction(t.id);       // → Transaction { id, type, from, to, amountPaise, feePaise, at, refundOf }
wallet.trialBalance();             // → { debits, credits }; always equal
```

`EXTERNAL_ACCOUNT` and `FEES_ACCOUNT` are exported constants. The internals are **your design**.

## Step 3: entities (try them yourself first)

<details>
<summary>Reveal a good entity list</summary>

- `Wallet`: the facade. Owns accounts, the ledger, transactions and the idempotency store
- `LedgerEntry`: an immutable row. The ledger is **append-only**. You never update or delete a row; a refund is a new transaction
- `Transaction`: the business event (DEPOSIT, TRANSFER, REFUND). It groups 2 or more entries
- `Posting`: one leg of a transaction before it is written. `post()` checks that debits = credits, then appends all legs together (all or nothing)
- Idempotency store: `key → { fingerprint of the request, stored Transaction }`. This is the Command idea: the request is a value you can compare and replay
- `refunded`: `original txn id → total refunded`, so the cap check is O(1)
- `FeePolicy` (interface) → `NoFee`. Later: percentage, slab, merchant-specific

Order inside every write: idempotency check → validate → check funds → post → store the key.

</details>

## Step 4: implement

- Write your code in `starter.ts`. Keep the exported names.
- Run `npx vitest run lld/problems/19-payment-wallet` until it's green.
- Don't open `reference.ts` until your tests pass, or until you've spent 90 minutes.

## Step 5: extensions interviewers ask after you finish

1. **Two transfers from the same wallet at the same time.** In one Node process, a synchronous method is safe. In a database, the check and the insert must be one transaction: lock the account row (`SELECT … FOR UPDATE`), or use a conditional update on a cached balance (`UPDATE … SET balance = balance - ? WHERE id = ? AND balance >= ?`).
2. **Two retries arrive at the same time.** Put a unique index on the idempotency key. Insert the key first with status `IN_PROGRESS`. The second request sees the row and waits or gets `409`.
3. **Balance is O(entries).** Keep a balance snapshot per account (updated in the same DB transaction), or a checkpoint every N entries. The ledger stays the source of truth; you can rebuild the snapshot from it.
4. **Holds.** A card-style authorisation: move money to a `HOLD` account, then capture or release it.
5. **Idempotency key expiry.** Keep keys for a limited time (for example 24 hours) and scope them per client.
6. **Reconciliation.** Compare your ledger with the bank or PSP report every day, and alert on any difference.

## Self-check before you call it done

- [ ] No `balance` field that you update by hand. Balance = sum of entries.
- [ ] Every transaction is balanced: debits = credits. `trialBalance()` proves it.
- [ ] No floats anywhere. `Number.isSafeInteger` guards every amount.
- [ ] A failed call writes nothing: no entries, no idempotency key, no refund total.
- [ ] A retry with the same key returns the same transaction id.

## Concepts used

- [Command and Memento](../../concepts/patterns/p13-command.md) · [Repository and DI](../../concepts/patterns/p18-repository-di.md) · [Strategy pattern](../../concepts/patterns/p10-strategy.md) · [Concurrency in Node LLD](../../concepts/06-concurrency-in-node.md)
- HLD: [Payments domain](../../../hld/concepts/35-payments-domain.md) · [Idempotency and delivery semantics](../../../hld/concepts/19-idempotency-delivery-semantics.md) · [SQL deep dive](../../../hld/concepts/10-sql-deep-dive.md) · [Payment System](../../../hld/problems/08-payment-system/) · [Digital Wallet / UPI](../../../hld/problems/28-digital-wallet/)
- Visuals: [Delivery semantics and idempotency](../../../visuals/v11-delivery-semantics.html) · [Transaction isolation levels](../../../visuals/v20-isolation-levels.html)
