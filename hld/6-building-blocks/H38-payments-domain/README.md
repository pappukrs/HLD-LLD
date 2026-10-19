# H38 · Payments: ledger, PSPs, reconciliation

> **Time:** ~60 min · **Visual:** [visual.html](visual.html) · **Code:** [demo.ts](demo.ts) (`npx tsx hld/6-building-blocks/H38-payments-domain/demo.ts`)
> **Builds on:** [H22 Delivery semantics and idempotency](../../4-async/H22-delivery-semantics/README.md) · [H23 Distributed transactions](../../4-async/H23-distributed-transactions/README.md) · [H12 Transactions and isolation](../../3-databases/H12-transactions-isolation/README.md) · [H31 Security and auth](../../5-reliability/H31-security-auth/README.md) · **Used in:** Payment system, Digital wallet, Food delivery checkout, Ticket booking, Hotel booking · LLD: [Payment wallet](../../../lld/problems/19-payment-wallet/README.md)

## The idea in one line

Money moves through parties you do not control, so a payment system is a **forward-only state machine** driven by unreliable external calls: every step is **idempotent**, every movement is a balanced **double-entry ledger** record, every "unknown" is resolved by status checks and webhooks, and **reconciliation** against the PSP and bank files is the final truth.

## Why it matters (the problem it solves)

- The bank call times out. Was the customer debited? Retrying with a new id can charge twice; giving up can lose a real payment.
- A webhook says `captured` before your API call returns, or arrives twice, or a day late, or out of order.
- The balance column says ₹5,000, and nobody can explain how it got there.
- `0.1 + 0.2 = 0.30000000000000004` in JavaScript.
- Storing card numbers puts every server, log and engineer in PCI scope.

Every fintech round (Razorpay, PhonePe, Cred, Juspay, Paytm) and every checkout in a "design Swiggy / BookMyShow" question needs these ideas.

## How it works

### 1. Who is who

| Party | Role | Indian examples |
|---|---|---|
| Merchant | Sells; integrates a PSP | Swiggy, a D2C store |
| **PSP / gateway / aggregator** | Checkout, APIs, routing, merchant settlement | Razorpay, PayU, Cashfree, Stripe; Juspay orchestrates across PSPs |
| **Acquirer** | Merchant-side bank | HDFC, ICICI, Axis (acquiring) |
| **Card network** | Routes messages, runs clearing | Visa, Mastercard, RuPay |
| **Issuer** | Customer's bank; approves, runs OTP/3DS | SBI, HDFC, Kotak |
| **NPCI (UPI)** | Central UPI switch between PSP banks | PhonePe, Google Pay are apps on top of PSP banks |

### 2. Card lifecycle: authorise, capture, settle

```
authorise:  Merchant -> PSP -> Acquirer -> Network -> Issuer   issuer approves, places a HOLD (no money moved)
capture:    Merchant -> PSP                                    merchant claims the held amount
settle:     Issuer -> Network -> Acquirer -> PSP -> Merchant   T+1 to T+2, minus MDR + GST
refund:     a NEW money movement linked to the payment (not an undo)
chargeback: customer disputes via issuer; merchant sends evidence or loses funds
```

Auto-capture is simple. Manual capture is needed when the final amount changes (hotels, marketplaces). Uncaptured auths expire after some days and are released.

### 3. UPI in one picture

```
Payer app -> Payer PSP bank -> NPCI switch -> Remitter bank (debit, RRN)
                                           -> Beneficiary bank (credit)
                               NPCI -> Merchant PSP -> webhook to merchant
```

- **Intent / QR**: `upi://pay?pa=merchant@psp&am=499.00&tr=order_123&cu=INR`. The user picks an app and enters the PIN.
- **Never trust the app's return value.** Confirm on the server via the PSP webhook or status API.
- UPI has **pending / deemed** outcomes. Failed debits must auto-reverse by T+1 (RBI TAT rules), so reconciliation matters.

### 4. The payment state machine and UNKNOWN

```
CREATED --send--> PENDING --ok--> AUTHORIZED --capture--> CAPTURED --refund--> REFUNDED
                     |  \--declined--> FAILED
                     '--timeout / 5xx--> UNKNOWN --status API or webhook--> AUTHORIZED | FAILED
```

