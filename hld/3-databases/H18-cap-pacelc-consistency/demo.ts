// H18 · CAP, PACELC and consistency models
// Run: npx tsx hld/3-databases/H18-cap-pacelc-consistency/demo.ts
// Three small simulations: CP vs AP during a partition, LWW vs merge after healing,
// and a read-your-writes router on top of async replicas.
export {};

type Node = { name: string; side: 'west' | 'east'; cart: Set<string>; clock: Record<string, number>; lsn: number };

const header = (t: string) => console.log(`\n=== ${t} ===`);

function makeCluster(): Node[] {
  return [
    { name: 'A', side: 'west', cart: new Set(['book']), clock: {}, lsn: 1 },
    { name: 'C', side: 'west', cart: new Set(['book']), clock: {}, lsn: 1 },
    { name: 'B', side: 'east', cart: new Set(['book']), clock: {}, lsn: 1 },
  ];
}

// ---- 1. CP: only a side holding a majority may commit ----
function cpWrite(cluster: Node[], at: Node, item: string, partitioned: boolean): string {
  const reachable = partitioned ? cluster.filter((n) => n.side === at.side) : cluster;
  const majority = Math.floor(cluster.length / 2) + 1;
  if (reachable.length < majority) return `REJECTED on ${at.name} (${reachable.length}/${cluster.length} reachable, need ${majority})`;
  for (const n of reachable) { n.cart.add(item); n.lsn++; }
  return `COMMITTED on ${reachable.map((n) => n.name).join(',')} (${reachable.length}/${cluster.length})`;
}

// ---- 2. AP: every side accepts; version vectors detect concurrency ----
function apWrite(cluster: Node[], at: Node, item: string): void {
  at.clock[at.name] = (at.clock[at.name] ?? 0) + 1;
  for (const n of cluster.filter((x) => x.side === at.side)) {
    n.cart.add(item);
    n.clock = { ...at.clock };
  }
}

function compare(a: Record<string, number>, b: Record<string, number>): 'a<b' | 'a>b' | 'equal' | 'concurrent' {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  let less = false, more = false;
  for (const k of keys) {
    if ((a[k] ?? 0) < (b[k] ?? 0)) less = true;
    if ((a[k] ?? 0) > (b[k] ?? 0)) more = true;
  }
  if (less && more) return 'concurrent';
  return less ? 'a<b' : more ? 'a>b' : 'equal';
}

// ---- 3. Read-your-writes router ----
type Replica = { name: string; appliedLsn: number; latencyMs: number };

function routeRead(replicas: Replica[], leader: Replica, minLsn: number): Replica {
  const fresh = replicas.filter((r) => r.appliedLsn >= minLsn).sort((x, y) => x.latencyMs - y.latencyMs);
  return fresh[0] ?? leader;
}

function main(): void {
  header('1. CP during a partition (west {A,C} | east {B})');
  let cluster = makeCluster();
  const [a, , b] = cluster;
  console.log('healthy  +pen :', cpWrite(cluster, a, 'pen', false));
  console.log('split    +mug :', cpWrite(cluster, a, 'mug', true));
  console.log('split    +lamp:', cpWrite(cluster, b, 'lamp', true));
  console.log('B after split :', [...b.cart].join(', '), '(stale, but never wrong: it refuses strong reads)');

  header('2. AP during the same partition');
  cluster = makeCluster();
  const [a2, c2, b2] = cluster;
  apWrite(cluster, a2, 'lamp');
  apWrite(cluster, b2, 'fan');
  for (const n of cluster) console.log(`${n.name}: cart=[${[...n.cart].join(', ')}] clock=${JSON.stringify(n.clock)}`);
  const rel = compare(a2.clock, b2.clock);
  console.log(`A vs B clocks → ${rel}${rel === 'concurrent' ? ' (neither saw the other: a real conflict)' : ''}`);

  header('2b. Heal: last-write-wins vs union merge');
  const lww = b2.clock.B ? b2.cart : a2.cart; // pretend B's wall clock was later
  console.log('LWW keeps     :', [...lww].join(', '), '→ the lamp is silently lost');
  const merged = new Set([...a2.cart, ...b2.cart]);
  for (const n of [a2, c2, b2]) { n.cart = new Set(merged); n.clock = { A: 1, B: 1 }; }
  console.log('Union merge   :', [...merged].join(', '), '→ nothing lost (this is what an OR-set CRDT does)');

  header('3. PACELC on a healthy day: latency vs consistency');
  const leader: Replica = { name: 'leader (Mumbai)', appliedLsn: 7, latencyMs: 120 };
  const replicas: Replica[] = [
    { name: 'replica-1 (local)', appliedLsn: 6, latencyMs: 1 },
    { name: 'replica-2 (local)', appliedLsn: 7, latencyMs: 2 },
  ];
  const eventual = routeRead(replicas, leader, 0);
  console.log(`eventual read      → ${eventual.name}, ${eventual.latencyMs} ms (EL: fast, maybe stale)`);
  console.log(`strong read        → ${leader.name}, ${leader.latencyMs} ms (EC: always fresh, pays the RTT)`);

  header('4. Read-your-writes: the user just wrote at lsn 7');
  const ryw = routeRead(replicas, leader, 7);
  console.log(`minLsn=7           → ${ryw.name}, ${ryw.latencyMs} ms (replica-1 skipped: lsn 6 < 7)`);
  replicas[1].appliedLsn = 6; // replica-2 falls behind too
  const fallback = routeRead(replicas, leader, 7);
  console.log(`all replicas behind→ ${fallback.name}, ${fallback.latencyMs} ms (fallback to leader)`);

  header('Takeaway');
  console.log('CP: minority refuses, nothing to merge. AP: everyone answers, merge later.');
  console.log('Session guarantees (read-your-writes) fix visible glitches without making every read strong.');
}

main();
