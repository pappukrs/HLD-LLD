// P09 · Composite
// Run: npx tsx lld/concepts/patterns/p09-composite.ts

// ---------- before: type checks in every operation ----------
type RawNode = { kind: 'file'; name: string; bytes: number } | { kind: 'folder'; name: string; children: RawNode[] };
function sizeBefore(node: RawNode): number {
  if (node.kind === 'file') return node.bytes;
  return node.children.reduce((s, c) => s + (c.kind === 'file' ? c.bytes : sizeBefore(c)), 0);
}

// ---------- after: one interface for leaf and composite ----------
interface FsNode {
  readonly name: string;
  size(): number;
  print(indent?: string): string[];
}

class File implements FsNode {
  constructor(readonly name: string, private readonly bytes: number) {}
  size(): number { return this.bytes; }
  print(indent = ''): string[] { return [`${indent}${this.name} (${this.bytes}B)`]; }
}

class Folder implements FsNode {
  private children = new Map<string, FsNode>();
  constructor(readonly name: string) {}

  add(node: FsNode): this {
    if (this.children.has(node.name)) throw new Error(`${node.name} already exists in ${this.name}`);
    this.children.set(node.name, node);
    return this;
  }
  get(name: string): FsNode | undefined { return this.children.get(name); }
  size(): number {
    let total = 0;
    for (const c of this.children.values()) total += c.size();
    return total;
  }
  print(indent = ''): string[] {
    const lines = [`${indent}${this.name}/`];
    for (const c of this.children.values()) lines.push(...c.print(indent + '  '));
    return lines;
  }
}

function resolve(root: Folder, path: string): FsNode {
  let current: FsNode = root;
  for (const part of path.split('/').filter(Boolean)) {
    if (!(current instanceof Folder)) throw new Error(`${current.name} is not a folder`);
    const next = current.get(part);
    if (!next) throw new Error(`Not found: ${path}`);
    current = next;
  }
  return current;
}

// ---------- the same idea for an order: products and bundles ----------
interface Priced { readonly name: string; price(): number }
class Product implements Priced {
  constructor(readonly name: string, private readonly amount: number) {}
  price() { return this.amount; }
}
class Bundle implements Priced {
  constructor(readonly name: string, private readonly items: Priced[], private readonly discountPct: number) {}
  price() {
    const sum = this.items.reduce((s, i) => s + i.price(), 0);
    return Math.round(sum * (1 - this.discountPct / 100));
  }
}

function main() {
  console.log('--- before ---');
  const raw: RawNode = {
    kind: 'folder', name: 'root',
    children: [{ kind: 'file', name: 'a.txt', bytes: 10 }, { kind: 'folder', name: 'logs', children: [{ kind: 'file', name: 'x.log', bytes: 90 }] }],
  };
  console.log(`  size: ${sizeBefore(raw)}`);

  console.log('\n--- after: file system tree ---');
  const root = new Folder('root')
    .add(new File('README.md', 120))
    .add(new Folder('invoices').add(new File('2026-09.pdf', 4_000)).add(new File('2026-10.pdf', 4_200)))
    .add(new Folder('logs').add(new Folder('payments').add(new File('app.log', 900))));
  console.log(root.print().map((l) => '  ' + l).join('\n'));
  console.log(`  total size: ${root.size()}B`);
  console.log(`  /invoices size: ${resolve(root, '/invoices').size()}B`);
  console.log(`  /logs/payments/app.log size: ${resolve(root, '/logs/payments/app.log').size()}B`);
  try {
    resolve(root, '/README.md/x');
  } catch (e) {
    console.log(`  expected error: ${(e as Error).message}`);
  }

  console.log('\n--- after: order with nested bundles ---');
  const cart: Priced[] = [
    new Product('Phone', 30_000),
    new Bundle('Accessory kit', [new Product('Case', 500), new Product('Charger', 1_500), new Bundle('Cables', [new Product('USB-C', 300), new Product('Lightning', 300)], 50)], 10),
  ];
  for (const line of cart) console.log(`  ${line.name.padEnd(14)} ${line.price()}`);
  console.log(`  total          ${cart.reduce((s, l) => s + l.price(), 0)}`);
}

main();

export {};
