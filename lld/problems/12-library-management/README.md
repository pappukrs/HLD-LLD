# 12 · Library Management

> Asked at: Flipkart, Swiggy, Atlassian, Amazon, and many service-company and startup machine-coding rounds.
> Time box: **90 min** (15 min design, 60 min code, 15 min tests and extensions)
> Patterns you should reach for: **Repository** (storage behind one interface), **Observer** (hold-ready and fine events), **Strategy** (fine policy)

## Problem statement (as the interviewer says it)

"Design a library management system. The library has books, and each book can have many copies.
Members search the catalogue, borrow copies, and return them. Late returns are fined.
If all copies are out, a member can reserve the book and is told when a copy is ready."

## Step 1: clarify (ask these out loud)

Ask these before writing any code. The assumed answers below are what the tests expect.

| Question | Assumed answer |
|---|---|
| Book vs copy? | A book is an ISBN with title and author. A copy is one physical item with its own id (`<isbn>-<n>`). Adding an ISBN that exists adds copies |
| Search? | By title and/or author. Case-insensitive substring. All given fields must match. Sorted by title |
| Loan period? | 14 days (configurable) |
| Loan limit? | 3 active loans per member. One copy of the same ISBN at a time |
| Fine? | 10 per late day. Partial days round **up**. On time = 0 |
| Unpaid fines? | The member can't borrow until they pay. Paying more than owed throws |
| How do returns work? | By copy id (the barcode on the book) |
| Reservation rules? | Only when no copy is free. FIFO queue per ISBN. No duplicate reservations. Can't reserve a book you already hold |
| What happens on return if someone is waiting? | The copy goes on hold for the first member in the queue. Only that member can borrow it. A `HOLD_READY` event is sent |
| Hold expiry, renewals, librarians, payments? | Out of scope. Mention them as extensions |

## Step 2: public API (what the tests call)

```ts
const lib = new Library({ clock: () => now, loanDays: 14, maxLoans: 3, finePolicy: new PerDayFine(10) });

lib.addBook({ isbn: 'CC', title: 'Clean Code', author: 'Robert Martin' }, 2);   // 2 copies
lib.addMember('m1', 'Asha');
lib.search({ author: 'martin' });          // → BookView[] { isbn, title, author, totalCopies, availableCopies }

const loan = lib.checkout('m1', 'CC');     // → Loan { id, copyId, isbn, memberId, borrowedAt, dueAt }
lib.returnCopy(loan.copyId);               // → ReturnReceipt { loanId, lateDays, fine }
lib.reserve('m2', 'CC');                   // only when no copy is free
lib.loansOf('m1'); lib.finesOf('m1'); lib.payFine('m1', 30);

const off = lib.subscribe((event) => { /* HOLD_READY | FINE_CHARGED */ });
off();                                     // unsubscribe
```

`DAY_MS` is exported so tests can move the clock by whole days.

## Step 3: entities (try them yourself first)

<details>
<summary>Reveal a good entity list</summary>

- `Library`: the facade. Holds the business rules (limits, fines, holds) and talks only to repositories
- `Book`: isbn, title, author, list of copy ids, FIFO hold queue
- `Copy`: id, isbn, status. Status is a tagged union: `AVAILABLE` | `ON_LOAN { loanId }` | `ON_HOLD { memberId }`. The extra data lives inside the status, so an `ON_LOAN` copy without a loan id can't exist
- `Member`: id, name, fines, active loan ids
- `Loan`: an immutable record with `dueAt`
- `InMemoryRepository<T>`: `get`, `find`, `save`, `delete`, `all`. One generic class for books, copies, members and loans
- `FinePolicy` (interface) → `PerDayFine`. Later: capped fines, member-tier discounts
- Listeners (Observer): notified on `HOLD_READY` and `FINE_CHARGED`. A notification service subscribes; the library doesn't know about SMS or email

Relationships: Book ◆— Copy (composition). Member ⟶ Loan ⟵ Copy (association through the loan). Library ⟶ Repository, FinePolicy (dependency injection).

</details>

## Step 4: implement

- Write your code in `starter.ts`. Keep the exported names.
- Run `npx vitest run lld/problems/12-library-management` until it's green.
- Don't open `reference.ts` until your tests pass, or until you've spent 90 minutes.

## Step 5: extensions interviewers ask after you finish

1. **Hold expiry.** A held copy waits 3 days, then goes to the next member. Store `holdUntil` on the copy and check it with the clock (lazy expiry), or run a sweeper job.
2. **Renewals.** Allow one renewal if nobody has reserved the book. It is a new rule in `Library`, not a new class.
3. **Due-date reminders.** A scheduler emits `DUE_SOON` events one day before `dueAt`. The notification service is already an observer.
4. **Persistence.** Swap `InMemoryRepository` for a SQL one. Tables: `books`, `copies (status, loan_id, held_for)`, `members`, `loans`, `holds (isbn, member_id, created_at)`. Index `copies (isbn, status)` for "find a free copy".
5. **Two members borrow the last copy at the same time** on two servers. Use a conditional update: `UPDATE copies SET status = 'ON_LOAN' WHERE id = ? AND status = 'AVAILABLE'`, then check the affected row count.
6. **Different member types** (student, faculty) with different limits and loan periods: a `MembershipPolicy` strategy per member.

## Self-check before you call it done

- [ ] The clock is injected. No `Date.now()` inside the rules.
- [ ] A held copy is never given to a different member.
- [ ] Late days round up. A return exactly at `dueAt` has no fine.
- [ ] `Library` doesn't send notifications itself. It emits events.
- [ ] Storage is behind a repository. You could replace the Maps without touching the rules.

## Concepts used

- [Repository and DI](../../concepts/patterns/p18-repository-di.md) · [Observer](../../concepts/patterns/p11-observer.md) · [Strategy](../../concepts/patterns/p10-strategy.md) · [SOLID](../../concepts/02-solid.md)
- Visuals: [Observer and pub-sub](../../../visuals/v24-observer-pubsub.html) · [UML relationships](../../../visuals/v22-uml-relationships.html)
