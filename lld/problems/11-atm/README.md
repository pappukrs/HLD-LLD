# 11 · ATM

> Asked at: Amazon, PhonePe, Paytm, Juspay, Goldman Sachs, and fintech machine-coding rounds.
> Time box: **90 min** (15 min design, 60 min code, 15 min tests and extensions)
> Patterns you should reach for: **State** (the ATM session), **Chain of Responsibility** (cash dispenser: 2000 → 500 → 100)

## Your v1 attempt: what to fix

Your first attempt is in [`v1-attempt.js`](./v1-attempt.js). It has a good shape (State classes, a transaction factory). These are the issues an interviewer will catch:

1. **Money bug: you debit the account before you check the cash.** In `AccountSelectedState.selectOperation`, `transaction.execute()` reduces the balance first. Only then do you call `checkAvailability`. If the ATM is short, you print "insufficient cash" but the customer has already lost the money. Fix: plan the notes first (no side effects), then debit, then dispense. If dispensing fails after the debit, credit the money back (a compensating action). In a payments interview this is the first thing they look for.
2. **No PIN attempt limit.** One wrong PIN ejects the card, and the next person can try again forever. Count failed attempts per card (in the bank, so another ATM doesn't reset the count) and block the card after 3.
3. **Accounts are named as strategies.** `AccountStrategy`, `SavingsAccount extends AccountStrategy`: a savings account is an entity, not an algorithm you swap at runtime. Name it `Account`. If withdrawal rules differ per type, that rule (limit, overdraft) can be a strategy the account holds.
4. **`TransactionState` is empty.** You switch to it and then every action prints "Invalid operation", so it adds nothing. Either remove it, or make it a real state (for example, it blocks a second request while cash is being counted).
5. **The dispenser doesn't break the amount into notes.** `availableCash -= amount` treats cash as one number. An ATM holds notes. 2600 must become 1 × 2000 + 1 × 500 + 1 × 100, and 250 must be rejected. Use a chain of note handlers: each one pays what it can and passes the rest on.
6. **Errors are `console.log` + `return false`.** The caller can't tell what went wrong, and tests can't check it. Throw errors with clear messages (or return a typed result).
7. **Hidden time.** `TXN${Date.now()}` makes ids collide in the same millisecond and makes tests flaky. Use a counter or inject an id generator.

## Problem statement (as the interviewer says it)

"Design an ATM. A user inserts a card, enters a PIN, and can check balance, withdraw cash and deposit money.
The ATM has a limited number of notes of each denomination. Talk to the bank for balances and PIN checks."

## Step 1: clarify (ask these out loud)

Ask these before writing any code. The assumed answers below are what the tests expect.

| Question | Assumed answer |
|---|---|
| Which states? | `IDLE` → `CARD_INSERTED` → `AUTHENTICATED` → (eject) → `IDLE` |
| Wrong action for the state (withdraw before PIN)? | Throw |
| Wrong PIN? | `enterPin` returns `false`. The card stays in |
| How many PIN attempts? | 3. The third wrong PIN blocks the card and ejects it. A blocked card can't be inserted again |
| Does a correct PIN reset the counter? | Yes |
| Who counts the attempts? | The bank, per card |
| Which notes? | Whatever the ATM is loaded with. The tests use 2000, 500, 100 (and 200 in one test) |
| How do we pick notes? | Largest note first. If big notes run out, use smaller ones |
| Amount can't be made with the notes left? | Throw, and **don't touch the balance** |
| Balance too low? | Throw. Cash stays in the machine |
| After a withdrawal? | Stay `AUTHENTICATED`. The user ejects the card when done |
| Deposit? | Credit the account (treat it as an envelope deposit; notes are not added to the dispenser) |
| Daily limits, account types, receipts? | Out of scope. Mention them as extensions |

## Step 2: public API (what the tests call)

```ts
const bank = new InMemoryBank();              // optional arg: maxPinAttempts = 3
bank.addAccount({ cardNumber: '4111-0001', pin: '1234', balance: 10_000 });

const atm = new ATM({ bank, cash: { 2000: 5, 500: 10, 100: 20 } });

atm.state;                // 'IDLE'
atm.insertCard('4111-0001');
atm.enterPin('1234');     // → true
atm.balance();            // → 10000
atm.withdraw(2600);       // → { amount: 2600, notes: { 2000: 1, 500: 1, 100: 1 }, balance: 7400 }
atm.deposit(500);         // → new balance
atm.ejectCard();
atm.cashAvailable();      // → total cash in the machine
bank.isBlocked('4111-0001');
```

`BankService` is an interface. The ATM only talks to it, so you can swap `InMemoryBank` for a real bank client.

## Step 3: entities (try them yourself first)

<details>
<summary>Reveal a good entity list</summary>

- `ATM`: the facade. Holds a context (bank, dispenser, current card, current state) and forwards every call to the current state
- `AtmState` (abstract) → `IdleState`, `CardInsertedState`, `AuthenticatedState`. The base class rejects every action; each state overrides only what it allows. States are stateless, so one instance each is enough
- `BankService` (interface) → `InMemoryBank`. Owns accounts, PINs, failed-attempt counts and blocking
- `CashDispenser`: builds a chain of `NoteHandler`s, largest note first. `plan(amount)` returns notes without side effects; `dispense(notes)` removes them
- `NoteHandler`: one denomination and its count. Pays what it can, passes the rest to `next`

The withdraw order is the core of the problem:

```
plan notes (no side effects)  → throws if the ATM can't pay
debit account                 → throws if the balance is low
dispense notes                → on failure, credit the account back
```

Relationships: ATM ◆— CashDispenser ◆— NoteHandler. ATM ⟶ BankService (dependency injection). ATM ⟶ AtmState (current state).

</details>

## Step 4: implement

- Write your code in `starter.ts`. Keep the exported names.
- Run `npx vitest run lld/problems/11-atm` until it's green.
- Don't open `reference.ts` until your tests pass, or until you've spent 90 minutes.

## Step 5: extensions interviewers ask after you finish

1. **Greedy can fail.** With notes 500, 200, 100 and no 100s left, 600 fails greedily (500 + ?), but 3 × 200 works. Fix with a small search or DP over note counts. Mention it even if you don't code it.
2. **The bank call times out after the debit.** Did the money move? Send an idempotency key with each debit and a reversal with the same key. This is how card networks handle it.
3. **Daily withdrawal limit.** Add a `WithdrawalPolicy` (strategy) per account or card type, each with its own daily limit. The ATM asks the policy before it plans notes.
4. **Two users, one account, two ATMs.** The bank must make `debit` atomic (a row lock or `UPDATE … SET balance = balance - x WHERE balance >= x`).
5. **Session timeout.** Add a clock. If no input for 30 seconds, eject (or retain) the card.
6. **Cash deposits.** The machine counts notes and adds them to the dispenser. Now the chain needs `add(notes)` too.

## Self-check before you call it done

- [ ] The account is never debited when the ATM can't pay.
- [ ] No `if (state === …)` chains inside `ATM`. Each state class owns its rules.
- [ ] PIN attempts live in the bank, not in the ATM.
- [ ] The note-picking logic doesn't hard-code 2000/500/100. A new note needs no code change.
- [ ] Errors are thrown with clear messages, not printed.

## Concepts used

- [State pattern](../../4-behavioral/L22-state/README.md) · [Chain of Responsibility](../../4-behavioral/L25-chain-of-responsibility/README.md) · [Repository and DI](../../5-machine-coding/L31-repository-and-di/README.md)
- Related problem: [Vending Machine](../06-vending-machine) (the same State pattern, smaller)
- HLD link: [Idempotency and delivery semantics](../../../hld/4-async/H22-delivery-semantics/README.md) · [Payments domain](../../../hld/6-building-blocks/H38-payments-domain/README.md)
- Visuals: [State machine](../../4-behavioral/L22-state/visual.html) · [Decorator and Chain of Responsibility](../../3-structural/L14-decorator/visual.html)
