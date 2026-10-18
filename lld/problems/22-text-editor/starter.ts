// 22 · Text Editor: your implementation goes here.
// Keep the exported names and signatures; the tests import them.
// Run: npx vitest run lld/problems/22-text-editor

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

export class TextEditor {
  constructor(config: EditorConfig = {}) {
    // TODO: the document (text + cursor at the end), undo and redo stacks, history limit
  }

  get text(): string {
    throw new Error('TODO');
  }

  get cursor(): number {
    throw new Error('TODO');
  }

  /** Cursor moves are not edits: they are not undoable. Out-of-range positions are clamped. */
  moveTo(pos: number): void {
    throw new Error('TODO');
  }

  moveLeft(n = 1): void {
    throw new Error('TODO');
  }

  moveRight(n = 1): void {
    throw new Error('TODO');
  }

  /** Inserts at the cursor; the cursor ends after the inserted text. */
  type(s: string): void {
    throw new Error('TODO');
  }

  /** Deletes up to n chars before the cursor. Returns what was deleted. */
  backspace(n = 1): string {
    throw new Error('TODO');
  }

  /** Deletes up to n chars after the cursor. Returns what was deleted. */
  deleteForward(n = 1): string {
    throw new Error('TODO');
  }

  /** Runs any command and records it for undo. A new edit clears redo. */
  execute(command: EditCommand): void {
    throw new Error('TODO');
  }

  undo(): boolean {
    throw new Error('TODO');
  }

  redo(): boolean {
    throw new Error('TODO');
  }

  canUndo(): boolean {
    throw new Error('TODO');
  }

  canRedo(): boolean {
    throw new Error('TODO');
  }

  save(): EditorSnapshot {
    throw new Error('TODO');
  }

  /** Restoring is an edit too, so the user can undo it. */
  restore(snapshot: EditorSnapshot): void {
    throw new Error('TODO');
  }
}