- **A timeout is not a failure.** Mark `UNKNOWN`, show "processing", and **never** charge again with a new reference.
- Resolve UNKNOWN by: (1) PSP webhooks, (2) a poller calling the status API with backoff (10 s, 30 s, 2 min, 10 min...), (3) the daily reconciliation file.
- Transitions only move **forward**, with a conditional update: `UPDATE payments SET status='CAPTURED' WHERE id=? AND status IN ('PENDING','UNKNOWN','AUTHORIZED')`. A late `failed` webhook for a CAPTURED payment is logged and ignored.
- Late success after you told the user "failed": either fulfil, or auto-refund. Pick one policy and apply it everywhere.

### 5. Idempotency at three points

| Point | Key | Stops |
|---|---|---|
| Client -> your API | `Idempotency-Key` header (created when checkout loads), unique in DB | Double click, client retry: same result returned |
| Your service -> PSP | **Your attempt id** sent as the PSP reference on every retry | PSP dedupes; you can query status by it. New attempt id only after a **confirmed** failure |
| PSP -> your webhook | PSP **event id**, unique in a processed-events table | Duplicate webhook deliveries |

This is "at-least-once delivery + idempotent processing = exactly-once effect" ([H22](../../4-async/H22-delivery-semantics/README.md)).

### 6. Webhooks done right

```ts
app.post('/webhooks/psp', express.raw({ type: 'application/json' }), async (req, res) => {
  const expected = createHmac('sha256', SECRET).update(req.body).digest();        // raw bytes
  const got = Buffer.from(String(req.headers['x-psp-signature'] ?? ''), 'hex');
  if (got.length !== expected.length || !timingSafeEqual(got, expected)) return res.sendStatus(400);
  await inbox.insertIgnoreDuplicate(eventId(req.body), req.body);                  // store first
  res.sendStatus(200);                                                             // ack fast
});
```

- HMAC over the **raw body** (re-serialised JSON will not match), constant-time compare. Stripe also signs a timestamp to stop replays.
- Ack fast, process from a queue, dedupe by event id, expect **out-of-order** events. PSPs retry with backoff (Stripe up to 3 days). Webhooks can still be missed: keep the poller and reconciliation.

### 7. Double-entry ledger

Every money movement is a **journal transaction** with two or more **entries** that sum to **zero**. Entries are append-only; mistakes are fixed with **reversal** entries, never `UPDATE`.

A ₹1,000 card payment on a PSP's books, with 2% MDR and 18% GST on the fee, in paise:

| Account | Debit | Credit |
|---|---|---|
| Acquirer receivable | 1,00,000 | |
| Merchant payable | | 97,640 |
| Fee revenue | | 2,000 |
| GST payable | | 360 |
| **Total** | **1,00,000** | **1,00,000** |

```sql
CREATE TABLE journal (
  txn_id       BIGINT PRIMARY KEY,
  event_key    TEXT UNIQUE NOT NULL        -- e.g. 'pay_123:captured': a replay cannot post twice
);
CREATE TABLE ledger_entries (
  entry_id     BIGINT PRIMARY KEY,
  txn_id       BIGINT NOT NULL REFERENCES journal,
  account_id   BIGINT NOT NULL,
  amount_minor BIGINT NOT NULL,            -- signed: +debit, -credit, in paise
  currency     CHAR(3) NOT NULL
);
-- invariant: SUM(amount_minor) GROUP BY txn_id, currency = 0
```

- **Balance = sum of entries.** For speed, keep a cached balance row updated **in the same DB transaction**, with `WHERE balance >= :amount` (or a version check) to stop overdrafts and races.
- A daily job checks every cached balance against the sum of its entries.
- Ledger + outbox event in one transaction ([H23](../../4-async/H23-distributed-transactions/README.md)), so the ledger and downstream services never disagree.

### 8. Money as integer minor units

- Store **integers** in the smallest unit (paise, cents) as `BIGINT`, plus an ISO 4217 currency. JPY has 0 decimals, KWD and BHD have 3.
- Never floats. Pick one rounding rule (often half-even) and allocate split remainders explicitly: ₹100 / 3 = 3,333 + 3,333 + 3,334 paise.
- `node-postgres` returns `BIGINT` as a **string**. Keep it a string or `BigInt` at the boundary.

### 9. Reconciliation: the final truth

Compare three sources daily: **internal ledger** vs **PSP settlement report** vs **bank statement**. Match on PSP payment id, merchant order id, RRN/UTR, plus amount and status.

