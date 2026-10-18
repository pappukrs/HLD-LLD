// 24 · In-memory File System: your implementation goes here.
// Keep the exported names and signatures; the tests import them.
// Run: npx vitest run lld/problems/24-file-system

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

export class FileSystem {
  constructor() {
    // TODO: a root directory, and the current directory (starts at the root)
  }

  pwd(): string {
    throw new Error('TODO');
  }

  cd(path: string): void {
    throw new Error('TODO');
  }

  exists(path: string): boolean {
    throw new Error('TODO');
  }

  /** Without `recursive`: the parent must exist and the target must not. With it: like `mkdir -p`. */
  mkdir(path: string, opts: Options = {}): void {
    throw new Error('TODO');
  }

  /** A directory: its children's names, sorted. A file: just its own name (like `ls file.txt`). */
  ls(path = '.'): string[] {
    throw new Error('TODO');
  }

  /** Creates the file if needed, replaces its content otherwise. The parent must exist. */
  writeFile(path: string, content: string): void {
    throw new Error('TODO');
  }

  /** Creates the file if needed. */
  appendFile(path: string, content: string): void {
    throw new Error('TODO');
  }

  readFile(path: string): string {
    throw new Error('TODO');
  }

  /** A non-empty directory needs `recursive`. The root cannot be removed. */
  rm(path: string, opts: Options = {}): void {
    throw new Error('TODO');
  }

  /**
   * If `dest` is an existing directory, move `src` into it and keep its name.
   * Otherwise move and rename to `dest`. A file may replace an existing file.
   */
  mv(src: string, dest: string): void {
    throw new Error('TODO');
  }

  stat(path: string): NodeInfo {
    throw new Error('TODO');
  }

  /** Every node under `path` (including it) that passes `filter`, sorted by path. */
  findAll(path: string, filter: (node: NodeInfo) => boolean): NodeInfo[] {
    throw new Error('TODO');
  }
}
