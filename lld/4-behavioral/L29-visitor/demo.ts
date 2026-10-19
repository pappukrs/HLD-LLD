// L29 · Visitor
// Run: npx tsx lld/4-behavioral/L29-visitor/demo.ts
// Part 1: classic GoF visitor (double dispatch) over a file-system tree.
// Part 2: the idiomatic TS alternative: a discriminated union + exhaustive switch,
//         used for cart pricing (tax and shipping as separate "visitors").

// ---------- Part 1: classic Visitor ----------
interface FsVisitor<R> {
  visitFile(f: FileNode): R;
  visitFolder(d: FolderNode): R;
}

interface FsNode {
  readonly name: string;
  accept<R>(v: FsVisitor<R>): R; // dispatch #1: on the node's runtime class
}

class FileNode implements FsNode {
  constructor(readonly name: string, readonly bytes: number) {}
  accept<R>(v: FsVisitor<R>): R { return v.visitFile(this); } // dispatch #2: on the visitor
}

class FolderNode implements FsNode {
  constructor(readonly name: string, readonly children: FsNode[] = []) {}
  accept<R>(v: FsVisitor<R>): R { return v.visitFolder(this); }
}

// New operations = new classes. FileNode and FolderNode never change.
class SizeVisitor implements FsVisitor<number> {
  visitFile(f: FileNode): number { return f.bytes; }
  visitFolder(d: FolderNode): number { return d.children.reduce((s, c) => s + c.accept(this), 0); }
}

class FindVisitor implements FsVisitor<string[]> {
  constructor(private readonly ext: string, private readonly path = '') {}
  visitFile(f: FileNode): string[] { return f.name.endsWith(this.ext) ? [this.path + f.name] : []; }
  visitFolder(d: FolderNode): string[] {
    const inner = new FindVisitor(this.ext, this.path + d.name + '/');
    return d.children.flatMap((c) => c.accept(inner));
  }
}

class TreePrinter implements FsVisitor<string[]> {
  private depth = 0;
  visitFile(f: FileNode): string[] { return [`${'  '.repeat(this.depth)}${f.name} (${f.bytes} B)`]; }
  visitFolder(d: FolderNode): string[] {
    const out = [`${'  '.repeat(this.depth)}${d.name}/`];
    this.depth++;
    for (const c of d.children) out.push(...c.accept(this));
    this.depth--;
    return out;
  }
}

// ---------- Part 2: discriminated union + exhaustive switch ----------
type CartItem =
  | { kind: 'physical'; name: string; price: number; weightKg: number }
  | { kind: 'digital'; name: string; price: number }
  | { kind: 'giftCard'; name: string; price: number };

function assertNever(x: never): never { throw new Error('Unhandled: ' + JSON.stringify(x)); }

// Each function is one "visitor". Add a new kind and tsc flags every switch that misses it.
function gstRate(item: CartItem): number {
  switch (item.kind) {
    case 'physical': return 0.18;
    case 'digital': return 0.18;
    case 'giftCard': return 0; // GST is charged when the card is redeemed
    default: return assertNever(item);
  }
}

function shipping(item: CartItem): number {
  switch (item.kind) {
    case 'physical': return item.weightKg <= 1 ? 40 : 40 + Math.ceil(item.weightKg - 1) * 20;
    case 'digital':
    case 'giftCard': return 0;
    default: return assertNever(item);
  }
}

function main(): void {
  console.log('== 1. Build a tree (the element classes are stable) ==');
  const root = new FolderNode('project', [
    new FileNode('README.md', 1200),
    new FolderNode('src', [new FileNode('index.ts', 3400), new FileNode('util.ts', 900)]),
    new FolderNode('docs', [new FileNode('guide.md', 5000), new FolderNode('img', [new FileNode('logo.png', 20480)])]),
  ]);
  root.accept(new TreePrinter()).forEach((l) => console.log('  ' + l));

  console.log('\n== 2. Operation: total size (SizeVisitor) ==');
  console.log(`  total = ${root.accept(new SizeVisitor())} bytes`);

  console.log('\n== 3. Operation: find *.md (FindVisitor) ==');
  root.accept(new FindVisitor('.md')).forEach((p) => console.log('  ' + p));

  console.log('\n== 4. Double dispatch trace ==');
  const f = new FileNode('a.ts', 10);
  const traced: FsVisitor<string> = {
    visitFile: (x) => `visitFile(${x.name}) chosen because node is FileNode and visitor is "traced"`,
    visitFolder: (x) => `visitFolder(${x.name})`,
  };
  console.log('  ' + f.accept(traced));

  console.log('\n== 5. TS-native: union + exhaustive switch for cart pricing ==');
  const cart: CartItem[] = [
    { kind: 'physical', name: 'Keyboard', price: 2500, weightKg: 1.2 },
    { kind: 'digital', name: 'E-book', price: 400 },
    { kind: 'giftCard', name: 'Gift card', price: 1000 },
  ];
  let total = 0;
  for (const it of cart) {
    const tax = Math.round(it.price * gstRate(it));
    const ship = shipping(it);
    total += it.price + tax + ship;
    console.log(`  ${it.name.padEnd(10)} price ${String(it.price).padStart(5)}  gst ${String(tax).padStart(4)}  ship ${String(ship).padStart(3)}`);
  }
  console.log(`  cart total = ₹${total}`);
  console.log('  (add { kind: "subscription" } to CartItem and tsc errors in gstRate and shipping until you handle it)');
}

main();

export {};
