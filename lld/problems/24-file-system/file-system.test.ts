import * as starter from './starter';
import * as reference from './reference';

// `npm test` checks your starter.ts; `npm run test:ref` checks the reference.
const { FileSystem } = (process.env.REF ? reference : starter) as typeof reference;

function makeFs() {
  const fs = new FileSystem();
  fs.mkdir('/home/asha/docs', { recursive: true });
  fs.writeFile('/home/asha/docs/notes.txt', 'hello');
  return fs;
}

describe('24 · In-memory File System', () => {
  describe('mkdir and ls', () => {
    it('mkdir -p creates every missing directory; ls returns sorted names', () => {
      const fs = makeFs();
      fs.mkdir('/home/zed');
      fs.mkdir('/home/bob');
      expect(fs.ls('/home')).toEqual(['asha', 'bob', 'zed']);
      expect(fs.ls('/home/asha/docs')).toEqual(['notes.txt']);
      expect(fs.ls('/')).toEqual(['home']);
    });

    it('mkdir without -p needs the parent and rejects existing paths', () => {
      const fs = makeFs();
      expect(() => fs.mkdir('/a/b')).toThrow(/ENOENT/);
      expect(() => fs.mkdir('/home')).toThrow(/EEXIST/);
      expect(() => fs.mkdir('/home', { recursive: true })).not.toThrow();
      expect(() => fs.mkdir('/home/asha/docs/notes.txt/x', { recursive: true })).toThrow(/ENOTDIR/);
    });

    it('ls on a file returns its name; ls on a missing path throws', () => {
      const fs = makeFs();
      expect(fs.ls('/home/asha/docs/notes.txt')).toEqual(['notes.txt']);
      expect(() => fs.ls('/nope')).toThrow(/ENOENT/);
    });
  });

  describe('files', () => {
    it('writes, overwrites, appends and reads', () => {
      const fs = makeFs();
      fs.writeFile('/home/a.txt', 'one');
      fs.writeFile('/home/a.txt', 'two');
      fs.appendFile('/home/a.txt', '+three');
      fs.appendFile('/home/new.log', 'created');
      expect(fs.readFile('/home/a.txt')).toBe('two+three');
      expect(fs.readFile('/home/new.log')).toBe('created');
    });

    it('gives clear errors for bad file paths', () => {
      const fs = makeFs();
      expect(() => fs.readFile('/home/missing.txt')).toThrow(/ENOENT/);
      expect(() => fs.readFile('/home')).toThrow(/EISDIR/);
      expect(() => fs.writeFile('/home/asha', 'x')).toThrow(/EISDIR/);
      expect(() => fs.writeFile('/no/such/dir/f.txt', 'x')).toThrow(/ENOENT/);
      expect(() => fs.writeFile('/home/asha/docs/notes.txt/f.txt', 'x')).toThrow(/ENOTDIR/);
      expect(() => fs.writeFile('/', 'x')).toThrow(/EINVAL/);
    });
  });

  describe('path resolution', () => {
    it("handles '.', '..', repeated and trailing slashes", () => {
      const fs = makeFs();
      expect(fs.readFile('/home/./asha//docs/../docs/notes.txt')).toBe('hello');
      expect(fs.ls('/home/asha/')).toEqual(['docs']);
      expect(fs.ls('/../../home')).toEqual(['asha']); // '..' at the root stays at the root
    });

    it('resolves relative paths from the current directory', () => {
      const fs = makeFs();
      expect(fs.pwd()).toBe('/');
      fs.cd('home/asha');
      expect(fs.pwd()).toBe('/home/asha');
      expect(fs.readFile('docs/notes.txt')).toBe('hello');
      fs.cd('..');
      expect(fs.pwd()).toBe('/home');
      expect(() => fs.cd('/home/asha/docs/notes.txt')).toThrow(/ENOTDIR/);
      expect(() => fs.cd('ghost')).toThrow(/ENOENT/);
    });
  });

  describe('rm', () => {
    it('removes files; a non-empty directory needs recursive', () => {
      const fs = makeFs();
      fs.rm('/home/asha/docs/notes.txt');
      expect(fs.exists('/home/asha/docs/notes.txt')).toBe(false);
      fs.writeFile('/home/asha/docs/b.txt', 'x');
      expect(() => fs.rm('/home/asha')).toThrow(/ENOTEMPTY/);
      fs.rm('/home/asha', { recursive: true });
      expect(fs.ls('/home')).toEqual([]);
      expect(() => fs.rm('/home/asha')).toThrow(/ENOENT/);
    });

    it('refuses to remove the root or the current directory', () => {
      const fs = makeFs();
      expect(() => fs.rm('/', { recursive: true })).toThrow(/EINVAL/);
      fs.cd('/home/asha/docs');
      expect(() => fs.rm('/home', { recursive: true })).toThrow(/EBUSY/);
    });
  });

  describe('mv', () => {
    it('renames a file, and moves it into an existing directory', () => {
      const fs = makeFs();
      fs.mv('/home/asha/docs/notes.txt', '/home/asha/docs/todo.txt');
      expect(fs.ls('/home/asha/docs')).toEqual(['todo.txt']);
      fs.mv('/home/asha/docs/todo.txt', '/home');
      expect(fs.readFile('/home/todo.txt')).toBe('hello');
      expect(fs.ls('/home/asha/docs')).toEqual([]);
    });

    it('moves a whole directory tree and replaces a file with a file', () => {
      const fs = makeFs();
      fs.mkdir('/backup');
      fs.mv('/home/asha', '/backup');
      expect(fs.readFile('/backup/asha/docs/notes.txt')).toBe('hello');
      expect(fs.exists('/home/asha')).toBe(false);

      fs.writeFile('/backup/old.txt', 'old');
      fs.writeFile('/backup/new.txt', 'new');
      fs.mv('/backup/new.txt', '/backup/old.txt');
      expect(fs.readFile('/backup/old.txt')).toBe('new');
      expect(fs.exists('/backup/new.txt')).toBe(false);
    });

    it('rejects moving a directory into itself and other bad moves', () => {
      const fs = makeFs();
      expect(() => fs.mv('/home', '/home/asha/docs')).toThrow(/EINVAL/);
      fs.writeFile('/f.txt', 'f');
      expect(() => fs.mv('/home/asha', '/f.txt')).toThrow(/ENOTDIR/); // a directory cannot replace a file
      expect(() => fs.mv('/ghost', '/home')).toThrow(/ENOENT/);
      expect(() => fs.mv('/home/asha/docs/notes.txt', '/no/where.txt')).toThrow(/ENOENT/);
      expect(fs.readFile('/home/asha/docs/notes.txt')).toBe('hello');
    });
  });

  describe('Composite', () => {
    it('a directory size is the total size of everything inside it', () => {
      const fs = makeFs(); // notes.txt = 5
      fs.writeFile('/home/asha/a.txt', '123');
      fs.mkdir('/home/asha/empty');
      expect(fs.stat('/home/asha/docs/notes.txt')).toEqual({ path: '/home/asha/docs/notes.txt', name: 'notes.txt', type: 'file', size: 5 });
      expect(fs.stat('/home').size).toBe(8);
      expect(fs.stat('/').type).toBe('dir');
    });
  });

  describe('extensibility', () => {
    it('findAll walks the tree with any filter', () => {
      const fs = makeFs();
      fs.writeFile('/home/asha/a.log', 'x');
      fs.writeFile('/home/asha/docs/b.log', 'yyyy');
      const logs = fs.findAll('/', (n) => n.type === 'file' && n.name.endsWith('.log'));
      expect(logs.map((n) => n.path)).toEqual(['/home/asha/a.log', '/home/asha/docs/b.log']);
      const big = fs.findAll('/home', (n) => n.type === 'file' && n.size >= 4);
      expect(big.map((n) => n.name)).toEqual(['b.log', 'notes.txt']);
    });
  });
});
