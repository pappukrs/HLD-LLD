// H15 · Replication: a tiny leader-follower simulation.
// Run: npx tsx hld/3-databases/H15-replication/demo.ts
// Shows: log shipping with lag, a stale read, read-your-writes with an LSN,
// and what a leader crash does in async vs semi-sync mode.

export {};

type Entry = { lsn: number; key: string; value: number };
type Mode = 'async' | 'semi-sync';

class DbNode {
  log: Entry[] = [];
  data = new Map<string, number>();
  constructor(public name: string, public term = 1, public alive = true) {}
  get lsn(): number { return this.log.length ? this.log[this.log.length - 1].lsn : 0; }
  apply(e: Entry): void { this.log.push(e); this.data.set(e.key, e.value); }
}

class Cluster {
  leader: DbNode;
  followers: DbNode[];
  // Entries shipped but not yet replayed, per follower (simulates lag).
  inFlight = new Map<DbNode, Entry[]>();

  constructor(public mode: Mode) {
    this.leader = new DbNode('db-1');
    this.followers = [new DbNode('db-2'), new DbNode('db-3')];
    for (const f of this.followers) this.inFlight.set(f, []);
  }

  write(key: string, value: number): number {
    if (!this.leader.alive) throw new Error('no leader: write rejected (503)');
    const e: Entry = { lsn: this.leader.lsn + 1, key, value };
    this.leader.apply(e);
    const [syncF, ...rest] = this.followers;
    if (this.mode === 'semi-sync') syncF.apply(e);   // wait for ONE follower before ack
    else this.inFlight.get(syncF)!.push(e);
    for (const f of rest) this.inFlight.get(f)!.push(e); // always async
    return e.lsn;                                         // returned to the app
  }

  // Each follower replays up to `n` pending entries (n=0 means it is stuck / busy).
  replicate(steps: Record<string, number>): void {
    for (const f of this.followers) {
      const q = this.inFlight.get(f)!;
      const n = steps[f.name] ?? q.length;
      for (const e of q.splice(0, n)) f.apply(e);
    }
  }

  // Read-your-writes: only read a replica that has replayed minLsn.
  read(key: string, minLsn = 0): { from: string; value: number | undefined } {
    for (const f of this.followers) {
      if (f.alive && f.lsn >= minLsn) return { from: f.name, value: f.data.get(key) };
    }
    return { from: this.leader.name + ' (leader)', value: this.leader.data.get(key) };
  }

  crashLeaderAndFailover(): string {
    const old = this.leader;
    old.alive = false;
    // Promote the follower with the highest log position; bump the term (fencing).
    const best = [...this.followers].sort((a, b) => b.lsn - a.lsn)[0];
    best.term = old.term + 1;
    const others = this.followers.filter((f) => f !== best);
    // Lagging followers catch up from the NEW leader's log, not the dead one's.
    for (const f of others) {
      this.inFlight.set(f, best.log.filter((e) => e.lsn > f.lsn));
      f.term = best.term;
    }
    this.leader = best;
    this.followers = [...others, old];
    this.inFlight.set(old, []);
    return `${best.name} promoted (lsn ${best.lsn}, term ${best.term})`;
  }

  rejoinOld(old: DbNode): string {
    if (old.term < this.leader.term) {
      // Fenced: drop entries the new leader never had, then copy the new leader's log.
      const dropped = old.log.filter((e) => !this.leader.log.some((x) => x.lsn === e.lsn && x.value === e.value));
      old.log = []; old.data.clear();
      for (const e of this.leader.log) old.apply(e);
      old.term = this.leader.term; old.alive = true;
      return `${old.name} fenced (term was lower), dropped ${dropped.length} divergent entr${dropped.length === 1 ? 'y' : 'ies'}, now a follower`;
    }
    return 'no fencing needed';
  }
}

function header(t: string): void { console.log(`\n=== ${t} ===`); }

function scenario(mode: Mode): void {
  header(`Mode: ${mode}`);
  const c = new Cluster(mode);
  c.write('balance:u7', 100);
  c.replicate({});
  console.log('1. write balance=100, everyone caught up:', c.followers.map((f) => `${f.name}@${f.lsn}`).join(', '));

  // db-3 is busy (long report query): it replays nothing for a while.
  const lsn = c.write('balance:u7', 200);
  c.replicate({ 'db-2': 1, 'db-3': 0 });
  const stale = { from: 'db-3', value: c.followers[1].data.get('balance:u7') };
  console.log(`2. write balance=200 -> lsn ${lsn}. Naive read from ${stale.from}: ${stale.value} (STALE)`);
  const fresh = c.read('balance:u7', lsn);
  console.log(`3. read with minLsn=${lsn} -> ${fresh.from}: ${fresh.value} (read-your-writes)`);

  const acked = c.write('balance:u7', 250);
  console.log(`4. write balance=250 acked at lsn ${acked}; leader crashes before async shipping`);
  const old = c.leader;
  console.log('   ' + c.crashLeaderAndFailover());
  c.replicate({});
  const after = c.read('balance:u7');
  const lost = after.value !== 250;
  console.log(`5. after failover, balance = ${after.value} -> ${lost ? 'ACKED WRITE LOST' : 'no data lost'}`);
  c.write('balance:u7', 260);
  c.replicate({});
  console.log('6. new write balance=260 on', c.leader.name);
  console.log('7. ' + c.rejoinOld(old));
  console.log('   final:', [c.leader, ...c.followers].map((n) => `${n.name}=${n.data.get('balance:u7')}@${n.lsn}/t${n.term}`).join('  '));
}

function latency(): void {
  header('Commit latency per mode (one region vs cross region)');
  const disk = 1;               // ms to fsync on the leader
  const rows: Array<[string, number]> = [['same region (AZ-to-AZ)', 1], ['Mumbai <-> Singapore', 65], ['India <-> US East', 210]];
  for (const [path, rtt] of rows) {
    console.log(`${path.padEnd(24)} async=${disk} ms   semi-sync=${disk + rtt} ms`);
  }
  console.log('Lesson: semi-sync is cheap inside a region, expensive across regions.');
}

function main(): void {
  scenario('async');
  scenario('semi-sync');
  latency();
  header('Takeaways');
  console.log('- Replicas scale reads, not writes. Lag causes stale reads; fix with LSN or leader reads.');
  console.log('- Async can lose acked writes on failover; semi-sync keeps them on a second node.');
  console.log('- Terms (epochs) fence the old leader and prevent split brain.');
}

main();
