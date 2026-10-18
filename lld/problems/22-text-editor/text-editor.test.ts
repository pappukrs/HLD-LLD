import * as starter from './starter';
import * as reference from './reference';
import type { Doc, EditCommand } from './reference';

// `npm test` checks your starter.ts; `npm run test:ref` checks the reference.
const { TextEditor } = (process.env.REF ? reference : starter) as typeof reference;

describe('22 · Text Editor', () => {
  describe('editing and cursor', () => {
    it('types at the cursor and moves the cursor after the text', () => {
      const ed = new TextEditor();
      ed.type('Hello');
      ed.type(' world');
      expect(ed.text).toBe('Hello world');
      expect(ed.cursor).toBe(11);
    });

    it('inserts in the middle and clamps cursor moves', () => {
      const ed = new TextEditor({ initialText: 'Helo' });
      expect(ed.cursor).toBe(4);
      ed.moveLeft(1);
      ed.type('l');
      expect(ed.text).toBe('Hello');
      expect(ed.cursor).toBe(4);
      ed.moveTo(-5);
      expect(ed.cursor).toBe(0);
      ed.moveRight(100);
      expect(ed.cursor).toBe(5);
    });

    it('backspace and deleteForward return what they removed and stop at the edges', () => {
      const ed = new TextEditor({ initialText: 'abcdef' });
      ed.moveTo(3);
      expect(ed.backspace(2)).toBe('bc');
      expect(ed.text).toBe('adef');
      expect(ed.cursor).toBe(1);
      expect(ed.deleteForward(10)).toBe('def');
      expect(ed.text).toBe('a');
      expect(ed.backspace(5)).toBe('a');
      expect(ed.backspace()).toBe('');
      expect(ed.text).toBe('');
    });
  });

  describe('undo and redo (Command)', () => {
    it('undoes and redoes edits in order, restoring text and cursor', () => {
      const ed = new TextEditor();
      ed.type('abc');
      ed.type('def');
      ed.backspace(2);
      expect(ed.text).toBe('abcd');

      ed.undo();
      expect([ed.text, ed.cursor]).toEqual(['abcdef', 6]);
      ed.undo();
      expect([ed.text, ed.cursor]).toEqual(['abc', 3]);
      ed.redo();
      expect([ed.text, ed.cursor]).toEqual(['abcdef', 6]);
    });

    it('returns false when there is nothing to undo or redo', () => {
      const ed = new TextEditor();
      expect(ed.undo()).toBe(false);
      expect(ed.redo()).toBe(false);
      ed.type('x');
      expect(ed.canUndo()).toBe(true);
      expect(ed.undo()).toBe(true);
      expect(ed.undo()).toBe(false);
      expect(ed.canRedo()).toBe(true);
    });

    it('a new edit clears the redo stack', () => {
      const ed = new TextEditor();
      ed.type('one');
      ed.undo();
      ed.type('two');
      expect(ed.redo()).toBe(false);
      expect(ed.text).toBe('two');
    });

    it('does not record cursor moves or empty edits as steps', () => {
      const ed = new TextEditor();
      ed.type('hello');
      ed.moveTo(0);
      ed.backspace(); // nothing before the cursor
      ed.type('');
      ed.undo(); // undoes the 'hello'
      expect(ed.text).toBe('');
      expect(ed.canUndo()).toBe(false);
    });

    it('redo inserts at the original place even if the cursor moved', () => {
      const ed = new TextEditor({ initialText: 'ac' });
      ed.moveTo(1);
      ed.type('b');
      ed.undo();
      ed.moveTo(0);
      ed.redo();
      expect(ed.text).toBe('abc');
    });

    it('undo of a delete puts the cursor back where it was', () => {
      const ed = new TextEditor({ initialText: 'abcdef' });
      ed.moveTo(2);
      ed.deleteForward(2);
      ed.undo();
      expect([ed.text, ed.cursor]).toEqual(['abcdef', 2]);
    });

    it('drops the oldest steps beyond the history limit', () => {
      const ed = new TextEditor({ historyLimit: 2 });
      ed.type('a');
      ed.type('b');
      ed.type('c');
      expect(ed.undo()).toBe(true);
      expect(ed.undo()).toBe(true);
      expect(ed.undo()).toBe(false);
      expect(ed.text).toBe('a');
    });
  });

  describe('snapshots (Memento)', () => {
    it('restores a saved snapshot, and the restore can be undone', () => {
      const ed = new TextEditor();
      ed.type('draft one');
      const snap = ed.save();
      ed.backspace(3);
      ed.type('two');
      expect(ed.text).toBe('draft two');

      ed.restore(snap);
      expect([ed.text, ed.cursor]).toEqual(['draft one', 9]);
      ed.undo();
      expect(ed.text).toBe('draft two');
    });

    it('a snapshot does not change when the editor changes', () => {
      const ed = new TextEditor({ initialText: 'v1' });
      const snap = ed.save();
      ed.type(' and more');
      const other = new TextEditor();
      other.restore(snap);
      expect(other.text).toBe('v1');
    });
  });

  describe('extensibility', () => {
    it('runs any EditCommand through the same undo/redo history', () => {
      class UpperCase implements EditCommand {
        private before = '';
        execute(doc: Doc) {
          this.before = doc.remove(0, doc.text.length);
          doc.insert(0, this.before.toUpperCase());
        }
        undo(doc: Doc) {
          doc.remove(0, doc.text.length);
          doc.insert(0, this.before);
        }
      }
      const ed = new TextEditor({ initialText: 'shout' });
      ed.execute(new UpperCase());
      expect(ed.text).toBe('SHOUT');
      ed.undo();
      expect(ed.text).toBe('shout');
      ed.redo();
      expect(ed.text).toBe('SHOUT');
    });
  });
});
