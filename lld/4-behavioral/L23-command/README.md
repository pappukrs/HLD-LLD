# L23 · Command (undo and redo)

> **Time:** ~35 min · **Visual:** [visual.html](visual.html) · **Code:** [demo.ts](demo.ts) (`npx tsx lld/4-behavioral/L23-command/demo.ts`)
> **Builds on:** [L01 Classes and interfaces](../../1-foundations/L01-classes-and-interfaces/README.md) · [L17 Composite](../../3-structural/L17-composite/README.md) (macro commands) · **Used in:** [22 Text Editor](../../problems/22-text-editor/README.md), [14 KV Store](../../problems/14-kv-store/README.md) (transactions), [16 Task Scheduler](../../problems/16-task-scheduler/README.md) (jobs as objects), [19 Payment Wallet](../../problems/19-payment-wallet/README.md) (ledger operations), HLD [24 Job Scheduler](../../../hld/case-studies/24-job-scheduler/README.md)

## The idea in one line

Turn a request into an object with `execute()` (and often `undo()`), so you can store it, queue it, log it, retry it or reverse it.

## Why it matters (the problem it solves)

A direct method call happens and is forgotten. Nothing remembers it, so nothing can reverse it or replay it.

```ts
// Before: actions are plain calls
editor.insert(5, 'hello');
editor.delete(0, 3);
// Undo now needs to know: what was the last action, with what arguments,
// and what text did delete remove? You end up with this:
undo() {
  const last = this.log.pop();
  switch (last.type) {
    case 'insert': this.text = /* remove last.text at last.pos */; break;
    case 'delete': /* the deleted text is gone. Bug. */ break;
    // every new action = a new case here, in a class that should not know about it
  }
}
```

Command fixes this: each action is an object that carries its arguments **and** what it needs to reverse itself. The editor only keeps a stack of them.

## How it works

### The four roles

| Role | Job | Editor example | Job-queue example |
|---|---|---|---|
| **Command** | Interface: `execute()`, `undo()` | `Command` | `{ name, data }` |
| **Concrete command** | Holds receiver + arguments + undo data | `InsertText`, `DeleteText` | `sendReceipt`, `refund` |
| **Receiver** | Does the real work | `Doc` | email service, payment provider |
| **Invoker** | Runs commands, keeps history. Knows nothing about text | `History` | queue worker |

The client (UI, controller) creates the command and hands it to the invoker.

### Class diagram

```
 ┌────────────────────┐   runs, stores   ┌──────────────────────────┐
 │ History (invoker)  │◇────────────────▶│ «interface» Command       │
 │ - undoStack[]      │                  │ + execute(): void         │
 │ - redoStack[]      │                  │ + undo(): void            │
 │ + run(c) undo()    │                  └────────────▲─────────────┘
 │   redo()           │                     implements│
 └────────────────────┘          ┌──────────────┬─────┴────────┬────────────────┐
                            InsertText       DeleteText     MacroCommand
                            pos, text        pos, len,      steps: Command[]
                                             removed        (Composite)
                                 │               │
                                 └──── uses ─────┴────▶ Doc (receiver)
                                                        insert(), remove()
```

### Undo and redo: the two-stack algorithm

```
run(c):   c.execute()   undo.push(c)   redo = []     ← a new edit kills the old future
undo():   c = undo.pop()   c.undo()      redo.push(c)
redo():   c = redo.pop()   c.execute()   undo.push(c)
```

Trace (the visual animates this):

| Action | Doc | undo stack (top last) | redo stack |
|---|---|---|---|
| run Insert(0,"Hello") | `Hello` | Ins | |
| run Insert(5," world") | `Hello world` | Ins, Ins | |
| run Delete(5,6) saves " world" | `Hello` | Ins, Ins, Del | |
| undo | `Hello world` | Ins, Ins | Del |
| undo | `Hello` | Ins | Del, Ins |
| redo | `Hello world` | Ins, Ins | Del |
| run Insert(11,"!") | `Hello world!` | Ins, Ins, Ins | *(cleared)* |

**Why clear redo?** The redo commands store positions for a document that no longer exists. Replaying `Delete(5,6)` after a new edit would delete the wrong text.

### Where the undo data comes from

- `InsertText` can undo with only its arguments: remove `text.length` chars at `pos`.
- `DeleteText` must **save the removed text during `execute()`**. After the delete, the command holds the only copy.
- If computing the reverse is hard (a big refactor, an image filter), save a snapshot instead. That is [L24 Memento](../L24-memento/README.md).

### Beyond undo: commands as data

The same idea, serialized, powers most backend systems:

| Use | What the "command" is |
|---|---|
| Job queues (BullMQ, RabbitMQ) | `{ name: 'sendReceipt', data: {...} }`, run later by a worker, retried on failure |
| Redis `MULTI` / `EXEC` | Commands queued, then run together; `DISCARD` drops them |
| DB migrations | `up()` = execute, `down()` = undo |
| CQRS (`@nestjs/cqrs`) | `new CreateOrderCommand(...)` sent through a bus to one handler |
| Payments / ledgers | `Transfer { from, to, amount, idempotencyKey }`. Reverse with a new compensating command, never by deleting history |

### How to spot it in a problem statement

- "Support **undo / redo**", "history", "replay", "macro".
- "Operations should be **queued**, scheduled, retried, or run by a worker".
- "Keep an **audit log** of every operation".
- "Transactions with **rollback**" (KV store `BEGIN / ROLLBACK / COMMIT`).
- Remote controls, smart-home buttons: a button holds a command and does not know what it controls.

