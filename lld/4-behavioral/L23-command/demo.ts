// L23 · Command: undo/redo in a text editor, a macro command, and commands as queued jobs.
// Run: npx tsx lld/4-behavioral/L23-command/demo.ts

export {}; // module scope: keeps these names out of the global (DOM) namespace

// ---- Receiver: the object that does the real work ----
class Doc {
  text = '';
  insert(pos: number, s: string) { this.text = this.text.slice(0, pos) + s + this.text.slice(pos); }
  remove(pos: number, len: number): string {
    const removed = this.text.slice(pos, pos + len);
    this.text = this.text.slice(0, pos) + this.text.slice(pos + len);
    return removed;
  }
}

// ---- Command interface ----
interface Command {
  readonly label: string;
  execute(): void;
  undo(): void;
}

class InsertText implements Command {
  constructor(private doc: Doc, private pos: number, private text: string) {}
  get label() { return `Insert(${this.pos}, "${this.text}")`; }
  execute() { this.doc.insert(this.pos, this.text); }
  undo() { this.doc.remove(this.pos, this.text.length); }
}

class DeleteText implements Command {
  private removed = ''; // saved on execute: the only copy of the deleted text
  constructor(private doc: Doc, private pos: number, private len: number) {}
  get label() { return `Delete(${this.pos}, ${this.len}) saved="${this.removed}"`; }
  execute() { this.removed = this.doc.remove(this.pos, this.len); }
  undo() { this.doc.insert(this.pos, this.removed); }
}

// A macro is a Composite of commands: undo runs in reverse order.
class MacroCommand implements Command {
  constructor(readonly label: string, private steps: Command[]) {}
  execute() { for (const c of this.steps) c.execute(); }
  undo() { for (const c of [...this.steps].reverse()) c.undo(); }
}

// ---- Invoker: knows nothing about text, only about commands ----
class History {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];
  constructor(private limit = 100) {}
  run(c: Command) {
    c.execute();
    this.undoStack.push(c);
    if (this.undoStack.length > this.limit) this.undoStack.shift(); // cap memory
    this.redoStack = []; // a new edit kills the old future
  }
  undo() { const c = this.undoStack.pop(); if (c) { c.undo(); this.redoStack.push(c); } return c; }
  redo() { const c = this.redoStack.pop(); if (c) { c.execute(); this.undoStack.push(c); } return c; }
  sizes() { return `undo=${this.undoStack.length} redo=${this.redoStack.length}`; }
}

// ---- Commands as data: a serializable job (BullMQ style) ----
type Job =
  | { name: 'sendReceipt'; data: { paymentId: string; email: string } }
  | { name: 'refund'; data: { paymentId: string; amountPaise: number } };

const handlers: { [K in Job['name']]: (d: Extract<Job, { name: K }>['data']) => string } = {
  sendReceipt: (d) => `emailed receipt for ${d.paymentId} to ${d.email}`,
  refund: (d) => `refunded ₹${d.amountPaise / 100} on ${d.paymentId}`,
};

function runJob(job: Job): string {
  // The switch on name narrows the data type; each handler stays small.
  switch (job.name) {
    case 'sendReceipt': return handlers.sendReceipt(job.data);
    case 'refund': return handlers.refund(job.data);
  }
}

function main() {
  const doc = new Doc();
  const h = new History();
  const show = (what: string) => console.log(`  ${what.padEnd(44)} doc="${doc.text}"  ${h.sizes()}`);

  console.log('== 1. Every edit is a command on the undo stack ==');
  h.run(new InsertText(doc, 0, 'Hello')); show('run Insert(0, "Hello")');
  h.run(new InsertText(doc, 5, ' world')); show('run Insert(5, " world")');
  const del = new DeleteText(doc, 5, 6);
  h.run(del); show(`run ${del.label}`);

  console.log('\n== 2. Undo pops and reverses; redo replays the same object ==');
  show(`undo ${h.undo()?.label}`);
  show(`undo ${h.undo()?.label}`);
  show(`redo ${h.redo()?.label}`);

  console.log('\n== 3. A new edit clears the redo stack ==');
  h.undo(); show('undo again (redo now has 2)');
  h.run(new InsertText(doc, 5, '!')); show('run Insert(5, "!")  → redo cleared');
  console.log('  redo() now:', h.redo() ?? 'nothing to redo');

  console.log('\n== 4. Macro command: one undo step for many edits ==');
  const macro = new MacroCommand('Sign off', [
    new InsertText(doc, doc.text.length, ' Thanks,'),
    new InsertText(doc, doc.text.length + ' Thanks,'.length, ' Pappu'),
  ]);
  h.run(macro); show(`run Macro "${macro.label}"`);
  h.undo(); show('undo (both inserts reversed)');

  console.log('\n== 5. Commands as data: queued, logged, run later by a worker ==');
  const queue: Job[] = [
    { name: 'sendReceipt', data: { paymentId: 'pay_42', email: 'a@b.in' } },
    { name: 'refund', data: { paymentId: 'pay_41', amountPaise: 49_900 } },
  ];
  console.log('  queued as JSON:', JSON.stringify(queue[1]));
  for (const job of queue) console.log('  worker:', runJob(JSON.parse(JSON.stringify(job)) as Job));
}

main();
