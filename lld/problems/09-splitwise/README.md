# 09 · Splitwise

> Asked at: Flipkart, Razorpay, PhonePe, Swiggy, Atlassian, CRED. One of the most common machine-coding problems in India.
> Time box: **75 min** (15 min design, 45 min code, 15 min tests and extensions)
> Patterns you should reach for: **Strategy** (split types), plus correct money handling and a greedy debt simplification

## Problem statement (as the interviewer says it)

"Design an expense sharing app like Splitwise. Users add expenses. One person pays, and the expense is split between some people:
equally, by exact amounts, or by percentage. Show how much each person owes each other person, and each person's total balance.
Users can settle up. Add a 'simplify debts' feature that reduces the number of payments needed."

## Step 1: clarify (ask these out loud)

Ask these before writing any code. The assumed answers below are what the tests expect.

| Question | Assumed answer |
|---|---|
| How is money stored? | Integer **paise**. Amounts that are not positive integers are rejected |
| Equal split that does not divide evenly? | ₹1 among 3 = 34, 33, 33 paise. Leftover paise go to the first people in the list |
| Exact split? | Shares must add up to the amount, or throw |
| Percent split? | Percentages must add up to 100. Shares are rounded so they still add up to the amount (largest remainder) |
| Is the payer part of the split? | Only if listed. The payer's own share is not a debt |
| Debts in both directions? | Netted. If A owes B ₹100 and B owes A ₹60, then A owes B ₹40 |
| Balance sign? | Positive = the group owes you. Negative = you owe the group. All balances add up to 0 |
| Settle up? | `settle(from, to, amount)`. Paying more than you owe is rejected |
| Simplify debts? | A list of payments that clears all balances, with at most (people − 1) payments. Does not change the stored data |
| Unknown user, duplicate user, same person twice in a split? | Throw |
| Groups, currencies, editing or deleting expenses? | Out of scope. Mention them as extensions |

## Step 2: public API (what the tests call)

```ts
const sw = new Splitwise();
sw.addUser('A'); sw.addUser('B'); sw.addUser('C');

sw.addExpense({ paidBy: 'A', amount: 30000, split: new EqualSplit(['A', 'B', 'C']), description: 'Dinner' });
sw.addExpense({ paidBy: 'B', amount: 1000,  split: new ExactSplit({ A: 400, C: 600 }) });
sw.addExpense({ paidBy: 'C', amount: 2000,  split: new PercentSplit({ A: 25, B: 75 }) });
// → Expense { id, description, paidBy, amount, shares: { A: 10000, B: 10000, C: 10000 } }

sw.owes('B', 'A');     // → paise B owes A after netting (never negative)
sw.balance('A');       // → number
sw.balances();         // → { A: ..., B: ..., C: ... }
sw.settle('B', 'A', 5000);
sw.simplify();         // → [{ from, to, amount }, ...]
sw.history();          // → Expense[]

interface SplitStrategy { shares(amount: number): Map<string, number> }
```

## Step 3: entities (try them yourself first)

<details>
<summary>Reveal a good entity list</summary>

- `Splitwise`: the facade. Owns users, the expense history and the ledger
- `SplitStrategy` (interface): `EqualSplit`, `ExactSplit`, `PercentSplit`. Each one turns an amount into shares. Later: `ShareSplit` (1:2:3), `AdjustmentSplit`
- `Expense`: an immutable record with the computed shares
- Ledger: `Map<"a|b", number>` with the pair in sorted order. Positive = a owes b. One number per pair, so netting is automatic
- `Debt`: `{ from, to, amount }`, the output of `simplify`

Why integer paise? `0.1 + 0.2` is `0.30000000000000004` in JavaScript. Over many expenses, float errors make balances not add up to zero. Every payments company stores minor units (paise, cents) as integers.

Why does `addExpense` check the sum again when the strategy already did? A custom strategy can have a bug. The ledger must never create or lose money, so the check lives at the boundary too.

How does `simplify` work? Compute each person's net balance. Repeat: the person who owes the most pays the person who is owed the most, `min(debt, credit)`. Each step clears at least one person, so there are at most n − 1 payments. Finding the true minimum number of payments is NP-hard, so this greedy method is the usual answer. Say that.

</details>

## Step 4: implement

- Write your code in `starter.ts`. Keep the exported names.
- Run `npx vitest run lld/problems/09-splitwise` until it's green.
- Don't open `reference.ts` until your tests pass, or until you've spent 75 minutes.

## Step 5: extensions interviewers ask after you finish

1. **Groups.** A `Group` has members and its own ledger. A user's total balance is the sum across groups. Simplify within a group only.
2. **Edit or delete an expense.** Do not edit the ledger in place. Reverse the old expense (add the opposite debts), then apply the new one. This is how a real ledger works: append-only, with reversal entries.
3. **Multiple currencies.** Keep a ledger per currency. Convert only for display, with a stored rate and time.
4. **Persistence.** Tables: `users`, `expenses`, `expense_shares (expense_id, user_id, amount)`, `settlements`. Balances are a query, or a cached table updated in the same DB transaction as the expense.
5. **Two people add expenses at the same time.** Updating a balance row with read-modify-write can lose an update. Use `UPDATE ... SET amount = amount + ?` or a row lock. See the concurrency card.
6. **Notify people.** "A added an expense and you owe ₹100": an Observer on `addExpense`.

## Self-check before you call it done

- [ ] No floats for money. Every share and balance is an integer.
- [ ] The sum of all balances is always 0.
- [ ] Shares of every split add up to the amount, including rounding cases.
- [ ] A new split type is one new class. No `switch (splitType)` in `Splitwise`.
- [ ] You can explain why `simplify` gives at most n − 1 payments.

## Concepts used

- [Strategy](../../4-behavioral/L20-strategy/README.md) · [Repository and DI](../../5-machine-coding/L31-repository-and-di/README.md) · [Concurrency in Node](../../5-machine-coding/L32-concurrency-in-node/README.md) · [Machine-coding framework](../../5-machine-coding/L30-machine-coding-framework/README.md)
- HLD link: [Payments domain (ledger, PSPs, reconciliation)](../../../hld/6-building-blocks/H38-payments-domain/README.md)
- Visual: [Strategy + Factory](../../4-behavioral/L20-strategy/visual.html)
