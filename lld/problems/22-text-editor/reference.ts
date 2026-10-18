// 22 · Text Editor: reference solution.
// Read this only after your own attempt passes (or after 90 minutes).

/** What a command is allowed to touch. The editor owns the only instance. */
export interface Doc {
  readonly text: string;
  cursor: number;
  insert(at: number, s: string): void;
  /** Removes `length` chars from `at` and returns them. */
  remove(at: number, length: number): string;
}

export interface EditCommand {
  execute(doc: Doc): void;
  undo(doc: Doc): void;
}

export interface EditorConfig {
  initialText?: string;
  historyLimit?: number;
}

/** Memento. Opaque to callers: only the editor reads it. */
export class EditorSnapshot {
  readonly #text: string;
  readonly #cursor: number;

  constructor(text: string, cursor: number) {
    this.#text = text;
    this.#cursor = cursor;
  }

  static read(s: EditorSnapshot): { text: string; cursor: number } {
    return { text: s.#text, cursor: s.#cursor };
  }
}

class TextBuffer implements Doc {
  private _cursor: number;

  constructor(private _text: string) {
    this._cursor = _text.length;
  }

  get text(): string {
    return this._text;
  }

  get cursor(): number {
    return this._cursor;
  }

  set cursor(pos: number) {
    this._cursor = Math.max(0, Math.min(pos, this._text.length));
  }

  insert(at: number, s: string): void {
    this._text = this._text.slice(0, at) + s + this._text.slice(at);
  }

  remove(at: number, length: number): string {
    const removed = this._text.slice(at, at + length);
    this._text = this._text.slice(0, at) + this._text.slice(at + length);
    return removed;
  }
}

// Each command stores its position when it is created, not when it runs.
// So redo works the same even if the user moved the cursor after undo.
class InsertCommand implements EditCommand {
  constructor(private readonly at: number, private readonly s: string) {}

  execute(doc: Doc): void {
    doc.insert(this.at, this.s);
    doc.cursor = this.at + this.s.length;
  }

  undo(doc: Doc): void {
    doc.remove(this.at, this.s.length);
    doc.cursor = this.at;
  }
}

class DeleteCommand implements EditCommand {
  private removed = '';

  constructor(
    private readonly at: number,
    private readonly length: number,
    private readonly cursorBefore: number,
  ) {}

  execute(doc: Doc): void {
    this.removed = doc.remove(this.at, this.length);
    doc.cursor = this.at;
  }

  undo(doc: Doc): void {
    doc.insert(this.at, this.removed);
    doc.cursor = this.cursorBefore;
  }
}

class RestoreCommand implements EditCommand {
  private before: EditorSnapshot | null = null;

  constructor(private readonly target: EditorSnapshot) {}

  execute(doc: Doc): void {
    this.before = new EditorSnapshot(doc.text, doc.cursor);
    replaceAll(doc, this.target);
  }

  undo(doc: Doc): void {
    replaceAll(doc, this.before!);
  }
}

function replaceAll(doc: Doc, snap: EditorSnapshot): void {
  const { text, cursor } = EditorSnapshot.read(snap);
  doc.remove(0, doc.text.length);
  doc.insert(0, text);
  doc.cursor = cursor;
}

export class TextEditor {
  private readonly doc: TextBuffer;
  private readonly undoStack: EditCommand[] = [];
  private redoStack: EditCommand[] = [];
  private readonly historyLimit: number;

  constructor(config: EditorConfig = {}) {
    this.doc = new TextBuffer(config.initialText ?? '');
    this.historyLimit = config.historyLimit ?? Infinity;
  }

  get text(): string {
    return this.doc.text;
  }

  get cursor(): number {
    return this.doc.cursor;
  }

  /** Cursor moves are not edits: they are not undoable. Out-of-range positions are clamped. */
  moveTo(pos: number): void {
    this.doc.cursor = pos;
  }

  moveLeft(n = 1): void {
    this.doc.cursor = this.doc.cursor - n;
  }

  moveRight(n = 1): void {
    this.doc.cursor = this.doc.cursor + n;
  }

  type(s: string): void {
    if (s.length > 0) this.execute(new InsertCommand(this.doc.cursor, s));
  }

  /** Deletes up to n chars before the cursor. Returns what was deleted. */
  backspace(n = 1): string {
    const len = Math.min(n, this.doc.cursor);
    return this.runDelete(this.doc.cursor - len, len);
  }

  /** Deletes up to n chars after the cursor. Returns what was deleted. */
  deleteForward(n = 1): string {
    const len = Math.min(n, this.doc.text.length - this.doc.cursor);
    return this.runDelete(this.doc.cursor, len);
  }

  execute(command: EditCommand): void {
    command.execute(this.doc);
    this.undoStack.push(command);
    if (this.undoStack.length > this.historyLimit) this.undoStack.shift();
    this.redoStack = []; // a new edit makes the old "future" invalid
  }

  undo(): boolean {
    const cmd = this.undoStack.pop();
    if (!cmd) return false;
    cmd.undo(this.doc);
    this.redoStack.push(cmd);
    return true;
  }

  redo(): boolean {
    const cmd = this.redoStack.pop();
    if (!cmd) return false;
    cmd.execute(this.doc);
    this.undoStack.push(cmd);
    return true;
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  save(): EditorSnapshot {
    return new EditorSnapshot(this.doc.text, this.doc.cursor);
  }

  /** Restoring is an edit too, so the user can undo it. */
  restore(snapshot: EditorSnapshot): void {
    this.execute(new RestoreCommand(snapshot));
  }

  private runDelete(from: number, length: number): string {
    if (length <= 0) return ''; // nothing to delete: do not add an empty step to history
    const removed = this.doc.text.slice(from, from + length);
    this.execute(new DeleteCommand(from, length, this.doc.cursor));
    return removed;
  }
}
