// 24 · In-memory File System: reference solution.
// Read this only after your own attempt passes (or after 90 minutes).

export type FsErrorCode = 'ENOENT' | 'ENOTDIR' | 'EISDIR' | 'EEXIST' | 'ENOTEMPTY' | 'EINVAL' | 'EBUSY';

export class FsError extends Error {
  constructor(readonly code: FsErrorCode, path: string) {
    super(`${code}: ${path}`);
    this.name = 'FsError';
  }
}

export type NodeType = 'file' | 'dir';

export interface NodeInfo {
  readonly path: string;
  readonly name: string;
  readonly type: NodeType;
  /** File: number of characters. Directory: total size of everything inside it. */
  readonly size: number;
}

export interface Options {
  recursive?: boolean;
}

// Composite: a directory holds nodes, and a node is either a file or a directory.
// Callers treat both the same way through size() and info().
abstract class FsNode {
  constructor(public name: string, public parent: Dir | null) {}

  abstract readonly type: NodeType;
  abstract size(): number;

  path(): string {
    if (!this.parent) return '/';
    const parentPath = this.parent.path();
    return parentPath === '/' ? `/${this.name}` : `${parentPath}/${this.name}`;
  }

  info(): NodeInfo {
    return { path: this.path(), name: this.name, type: this.type, size: this.size() };
  }

  isInside(dir: Dir): boolean {
    for (let n: FsNode | null = this; n; n = n.parent) if (n === dir) return true;
    return false;
  }
}

class File extends FsNode {
  readonly type = 'file' as const;
  content = '';

  size(): number {
    return this.content.length;
  }
}

class Dir extends FsNode {
  readonly type = 'dir' as const;
  readonly children = new Map<string, FsNode>();

  size(): number {
    let total = 0;
    for (const child of this.children.values()) total += child.size();
    return total;
  }

  add(node: FsNode): void {
    node.parent = this;
    this.children.set(node.name, node);
  }
}

export class FileSystem {
  private readonly root = new Dir('', null);
  private cwd: Dir = this.root;

  pwd(): string {
    return this.cwd.path();
  }

  cd(path: string): void {
    this.cwd = this.dirAt(path);
  }

  exists(path: string): boolean {
    return this.find(path) !== null;
  }

  /** Without `recursive`: the parent must exist and the target must not. With it: like `mkdir -p`. */
  mkdir(path: string, opts: Options = {}): void {
    const parts = this.split(path);
    if (parts.length === 0) {
      if (opts.recursive) return;
      throw new FsError('EEXIST', path);
    }
    if (!opts.recursive) {
      const { parent, name } = this.parentOf(path);
      if (parent.children.has(name)) throw new FsError('EEXIST', path);
      parent.add(new Dir(name, parent));
      return;
    }
    let dir = this.root;
    for (const name of parts) {
      const next = dir.children.get(name);
      if (!next) {
        const created = new Dir(name, dir);
        dir.add(created);
        dir = created;
      } else if (next instanceof Dir) {
        dir = next;
      } else {
        throw new FsError('ENOTDIR', path);
      }
    }
  }

  /** A directory: its children's names, sorted. A file: just its own name (like `ls file.txt`). */
  ls(path = '.'): string[] {
    const node = this.nodeAt(path);
    if (node instanceof Dir) return [...node.children.keys()].sort();
    return [node.name];
  }

  /** Creates the file if needed, replaces its content otherwise. The parent must exist. */
  writeFile(path: string, content: string): void {
    this.fileForWrite(path).content = content;
  }

  appendFile(path: string, content: string): void {
    this.fileForWrite(path).content += content;
  }

  readFile(path: string): string {
    const node = this.nodeAt(path);
    if (node instanceof Dir) throw new FsError('EISDIR', path);
    return (node as File).content;
  }

  rm(path: string, opts: Options = {}): void {
    const node = this.nodeAt(path);
    if (!node.parent) throw new FsError('EINVAL', path); // never remove the root
    if (node instanceof Dir) {
      if (node.children.size > 0 && !opts.recursive) throw new FsError('ENOTEMPTY', path);
      if (this.cwd.isInside(node)) throw new FsError('EBUSY', path);
    }
    node.parent.children.delete(node.name);
  }

  /**
   * If `dest` is an existing directory, move `src` into it and keep its name.
   * Otherwise move and rename to `dest`. A file may replace an existing file.
   */
  mv(src: string, dest: string): void {
    const node = this.nodeAt(src);
    if (!node.parent) throw new FsError('EINVAL', src);

    let target = this.find(dest);
    let parent: Dir;
    let name: string;
    if (target instanceof Dir) {
      parent = target;
      name = node.name;
      target = parent.children.get(name) ?? null;
    } else {
      ({ parent, name } = this.parentOf(dest));
    }

    if (target === node) return; // moving onto itself is a no-op
    if (node instanceof Dir && parent.isInside(node)) throw new FsError('EINVAL', dest); // into its own subtree
    if (target instanceof Dir) throw new FsError('EISDIR', dest);
    if (target && node instanceof Dir) throw new FsError('ENOTDIR', dest);

    node.parent.children.delete(node.name);
    node.name = name;
    parent.add(node);
  }

  stat(path: string): NodeInfo {
    return this.nodeAt(path).info();
  }

  /** Every node under `path` (including it) that passes `filter`, sorted by path. */
  findAll(path: string, filter: (node: NodeInfo) => boolean): NodeInfo[] {
    const out: NodeInfo[] = [];
    const walk = (n: FsNode) => {
      const info = n.info();
      if (filter(info)) out.push(info);
      if (n instanceof Dir) for (const child of n.children.values()) walk(child);
    };
    walk(this.nodeAt(path));
    return out.sort((a, b) => a.path.localeCompare(b.path));
  }

  // ---- path resolution ----

  /** Absolute list of names. Handles '.', '..', repeated and trailing slashes. '..' at the root stays at the root. */
  private split(path: string): string[] {
    if (path === '') throw new FsError('EINVAL', path);
    const parts = path.startsWith('/') ? [] : this.split(this.cwd.path()); // cwd path is absolute
    for (const seg of path.split('/')) {
      if (seg === '' || seg === '.') continue;
      if (seg === '..') parts.pop();
      else parts.push(seg);
    }
    return parts;
  }

  // Returns null for "does not exist". Throws ENOTDIR if a middle part is a file.
  private find(path: string): FsNode | null {
    let node: FsNode = this.root;
    for (const name of this.split(path)) {
      if (!(node instanceof Dir)) throw new FsError('ENOTDIR', path);
      const next = node.children.get(name);
      if (!next) return null;
      node = next;
    }
    return node;
  }

  private nodeAt(path: string): FsNode {
    const node = this.find(path);
    if (!node) throw new FsError('ENOENT', path);
    return node;
  }

  private dirAt(path: string): Dir {
    const node = this.nodeAt(path);
    if (!(node instanceof Dir)) throw new FsError('ENOTDIR', path);
    return node;
  }

  private parentOf(path: string): { parent: Dir; name: string } {
    const parts = this.split(path);
    const name = parts.pop();
    if (name === undefined) throw new FsError('EINVAL', path);
    return { parent: this.dirAt('/' + parts.join('/')), name };
  }

  private fileForWrite(path: string): File {
    const { parent, name } = this.parentOf(path);
    const existing = parent.children.get(name);
    if (existing instanceof Dir) throw new FsError('EISDIR', path);
    if (existing) return existing as File;
    const file = new File(name, parent);
    parent.add(file);
    return file;
  }
}