| Break | Typical cause | Action |
|---|---|---|
| In PSP, not in ledger | Missed webhook, UNKNOWN never resolved | Create or fix the record from PSP data |
| In ledger, not in PSP | Never reached PSP | Mark failed; refund if debited |
| Amount mismatch | Partial capture, fee or FX difference | Post an adjustment entry |
| Status mismatch | Late success or late failure | Apply the policy (fulfil or refund) |
| Settled ≠ expected | Fees, chargebacks, holds | Book fees; ticket to the PSP |

Auto-resolve known patterns; everything else goes to an ops queue with ageing and alerts.

### 10. Multi-PSP routing and PCI scope

- **Routing**: send each payment to the PSP with the best live success rate for that method/bank (Juspay-style), with a circuit breaker per PSP. Costs: more recon work and one adapter per PSP.
- **PCI DSS**: any system that stores, processes or transmits card numbers is in scope. Use the PSP's **hosted checkout / iframe fields / SDK**; you only get a **token**. Scope shrinks to SAQ A. CVV is never stored.
- India: since **1 Oct 2022**, merchants may not store card numbers (RBI card-on-file tokenisation); saved cards use network tokens.

## In TypeScript

```ts
type Status = 'CREATED' | 'PENDING' | 'UNKNOWN' | 'AUTHORIZED' | 'CAPTURED' | 'FAILED' | 'REFUNDED';
const NEXT: Record<Status, Status[]> = {
  CREATED: ['PENDING'], PENDING: ['AUTHORIZED', 'FAILED', 'UNKNOWN'], UNKNOWN: ['AUTHORIZED', 'FAILED'],
  AUTHORIZED: ['CAPTURED', 'FAILED'], CAPTURED: ['REFUNDED'], FAILED: [], REFUNDED: [],
};

function transition(p: Payment, to: Status, eventKey: string, entries: Entry[]) {
  if (!NEXT[p.status].includes(to)) return 'ignored';                     // forward-only
  if (journal.has(eventKey)) return 'duplicate';                           // posted once per event
  if (entries.reduce((s, e) => s + e.amountMinor, 0n) !== 0n) throw new Error('unbalanced');
  db.transaction(() => { p.status = to; journal.add(eventKey); ledger.push(...entries); outbox.push({ to, id: p.id }); });
  return 'applied';
}
```

[demo.ts](demo.ts) runs a full story in paise with `bigint`: idempotent create, a PSP timeout that becomes UNKNOWN and is resolved by a status poll, a duplicate and an out-of-order webhook, a balanced ledger with MDR + GST, a partial refund, and a reconciliation run that finds two breaks.

## Trade-offs / when NOT to use it

| Choice | Option A | Option B |
|---|---|---|
| Capture | Auto-capture: simple | Manual capture: when the final amount changes |
| PSP setup | One PSP: simple integration and recon | Multi-PSP routing: higher success and resilience, more recon and adapters |
| Balance | Sum entries on read: always right, slow at scale | Cached balance in the same transaction: fast, needs a daily check |
| Ledger store | One Postgres with row locks: strong, simple | Sharded by account: scales, cross-shard transfers need sagas |
| Consistency | Strong (CP) for balances and ledger | Eventual for dashboards, notifications, analytics |

Do not build your own ledger service for a small shop that takes payments through one PSP: the PSP dashboard and a `payments` table with a state machine are enough. The full ledger pays off when you hold money (wallets, marketplaces, payouts, lending).

## Common mistakes

- Treating a timeout as FAILED and retrying with a new reference: double charge.
- Trusting the client or the UPI app's "SUCCESS" without a server-side status check.
- Verifying the webhook signature on parsed JSON instead of the raw body.
- Processing webhooks inline and slowly; the PSP times out and retries, creating duplicates.
- A single mutable `balance` column with no entries: no audit trail, no way to explain or fix.
- Floats for money, or `Number(bigintString)` everywhere.
- Allowing backward transitions (CAPTURED -> FAILED from a late webhook).
- No reconciliation, or reconciliation that only checks counts.
- Logging full card numbers or tokens in request logs.

## Say this in the interview

> "A payment is a forward-only state machine in Postgres. The create API takes an Idempotency-Key, and every call to the PSP carries our attempt id. A timeout moves the payment to UNKNOWN, not FAILED: the user sees 'processing', a poller checks the PSP status with backoff, and webhooks, verified by HMAC on the raw body and deduped by event id, can also move it forward."

