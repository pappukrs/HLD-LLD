// L24 · Memento: editor undo/redo with opaque snapshots, then KV store nested transactions.
// Run: npx tsx lld/4-behavioral/L24-memento/demo.ts

// ---------- 1. Editor (originator) + EditorMemento (opaque) ----------
interface EditorState { text: string; cursor: number }

class EditorMemento {
  #state: Readonly<EditorState>;
  readonly at: number;
  constructor(state: EditorState, readonly label: string, at: number) {
    this.#state = Object.freeze({ ...state });
    this.at = at;
  }
  static read(m: EditorMemento): Readonly<EditorState> { return m.#state; } // used only by Editor
}

class Editor {
  private text = '';
  private cursor = 0;
  private clock = 0;
  type(s: string): void {
    this.text = this.text.slice(0, this.cursor) + s + this.text.slice(this.cursor);
    this.cursor += s.length;
  }
  backspace(n: number): void {
    const from = Math.max(0, this.cursor - n);
    this.text = this.text.slice(0, from) + this.text.slice(this.cursor);
    this.cursor = from;
  }
  save(label: string = this.text || '(empty)'): EditorMemento { return new EditorMemento({ text: this.text, cursor: this.cursor }, label, ++this.clock); }
  restore(m: EditorMemento): void { const s = EditorMemento.read(m); this.text = s.text; this.cursor = s.cursor; }
  show(): string { return JSON.stringify(this.text.slice(0, this.cursor) + '|' + this.text.slice(this.cursor)); }
}

// ---------- 2. History (caretaker): stores tokens, never reads them ----------
class History {
  private undoStack: EditorMemento[] = [];
  private redoStack: EditorMemento[] = [];
  constructor(private editor: Editor, private limit = 3) {}
  checkpoint(label: string): void {
    this.undoStack.push(this.editor.save(label));
    if (this.undoStack.length > this.limit) {
      const dropped = this.undoStack.shift()!;
      console.log(`   (limit ${this.limit}: dropped oldest checkpoint "${dropped.label}")`);
    }
    this.redoStack = []; // a new change makes the old future invalid
  }
  undo(): boolean {
    const m = this.undoStack.pop();
    if (!m) return false;
    this.redoStack.push(this.editor.save());
    this.editor.restore(m);
    return true;
  }
  redo(): boolean {
    const m = this.redoStack.pop();
    if (!m) return false;
    this.undoStack.push(this.editor.save());
    this.editor.restore(m);
    return true;
  }
  sizes(): string { return `undo=${this.undoStack.length} redo=${this.redoStack.length} [${this.undoStack.map((m) => m.label).join(', ')}]`; }
}

// ---------- 3. KV store with nested transactions (partial memento: old values only) ----------
type Layer = Map<string, string | undefined>; // key -> value before this transaction touched it

class KvStore {
  private data = new Map<string, string>();
  private layers: Layer[] = [];
  set(k: string, v: string): void {
    const top = this.layers[this.layers.length - 1];
    if (top && !top.has(k)) top.set(k, this.data.get(k)); // remember the old value once per layer
    this.data.set(k, v);
  }
  get(k: string): string { return this.data.get(k) ?? '(nil)'; }
  begin(): void { this.layers.push(new Map()); }
  rollback(): void {
    const top = this.layers.pop();
    if (!top) throw new Error('no transaction');
    for (const [k, old] of top) old === undefined ? this.data.delete(k) : this.data.set(k, old);
  }
  commit(): void {
    const top = this.layers.pop();
    if (!top) throw new Error('no transaction');
    const below = this.layers[this.layers.length - 1];
    if (below) for (const [k, old] of top) if (!below.has(k)) below.set(k, old); // merge into parent
  }
  depth(): number { return this.layers.length; }
}

function main(): void {
  console.log('=== 1. Editor undo / redo with mementos ===');
  const ed = new Editor();
  const h = new History(ed, 3);
  const step = (what: string) => console.log(`${what.padEnd(26)} -> ${ed.show().padEnd(18)} ${h.sizes()}`);

  h.checkpoint('empty'); ed.type('Pay'); step('type "Pay"');
  h.checkpoint('Pay'); ed.type(' 500'); step('type " 500"');
  h.checkpoint('Pay 500'); ed.backspace(3); ed.type('5000'); step('fix amount to 5000');
  h.undo(); step('undo');
  h.undo(); step('undo');
  h.redo(); step('redo');
  h.checkpoint('Pay 500'); ed.type(' INR'); step('type " INR" (clears redo)');
  console.log('redo now possible?', h.redo());
  h.checkpoint('Pay 500 INR'); ed.type('.'); step('type "." (cap = 3)');

  console.log('\n=== 2. The caretaker cannot read the snapshot ===');
  const m = ed.save('peek');
  console.log('Object.keys(memento) =', Object.keys(m), '-> only metadata is visible; state is #private');
  console.log('frozen state?', Object.isFrozen(EditorMemento.read(m)));

  console.log('\n=== 3. KV store: BEGIN / ROLLBACK / COMMIT ===');
  const kv = new KvStore();
  const run = (cmd: string, f: () => void) => { f(); console.log(`${cmd.padEnd(16)} balance=${kv.get('balance').padEnd(6)} limit=${kv.get('limit').padEnd(6)} depth=${kv.depth()}`); };
  run('SET balance 100', () => kv.set('balance', '100'));
  run('BEGIN', () => kv.begin());
  run('SET balance 80', () => kv.set('balance', '80'));
  run('BEGIN', () => kv.begin());
  run('SET balance 0', () => kv.set('balance', '0'));
  run('SET limit 50', () => kv.set('limit', '50'));
  run('ROLLBACK', () => kv.rollback());
  run('COMMIT', () => kv.commit());
  console.log('\nInner ROLLBACK restored only the 2 keys it touched; it never copied the whole map.');
}

main();

export {}; // make this file a module so its names stay local