## In TypeScript

```ts
interface Command { execute(): void; undo(): void; }

class DeleteText implements Command {
  private removed = '';                         // filled during execute
  constructor(private doc: Doc, private pos: number, private len: number) {}
  execute() { this.removed = this.doc.remove(this.pos, this.len); }
  undo() { this.doc.insert(this.pos, this.removed); }
}

class MacroCommand implements Command {          // Composite of commands
  constructor(private steps: Command[]) {}
  execute() { for (const c of this.steps) c.execute(); }
  undo() { for (const c of [...this.steps].reverse()) c.undo(); }   // reverse order
}

class History {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];
  run(c: Command) { c.execute(); this.undoStack.push(c); this.redoStack = []; }
  undo() { const c = this.undoStack.pop(); if (c) { c.undo(); this.redoStack.push(c); } }
  redo() { const c = this.redoStack.pop(); if (c) { c.execute(); this.undoStack.push(c); } }
}
```

Commands as typed data (a discriminated union), so a queue can store them as JSON:

```ts
type Job =
  | { name: 'sendReceipt'; data: { paymentId: string; email: string } }
  | { name: 'refund'; data: { paymentId: string; amountPaise: number } };
```

`demo.ts` runs the editor trace above, a macro undo, and a tiny job queue.

## Trade-offs / when NOT to use it

| | Command (store the change) | Memento (store a snapshot) |
|---|---|---|
| Saved per step | The operation + data to reverse it | Whole state before the change |
| Memory | Small | Large for big state |
| Undo logic | You write `undo()` per command (can be buggy) | Free: restore the snapshot |
| Good for | Editors, drawing tools, KV transactions | Forms, small game state, config |

- No undo, no queue, no log: a direct method call is clearer. Do not wrap every getter in a command.
- Many tiny command classes can feel heavy. In TS, a command can be a pair of closures `{ execute: () => ..., undo: () => ... }` when there is no extra state to name.
- Unbounded history leaks memory. Cap it (for example 100 steps) and merge fast typing into one command.

## Common mistakes

- **Not clearing the redo stack** after a new command.
- **`DeleteText` without saving the removed text.** Undo cannot work.
- **Macro undo in the same order as execute.** It must be reversed.
- **Putting the logic in the invoker.** `History` must not know what an insert is; the command does the work through the receiver.
- **Undo that is not an exact inverse.** Test it: `execute(); undo();` must leave the state unchanged. Write that as a property test.
- **Undoing a payment by deleting the row.** Money is reversed with a new compensating command (a refund entry), so the ledger stays append-only.

## Say this in the interview

> "Each edit is a command object with execute and undo. The command stores what it needs to reverse itself, for example delete keeps the removed text. The history keeps two stacks: run pushes on the undo stack and clears redo, undo moves the top command to the redo stack, and redo moves it back. The history never knows what an edit does, so a new edit type is one new class."

> "The same pattern shows up in the backend as jobs: a job is a serialized command, name plus data, that a worker runs later with retries. For money, I never undo by deleting. I issue a compensating command, like a refund, so the ledger stays append-only."

## Your experience hook

- Payment orchestration: retries and refunds were commands with an idempotency key. A retried command with the same key returned the stored result instead of charging twice.
- Async work over RabbitMQ (receipts, notifications, IoT device commands for 10k+ devices) is the Command pattern as data: a message with a type and payload, executed by a consumer, retried on failure.

## Self-test

<details><summary>1. Type "abc" (one command), delete "c", undo, undo. What is the text?</summary>

"abc" after the first undo, "" after the second.
</details>

<details><summary>2. Why must DeleteText save the removed text?</summary>

After the delete, the text is gone from the document. Undo must put it back, so the command keeps the only copy.
</details>

<details><summary>3. Why does a new command clear the redo stack?</summary>

Redo commands were built against the old document. Positions no longer match, so replaying them would corrupt the text.
</details>

<details><summary>4. How do you stop every keystroke from being its own undo step?</summary>

Merge: if the new insert continues the last one (next position, within about a second), extend the last command instead of pushing a new one.
</details>

<details><summary>5. Command undo vs memento for a 1 MB document: which uses less memory?</summary>

Command: each step stores only the change. A memento would store about 1 MB per step.
</details>

<details><summary>6. How do nested transactions in a KV store use this idea?</summary>

`BEGIN` pushes a layer. Each write records the old value of the key in the top layer (first time only). `ROLLBACK` pops the layer and restores old values. `COMMIT` pops it and merges its records into the layer below.
</details>

<details><summary>7. How is a BullMQ job related to Command?</summary>

It is a serialized command: a name and data, stored in Redis, executed later by a worker, with retries and backoff. The producer does not know who runs it.
</details>

## Go deeper

- Build it: [22 Text Editor](../../problems/22-text-editor/README.md), then [14 KV Store](../../problems/14-kv-store/README.md) (transactions)
- Next: [L24 Memento](../L24-memento/README.md) (undo by snapshot)
- Related: [L17 Composite](../../3-structural/L17-composite/README.md) (macro commands), [L22 State](../L22-state/README.md)
- HLD: [24 Job Scheduler](../../../hld/case-studies/24-job-scheduler/README.md) (commands as queued jobs)
- Archive: [LLD-guide.md](../../../archive/notes/LLD-guide.md) (PART 3, "Command Pattern")