> "Each state change writes balanced double-entry ledger entries in paise and an outbox event in the same transaction, keyed by a unique event key so it posts once. A nightly job reconciles the ledger against the PSP settlement file and the bank statement and sends breaks to an ops queue. Card data never touches our servers: hosted fields and tokens only, so we stay in SAQ A."

## Your experience hook

- SenseGrass payment orchestration: you built idempotency keys, webhook handling and retries across **3 providers via the Adapter pattern**. Say: "Adding a provider meant one new adapter; the core state machine and ledger did not change."
- You used a **state machine** (created -> pending -> success/failed) to handle out-of-order webhooks. That is exactly the forward-only rule above; mention the conditional update that makes it race-safe.
- Your 10x answer is already in your notes: outbox + queue so the charge and the DB write cannot diverge, and a reconciliation job against the provider. Say both.

## Numbers to remember

| Fact | Value |
|---|---|
| UPI volume | ~20 billion transactions a month (2025) |
| Card settlement to merchant | T+1 to T+2 |
| Typical MDR (cards) | ~1.5 to 2% + 18% GST on the fee; UPI P2M is zero MDR for most merchants |
| Stripe webhook retries | up to 3 days; idempotency keys kept at least 24 h |
| UPI failed-debit reversal | T+1 (RBI TAT rules) |
| `2^53 − 1` paise | ≈ ₹90 lakh crore: still use BigInt/strings at the DB boundary |
| Card-on-file tokenisation (India) | in force since 1 Oct 2022 |

## Self-test

<details><summary>1. Authorised vs captured: has money moved?</summary>

Authorised: no, only a hold on the customer's funds. Captured: the merchant has claimed it; actual funds move in clearing and settlement.
</details>

<details><summary>2. The PSP call timed out. What do you do?</summary>

Mark the payment UNKNOWN, show "processing", and never retry with a new reference. Resolve with the status API (using your attempt id), webhooks, or the reconciliation file.
</details>

<details><summary>3. The user pressed Pay twice, 300 ms apart. What stops a double charge?</summary>

The same Idempotency-Key for the same checkout. The second request hits the unique constraint and gets the first result. The order also allows only one active attempt.
</details>

<details><summary>4. Webhook says CAPTURED while your API call is still waiting. Race?</summary>

Both paths use the same forward-only conditional update. Whichever arrives first wins; the other is a no-op. Ledger posting is keyed by event, so it happens once.
</details>

<details><summary>5. Why verify the webhook signature on the raw body?</summary>

Parsing and re-serialising can change whitespace, key order or number formats, so the HMAC will not match. Sign and verify the exact bytes received.
</details>

<details><summary>6. Why double-entry instead of a balance column?</summary>

Every change is explained by balanced, append-only entries. You can audit, rebuild balances, and prove money was not created or lost (the sum is always zero). Fixes are reversal entries, so history is kept.
</details>

<details><summary>7. Reconciliation finds a payment in the PSP report but not in your ledger. Cause and fix?</summary>

Usually a missed webhook or an UNKNOWN that never resolved. Create or fix the record from PSP data, post the ledger entries, and fulfil or refund per policy.
</details>

<details><summary>8. How do you design refunds?</summary>

A separate refund entity with its own idempotency key and state machine. Check refunded total ≤ captured under a row lock. Post reversal entries. Refunds also go through reconciliation.
</details>

## Go deeper

- Case studies: [Payment system](../../case-studies/08-payment-system/README.md) · [Digital wallet](../../case-studies/28-digital-wallet/README.md) · [Ticket booking](../../case-studies/09-ticket-booking/README.md) · [Hotel booking](../../case-studies/23-hotel-booking/README.md)
- LLD: [Payment wallet](../../../lld/problems/19-payment-wallet/README.md) (ledger + idempotency in code)
- Related: [H22 Idempotency](../../4-async/H22-delivery-semantics/README.md) · [H23 Saga and outbox](../../4-async/H23-distributed-transactions/README.md) · [H36 Batch reconciliation](../H36-batch-stream/README.md) · [H39 Data residency](../H39-deployment-multi-region/README.md)
- Archive notes: [hld-parts/part7.md](../../../archive/notes/hld-parts/part7.md) (payment system) · [hld-parts/part6b.md](../../../archive/notes/hld-parts/part6b.md) (webhook delivery)
- Alex Xu and Sahn Lam, *System Design Interview* Vol. 2: "Payment System" and "Digital Wallet"; Stripe docs "Idempotent requests" and "Webhooks"; Razorpay payment states
