// L17 Composite: one interface for a leaf and a group. File tree, combo bundle, coupon rule tree.
// Run: npx tsx lld/3-structural/L17-composite/demo.ts

// ---------- 1. File system ----------
interface FsNode {
  readonly name: string;
  parent?: Folder;
  size(): number;
  find(pred: (n: FsNode) => boolean, path?: string): string[];
  print(indent?: string): string[];
}

class File implements FsNode {
  parent?: Folder;
  constructor(readonly name: string, private kb: number) {}
  size(): number { return this.kb; }
  find(pred: (n: FsNode) => boolean, path = ''): string[] { return pred(this) ? [path + this.name] : []; }
  print(indent = ''): string[] { return [`${indent}${this.name}  ${this.kb} KB`]; }
}

class Folder implements FsNode {
  parent?: Folder;
  private children = new Map<string, FsNode>();
  constructor(readonly name: string) {}

  add(n: FsNode): this {
    if (this.children.has(n.name)) throw new Error(`EEXIST ${n.name}`);
    if (n instanceof Folder && this.isInside(n)) throw new Error(`EINVAL: cannot move ${n.name}/ into its own child`);
    n.parent?.children.delete(n.name);
    n.parent = this;
    this.children.set(n.name, n);
    return this;
  }
  private isInside(n: Folder): boolean {      // walk up parent pointers: cycle guard
    for (let p: Folder | undefined = this; p; p = p.parent) if (p === n) return true;
    return false;
  }
  size(): number { let s = 0; for (const c of this.children.values()) s += c.size(); return s; }
  find(pred: (n: FsNode) => boolean, path = ''): string[] {
    const here = path + this.name + '/';
    return [...this.children.values()].flatMap((c) => c.find(pred, here));
  }
  print(indent = ''): string[] {
    return [`${indent}${this.name}/  ${this.size()} KB`, ...[...this.children.values()].flatMap((c) => c.print(indent + '  '))];
  }
}

// ---------- 2. Cart bundles ----------
interface Priced { name: string; price(): number }
class Product implements Priced {
  constructor(readonly name: string, private rs: number) {}
  price(): number { return this.rs; }
}
class Combo implements Priced {
  constructor(readonly name: string, private parts: Priced[], private discountPct: number) {}
  price(): number {
    const sum = this.parts.reduce((s, p) => s + p.price(), 0);
    return Math.round(sum * (1 - this.discountPct / 100));
  }
}

// ---------- 3. Coupon rule tree ----------
type Cart = { total: number; newUser: boolean; categories: string[] };
interface Rule { matches(c: Cart): boolean; describe(): string }
const minAmount = (min: number): Rule => ({ matches: (c) => c.total >= min, describe: () => `total>=${min}` });
const newUser = (): Rule => ({ matches: (c) => c.newUser, describe: () => 'newUser' });
const category = (cat: string): Rule => ({ matches: (c) => c.categories.includes(cat), describe: () => `has ${cat}` });
class AllOf implements Rule {
  constructor(private rules: Rule[]) {}
  matches(c: Cart): boolean { return this.rules.every((r) => r.matches(c)); }
  describe(): string { return `(${this.rules.map((r) => r.describe()).join(' AND ')})`; }
}
class AnyOf implements Rule {
  constructor(private rules: Rule[]) {}
  matches(c: Cart): boolean { return this.rules.some((r) => r.matches(c)); }
  describe(): string { return `(${this.rules.map((r) => r.describe()).join(' OR ')})`; }
}

function main(): void {
  console.log('== 1. File tree: the caller never checks "file or folder?"');
  const root = new Folder('root');
  const src = new Folder('src');
  const lib = new Folder('lib');
  const docs = new Folder('docs');
  root.add(src).add(docs).add(new File('README.md', 2));
  src.add(new File('index.ts', 3)).add(new File('app.ts', 5)).add(lib);
  lib.add(new File('util.ts', 4)).add(new File('db.ts', 6));
  docs.add(new File('guide.md', 8));
  root.print().forEach((l) => console.log('  ' + l));
  console.log(`  root.size() = ${root.size()} KB, src.size() = ${src.size()} KB, one file = ${new File('x', 7).size()} KB`);
  console.log(`  find(*.ts) -> ${root.find((n) => n instanceof File && n.name.endsWith('.ts')).join(', ')}`);

  console.log('\n== 2. Cycle guard: mv src -> src/lib');
  try { lib.add(src); } catch (e) { console.log(`  ${(e as Error).message}`); }
  docs.add(lib); // a legal move
  console.log(`  mv src/lib -> docs/lib ok. src=${src.size()} KB, docs=${docs.size()} KB, root still ${root.size()} KB`);

  console.log('\n== 3. Combo bundle: a combo inside a combo');
  const burger = new Product('burger', 180), fries = new Product('fries', 90), coke = new Product('coke', 60);
  const meal = new Combo('meal', [burger, fries, coke], 10);
  const family = new Combo('family pack', [meal, meal, new Product('ice cream', 120)], 5);
  for (const p of [burger, meal, family]) console.log(`  ${p.name.padEnd(12)} Rs ${p.price()}`);

  console.log('\n== 4. Coupon rule tree');
  const rule = new AllOf([minAmount(500), new AnyOf([newUser(), category('shoes')])]);
  console.log(`  rule: ${rule.describe()}`);
  const carts: Cart[] = [
    { total: 800, newUser: false, categories: ['shoes'] },
    { total: 800, newUser: false, categories: ['books'] },
    { total: 300, newUser: true, categories: ['shoes'] },
  ];
  carts.forEach((c) => console.log(`  ${JSON.stringify(c)} -> ${rule.matches(c) ? 'APPLY' : 'reject'}`));

  console.log('\nTakeaway: leaf and group share one interface; a group delegates to its children and combines the answers.');
}

main();

export {};
