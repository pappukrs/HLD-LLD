# 24 · In-memory File System

> Asked at: Atlassian, Amazon, Microsoft, Rubrik, Uber, Google.
> Time box: **75 min** (10 min design, 50 min code, 15 min tests and extensions)
> Patterns you should reach for: **Composite** (a directory holds files and directories), one **path resolver** used by every command

## Problem statement (as the interviewer says it)

"Build an in-memory file system. Support `mkdir` (with `-p`), `ls`, writing, reading and appending files,
`rm` (with `-r`), `mv`, and `cd`. Paths can be absolute or relative and may contain `.` and `..`.
Give clear errors for bad paths."

## Step 1: clarify (ask these out loud)

Ask these before writing any code. The assumed answers below are what the tests expect.

| Question | Assumed answer |
|---|---|
| Paths? | Absolute (`/a/b`) or relative to the current directory. `.`, `..`, repeated `//` and a trailing `/` all work. `..` at the root stays at the root |
| Errors? | Throw `FsError` with a Unix-style code in the message: `ENOENT`, `ENOTDIR`, `EISDIR`, `EEXIST`, `ENOTEMPTY`, `EINVAL`, `EBUSY` |
| `mkdir` without `-p`? | The parent must exist (`ENOENT`) and the target must not (`EEXIST`) |
| `mkdir -p`? | Creates every missing part. An existing directory is fine. A file in the path → `ENOTDIR` |
| `ls` output? | Directory: child names, sorted. File: `[its name]` |
| `writeFile`? | Creates or overwrites. The parent must exist. A directory at the path → `EISDIR` |
| `appendFile`? | Creates the file if it is missing |
| `rm`? | A non-empty directory needs `recursive` (`ENOTEMPTY`). Removing `/` → `EINVAL`. Removing a directory that holds the current directory → `EBUSY` |
| `mv`? | If `dest` is an existing directory, move into it. Else move and rename. A file may replace a file. A directory into its own subtree → `EINVAL`. A directory onto a file → `ENOTDIR` |
| Sizes? | File = number of characters. Directory = total of everything inside it |
| Permissions, links, timestamps, binary data? | Out of scope. Mention them as extensions |

## Step 2: public API (what the tests call)

```ts
const fs = new FileSystem();

fs.mkdir('/home/asha/docs', { recursive: true });
fs.writeFile('/home/asha/docs/notes.txt', 'hello');
fs.appendFile('/home/asha/docs/notes.txt', ' world');
fs.readFile('/home/asha/docs/notes.txt');      // → 'hello world'
fs.ls('/home/asha');                            // → ['docs']
fs.cd('home/asha'); fs.pwd();                   // → '/home/asha'
fs.mv('docs/notes.txt', '/home');               // into an existing directory
fs.rm('/home/asha', { recursive: true });
fs.exists('/home/asha');                        // → false
fs.stat('/home');                               // → { path, name, type: 'dir', size }
fs.findAll('/', (n) => n.name.endsWith('.log'));   // → NodeInfo[] sorted by path
```

`FsError` (with a `code` field) is exported. The internals are **your design**.

## Step 3: entities (try them yourself first)

<details>
<summary>Reveal a good entity list</summary>

- `FileSystem`: the facade. Owns the root and the current directory
- `FsNode` (abstract): `name`, `parent`, `path()`, `size()`, `info()`
  - `File`: `content`. `size()` = content length
  - `Dir`: `children: Map<name, FsNode>`. `size()` = sum of children's `size()`. This recursion is the Composite pattern: the caller does not care if a node is a file or a directory
- Path resolver: `split(path)` turns any path into a clean list of names (handles `.`, `..`, `//`, relative paths). Write it **once**. Every command uses it
- `find(path)` → node or `null`; `nodeAt` throws `ENOENT`; `dirAt` also throws `ENOTDIR`; `parentOf(path)` → `{ parent, name }` for create and move
- A `parent` pointer in each node makes `path()`, `rm` and "is X inside Y" (for `mv` and `rm` guards) cheap

Common mistake: each command parses paths in its own way. Then `.` works in `ls` but not in `mv`.

</details>

## Step 4: implement

- Write your code in `starter.ts`. Keep the exported names.
- Run `npx vitest run lld/problems/24-file-system` until it's green.
- Don't open `reference.ts` until your tests pass, or until you've spent 75 minutes.

## Step 5: extensions interviewers ask after you finish

1. **Directory size is O(subtree).** Cache the size in each `Dir` and update it up the parent chain on every write, append, rm and mv.
2. **Find files.** `findAll` with a filter is a Visitor-like walk. Add filters by extension, size or name pattern, and combine them with AND/OR (a small Composite of filters).
3. **Permissions and owners.** Add `owner` and `mode` to `FsNode`. Check them in the resolver for every directory you pass through.
4. **Symbolic links.** A `Link` node that stores a path. The resolver follows it, with a hop limit to stop loops.
5. **Large files.** Store content as a list of fixed-size blocks, not one string. This is the first step toward a real file system or blob storage.
6. **Concurrent writes.** In one Node process, synchronous methods are safe. Across processes, you need file locks or a single writer per path.

## Self-check before you call it done

- [ ] One path resolver. No command splits on `/` by itself.
- [ ] No `if (node.type === 'dir')` in `size()`. Each node type computes its own size.
- [ ] Every error has a clear code. No silent `undefined` returns.
- [ ] A failed `mv` or `rm` leaves the tree unchanged.
- [ ] `mv /a /a/b` is rejected. You thought about moving a directory into itself.

## Concepts used

- [Composite pattern](../../3-structural/L17-composite/README.md) · [Iterator (tree walk)](../../4-behavioral/L27-iterator/README.md) · [SOLID](../../1-foundations/L04-solid-srp-ocp/README.md) · [Machine-coding framework](../../5-machine-coding/L30-machine-coding-framework/README.md)
- Related HLD: [File Storage and Sync (Dropbox)](../../../hld/case-studies/15-file-storage) · [Blob/object storage](../../../hld/6-building-blocks/H32-blob-storage/README.md)
