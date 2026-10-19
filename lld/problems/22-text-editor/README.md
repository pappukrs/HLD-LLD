# 22 · Text Editor (undo/redo)

> Asked at: Atlassian, Microsoft, Adobe, Google, Zoho.
> Time box: **60 min** (10 min design, 40 min code, 10 min tests and extensions)
> Patterns you should reach for: **Command** (each edit knows how to undo itself), **Memento** (save and restore a snapshot)

## Problem statement (as the interviewer says it)

"Build the core of a text editor. The user types, moves the cursor, and deletes.
Support undo and redo. Also let the user save a version and go back to it later."

## Step 1: clarify (ask these out loud)

Ask these before writing any code. The assumed answers below are what the tests expect.

| Question | Assumed answer |
|---|---|
| One line or many? | One string. Newlines are normal characters |
| Where does typing go? | At the cursor. The cursor ends after the inserted text |
| Where is the cursor at start? | At the end of the initial text |
| Cursor out of range? | Clamp to `[0, text.length]`. No error |
| Delete kinds? | `backspace(n)` deletes before the cursor, `deleteForward(n)` after it. Both stop at the edges and return what they removed |
| Is a cursor move undoable? | No. Only edits are. Undo puts the cursor back to where that edit happened |
| Empty edits (backspace at 0, `type('')`)? | Not added to history |
| A new edit after undo? | Clears the redo stack |
| Undo / redo with nothing to do? | Return `false`. No error |
| History size? | Unlimited by default. `historyLimit` drops the oldest steps |
| Snapshots? | `save()` returns an opaque snapshot. `restore(snap)` is an edit, so you can undo it |
| Selection, copy/paste, multi-cursor, collaboration? | Out of scope. Mention them as extensions |

## Step 2: public API (what the tests call)

```ts
const ed = new TextEditor({ initialText: 'Helo', historyLimit: 100 });

ed.text;  ed.cursor;                      // getters
ed.moveTo(3); ed.moveLeft(1); ed.moveRight(2);
ed.type('l');
ed.backspace(2);                          // → removed text
ed.deleteForward(1);                      // → removed text
ed.undo(); ed.redo();                     // → boolean
ed.canUndo(); ed.canRedo();

const snap = ed.save();                   // → EditorSnapshot (Memento)
ed.restore(snap);                         // undoable

ed.execute(myCommand);                    // any EditCommand { execute(doc), undo(doc) }
```

`Doc` is what a command may touch: `text`, `cursor`, `insert(at, s)`, `remove(at, length)`. The rest is **your design**.

## Step 3: entities (try them yourself first)

<details>
<summary>Reveal a good entity list</summary>

- `TextEditor`: the invoker. Owns the document, `undoStack` and `redoStack`
- `TextBuffer` (implements `Doc`): the receiver. Text + cursor, with a clamping cursor setter
- `EditCommand` (interface): `execute(doc)` and `undo(doc)`
  - `InsertCommand(at, s)`: undo removes `s.length` chars at `at`
  - `DeleteCommand(at, length, cursorBefore)`: keeps the removed text, so undo can put it back
  - `RestoreCommand(snapshot)`: saves a "before" snapshot when it runs
- `EditorSnapshot`: the memento. Uses `#private` fields, so callers cannot read or change it
- Undo: pop from undo, call `undo`, push to redo. Redo: the opposite. Any new edit: push to undo, clear redo

Key detail: a command stores its position **when it is created**, not when it runs. If it reads `doc.cursor` inside `execute`, redo inserts in the wrong place after the user moves the cursor.

</details>

## Step 4: implement

- Write your code in `starter.ts`. Keep the exported names.
- Run `npx vitest run lld/problems/22-text-editor` until it's green.
- Don't open `reference.ts` until your tests pass, or until you've spent 60 minutes.

## Step 5: extensions interviewers ask after you finish

1. **Command vs Memento for undo.** Commands store a small diff per step (cheap memory). Snapshots store the whole text per step (simple, but costly for big files). Real editors use commands, plus snapshots for "versions".
2. **Group typing.** Typing "hello" one key at a time should undo in one step. Merge consecutive inserts at adjacent positions into one command, until a pause or a cursor move.
3. **Big documents.** `slice` + concat is O(n) per edit. Use a gap buffer, a rope or a piece table.
4. **Selection and replace.** A selection is `[anchor, head]`. Replace = delete + insert. Make it one composite command, so one undo reverts both.
5. **Collaborative editing.** Two users edit at once. You need operational transformation or CRDTs. See the HLD problem below.
6. **Persist history.** Save the command log, not snapshots. Replaying the log rebuilds the document (the same idea as event sourcing).

## Self-check before you call it done

- [ ] No `switch (lastAction.type)` inside `undo`. Each command undoes itself.
- [ ] A new edit clears redo. You have a test for it.
- [ ] Redo after a cursor move still edits the original place.
- [ ] Cursor moves never create history steps.
- [ ] The snapshot cannot be changed from outside.

## Concepts used

- [Command and Memento](../../4-behavioral/L23-command/README.md) · [Composite (for grouped commands)](../../3-structural/L17-composite/README.md) · [SOLID](../../1-foundations/L04-solid-srp-ocp/README.md)
- Related problem: [In-memory KV Store](../14-kv-store) (Command and Memento for transactions)
- Related HLD: [Collaborative Editor (Google Docs)](../../../hld/case-studies/25-collaborative-editor) · [Event-driven, CQRS, event sourcing](../../../hld/4-async/H24-event-driven-cqrs/README.md)
- Visual: [Command: undo and redo](../../4-behavioral/L23-command/visual.html)
