// L12 · Prototype: Day 16 practice, a rewrite of the core idea on new domains.
// Run: npx tsx lld/2-creational/L12-prototype/practice.ts
// Different domains from demo.ts on purpose: Snake and Ladder board templates in a registry
// (self-test Q3, Q6) and KV store snapshots (self-test Q5), plus the copy traps (Q1, Q2, Q7).

export {};

interface Cloneable<T> { clone(): T }

// ---------- 1. Board template registry ----------
// Rules is an immutable value object, so clones may share it (self-test Q3).
class Rules {
  constructor(readonly diceFaces: number, readonly exactFinish: boolean) { Object.freeze(this); }
}

class GameBoard implements Cloneable<GameBoard> {
  constructor(
    public name: string,
    public readonly size: number,
    public jumps: Map<number, number>,  // mutable: a variant may add or move a snake
    public positions: Map<string, number>, // mutable: per-game player state
    public readonly rules: Rules,       // immutable: shared on purpose
  ) {}

  clone(): GameBoard {
    // Deep where a clone may change (jumps, positions), shared where it can't (rules, strings).
    return new GameBoard(this.name, this.size, new Map(this.jumps), new Map(this.positions), this.rules);
  }

  join(player: string) { this.positions.set(player, 0); return this; }

  move(player: string, roll: number): number {
    const from = this.positions.get(player);
    if (from === undefined) throw new Error(`${player} has not joined`);
    let to = from + roll;
    if (to > this.size) to = this.rules.exactFinish ? from : this.size;
    to = this.jumps.get(to) ?? to;
    this.positions.set(player, to);
    return to;
  }
}

class BoardRegistry {
  private readonly prototypes = new Map<string, GameBoard>();
  register(key: string, board: GameBoard) { this.prototypes.set(key, board); return this; }
  create(key: string): GameBoard {
    const proto = this.prototypes.get(key);
    if (!proto) throw new Error(`no board template "${key}"`);
    return proto.clone(); // never the stored object (self-test Q6)
  }
}

// ---------- 2. KV store with snapshots ----------
// A snapshot is a clone of the store's state. restore() takes a clone too, so the same
// snapshot can be restored twice. This is where Prototype meets Memento (self-test Q5).
class KvStore implements Cloneable<KvStore> {
  private data = new Map<string, { value: string; tags: string[] }>();

  set(k: string, value: string, tags: string[] = []) { this.data.set(k, { value, tags: [...tags] }); }
  get(k: string) { return this.data.get(k)?.value; }
  tag(k: string, t: string) { this.data.get(k)?.tags.push(t); }
  tags(k: string) { return [...(this.data.get(k)?.tags ?? [])]; }

  clone(): KvStore {
    const copy = new KvStore();
    // new Map(this.data) alone would share each entry object, and tag() would leak back.
    for (const [k, e] of this.data) copy.data.set(k, { value: e.value, tags: [...e.tags] });
    return copy;
  }
  snapshot(): KvStore { return this.clone(); }
  restore(snap: KvStore) { this.data = snap.clone().data; }
}

// ---------- checks ----------
let pass = 0;
const ok = (cond: boolean, name: string) => {
  if (!cond) throw new Error(`FAILED: ${name}`);
  pass++;
  console.log(`  ok  ${name}`);
};

console.log('\n=== Copy traps ===');
const tpl = { name: 'classic', jumps: [[99, 7]], meta: { createdAt: new Date('2026-11-03'), owners: new Set(['admin']) } };
const spread = { ...tpl };
spread.jumps.push([3, 38]);
ok(tpl.jumps.length === 2, 'spread shares the nested array, so the template changed too (Q1)');

const viaJson = JSON.parse(JSON.stringify(tpl.meta));
ok(typeof viaJson.createdAt === 'string', 'JSON round trip turns a Date into a string (Q7)');
ok(!(viaJson.owners instanceof Set) && Object.keys(viaJson.owners).length === 0, 'JSON round trip turns a Set into {} (Q7)');

// TS types the result as Rules, which is a lie at runtime; widen it so the check below is honest.
const sc: { diceFaces: number } = structuredClone(new Rules(6, true));
ok(!(sc instanceof Rules) && sc.diceFaces === 6, 'structuredClone keeps the data but drops the class (Q2)');

console.log('\n=== BoardRegistry ===');
const registry = new BoardRegistry().register(
  'classic',
  new GameBoard('classic', 100, new Map([[99, 7], [62, 19], [3, 38], [28, 84]]), new Map(), new Rules(6, true)),
);
const g1 = registry.create('classic').join('asha');
const g2 = registry.create('classic').join('ravi');
ok(g1 !== g2, 'each create() returns a new board');
ok(g1.move('asha', 3) === 38, 'a clone plays with the template jumps (ladder 3 -> 38)');
ok(!g2.positions.has('asha') && g2.positions.get('ravi') === 0, 'players in one game do not leak into another');

g1.jumps.set(50, 10); // a "hard mode" tweak on one game only
ok(!registry.create('classic').jumps.has(50), 'changing a clone\'s jumps leaves the template alone');
ok(g1.rules === g2.rules, 'the frozen Rules object is shared, not copied');
ok(Object.isFrozen(g1.rules), 'shared Rules is frozen, so sharing is safe');

g2.positions.set('ravi', 98);
ok(g2.move('ravi', 5) === 98, 'exact finish: overshooting 100 keeps the player in place');

let threw = false;
try { registry.create('mini'); } catch { threw = true; }
ok(threw, 'unknown template throws');

console.log('\n=== KvStore snapshots ===');
const kv = new KvStore();
kv.set('user:1', 'Asha', ['vip']);
const snap = kv.snapshot();
kv.set('user:1', 'Asha K');
kv.tag('user:1', 'beta');
kv.set('user:2', 'Ravi');
ok(snap.get('user:1') === 'Asha' && snap.tags('user:1').length === 1, 'snapshot does not see later writes or tags');
kv.restore(snap);
ok(kv.get('user:1') === 'Asha' && kv.get('user:2') === undefined, 'restore brings back the old state');
kv.tag('user:1', 'after-restore');
ok(snap.tags('user:1').join() === 'vip', 'writing after restore does not change the snapshot');
kv.restore(snap);
ok(kv.tags('user:1').join() === 'vip', 'the same snapshot can be restored twice');

console.log(`\n${pass} checks passed`);
