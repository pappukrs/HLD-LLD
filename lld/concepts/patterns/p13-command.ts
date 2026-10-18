// P13 · Command (and Memento)
// Run: npx tsx lld/concepts/patterns/p13-command.ts

// ---------- receiver ----------
class TextDocument {
  private text = '';
  insertAt(pos: number, s: string): void {
    this.text = this.text.slice(0, pos) + s + this.text.slice(pos);
  }
  deleteRange(pos: number, len: number): string {
    const removed = this.text.slice(pos, pos + len);
    this.text = this.text.slice(0, pos) + this.text.slice(pos + len);
    return removed;
  }
  toString(): string { return JSON.stringify(this.text); }
}

// ---------- commands ----------
interface Command {
  readonly label: string;
  execute(): void;
  undo(): void;
}

class InsertText implements Command {
  constructor(private readonly doc: TextDocument, private readonly pos: number, private readonly text: string) {}
  get label() { return `insert(${this.pos}, "${this.text}")`; }
  execute() { this.doc.insertAt(this.pos, this.text); }
  undo() { this.doc.deleteRange(this.pos, this.text.length); }
}

class DeleteText implements Command {
  private removed = '';
  constructor(private readonly doc: TextDocument, private readonly pos: number, private readonly len: number) {}
  get label() { return `delete(${this.pos}, ${this.len})`; }
  execute() { this.removed = this.doc.deleteRange(this.pos, this.len); }
  undo() { this.doc.insertAt(this.pos, this.removed); }
}

class History {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];
  run(c: Command) { c.execute(); this.undoStack.push(c); this.redoStack = []; }
  undo(): string {
    const c = this.undoStack.pop();
    if (!c) return 'nothing to undo';
    c.undo();
    this.redoStack.push(c);
    return `undo ${c.label}`;
  }
  redo(): string {
    const c = this.redoStack.pop();
    if (!c) return 'nothing to redo';
    c.execute();
    this.undoStack.push(c);
    return `redo ${c.label}`;
  }
}

// ---------- memento: KV store with nested transactions ----------
interface KvMemento { readonly snapshot: ReadonlyMap<string, string> }

class KvStore {
  private data = new Map<string, string>();
  set(k: string, v: string) { this.data.set(k, v); }
  get(k: string) { return this.data.get(k); }
  save(): KvMemento { return Object.freeze({ snapshot: new Map(this.data) }); }
  restore(m: KvMemento) { this.data = new Map(m.snapshot); }
  dump() { return Object.fromEntries(this.data); }
}

class TransactionManager {
  private stack: KvMemento[] = []; // the caretaker never reads inside a memento
  constructor(private readonly store: KvStore) {}
  begin() { this.stack.push(this.store.save()); }
  rollback() {
    const m = this.stack.pop();
    if (!m) throw new Error('NO TRANSACTION');
    this.store.restore(m);
  }
  commit() {
    if (!this.stack.pop()) throw new Error('NO TRANSACTION');
  }
}

function main() {
  console.log('--- before: direct calls, no way back ---');
  const raw = new TextDocument();
  raw.insertAt(0, 'Pay Rs 500');
  raw.deleteRange(4, 6);
  console.log(`  text: ${raw}  (what was deleted? nobody knows)`);

  console.log('\n--- after: commands with undo/redo ---');
  const doc = new TextDocument();
  const h = new History();
  h.run(new InsertText(doc, 0, 'Pay Rs 500'));
  h.run(new DeleteText(doc, 4, 6));
  h.run(new InsertText(doc, 4, 'later'));
  console.log(`  text: ${doc}`);
  console.log(`  ${h.undo()} -> ${doc}`);
  console.log(`  ${h.undo()} -> ${doc}`);
  console.log(`  ${h.redo()} -> ${doc}`);
  h.run(new InsertText(doc, 0, '[!] '));
  console.log(`  new command clears redo: ${h.redo()} -> ${doc}`);

  console.log('\n--- memento: BEGIN / ROLLBACK / COMMIT ---');
  const kv = new KvStore();
  const tx = new TransactionManager(kv);
  kv.set('balance:u1', '1000');
  tx.begin();
  kv.set('balance:u1', '700');
  tx.begin();
  kv.set('balance:u1', '0');
  console.log('  inner tx:', kv.dump());
  tx.rollback();
  console.log('  after inner ROLLBACK:', kv.dump());
  tx.commit();
  console.log('  after outer COMMIT:', kv.dump());
  try {
    tx.rollback();
  } catch (e) {
    console.log(`  expected error: ${(e as Error).message}`);
  }
}

main();

export {};
