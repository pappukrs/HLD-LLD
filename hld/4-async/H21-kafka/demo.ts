// H21 · Kafka deep dive
// Run: npx tsx hld/4-async/H21-kafka/demo.ts
// A tiny in-memory Kafka: keyed partitioning, a consumer group with rebalance,
// at-least-once replay after a crash, consumer lag, acks/ISR outcomes and log compaction.
export {};

type Msg = { offset: number; key: string; value: string | null };

class Topic {
  readonly parts: Msg[][];
  constructor(readonly name: string, partitions: number) {
    this.parts = Array.from({ length: partitions }, () => []);
  }
  // Stand-in for murmur2(key) % P: a stable string hash.
  partitionFor(key: string): number {
    let h = 0x811c9dc5; // FNV-1a
    for (const ch of key) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
    return h % this.parts.length;
  }
  produce(key: string, value: string | null): [number, number] {
    const p = this.partitionFor(key);
    const offset = this.parts[p].length;
    this.parts[p].push({ offset, key, value });
    return [p, offset];
  }
}

class ConsumerGroup {
  committed = new Map<number, number>(); // partition → next offset to read
  owners = new Map<number, string>();
  processedCount = new Map<string, number>(); // event id → times processed
  constructor(readonly name: string, readonly topic: Topic) {}

  rebalance(members: string[]): void {
    this.owners.clear();
    this.topic.parts.forEach((_, p) => { if (members.length) this.owners.set(p, members[p % members.length]); });
    const idle = members.filter((m) => ![...this.owners.values()].includes(m));
    const view = [...this.owners].map(([p, c]) => `P${p}→${c}`).join(' ');
    console.log(`  rebalance [${members.join(',')}]: ${view}${idle.length ? `  idle: ${idle.join(',')}` : ''}`);
  }

  // Process up to `max` messages of partition p; commit only if `commit` is true.
  poll(p: number, max: number, commit: boolean): void {
    const from = this.committed.get(p) ?? 0;
    const batch = this.topic.parts[p].slice(from, from + max);
    for (const m of batch) {
      const id = `${p}:${m.offset}`;
      this.processedCount.set(id, (this.processedCount.get(id) ?? 0) + 1);
    }
    const label = batch.map((m) => m.offset).join(',') || '-';
    if (commit && batch.length) this.committed.set(p, from + batch.length);
    console.log(`  ${this.owners.get(p)} P${p} processed offsets [${label}] commit=${commit ? this.committed.get(p) ?? 0 : 'skipped'}`);
  }

  lag(): string {
    return this.topic.parts.map((log, p) => `P${p}=${log.length - (this.committed.get(p) ?? 0)}`).join(' ');
  }
}

function writeOutcome(rf: number, minIsr: number, acks: '0' | '1' | 'all', down: number): string {
  const alive = rf - down;
  if (alive <= 0) return 'partition offline';
  if (acks === 'all' && alive < minIsr) return 'REJECTED NotEnoughReplicas (no data loss)';
  if (acks === 'all') return `ok, every ack = ${Math.max(minIsr, 1)}+ copies`;
  if (acks === '1') return 'ok, but lost if the leader dies before followers copy';
  return 'ok?, producer never knows (fire and forget)';
}

function compact(log: Msg[]): Msg[] {
  const latest = new Map<string, Msg>();
  for (const m of log) latest.set(m.key, m);
  return [...latest.values()].filter((m) => m.value !== null).sort((a, b) => a.offset - b.offset);
}

function main(): void {
  console.log('=== 1. The key picks the partition (P=3) ===');
  const topic = new Topic('payments.events', 3);
  const events: [string, string][] = [
    ['pay_17', 'created'], ['pay_42', 'created'], ['pay_17', 'authorized'],
    ['pay_99', 'created'], ['pay_17', 'captured'], ['pay_42', 'failed'],
  ];
  for (const [k, v] of events) {
    const [p, o] = topic.produce(k, v);
    console.log(`  ${k.padEnd(7)} ${v.padEnd(10)} → P${p} @${o}`);
  }
  const p17 = topic.partitionFor('pay_17');
  console.log(`  pay_17 history in P${p17}: ${topic.parts[p17].filter((m) => m.key === 'pay_17').map((m) => m.value).join(' → ')} (in order)`);

  console.log('\n=== 2. Consumer group "ledger": partitions cap parallelism ===');
  const ledger = new ConsumerGroup('ledger', topic);
  ledger.rebalance(['c1', 'c2']);
  ledger.rebalance(['c1', 'c2', 'c3', 'c4']);

  console.log('\n=== 3. Process then commit = at-least-once ===');
  for (let p = 0; p < 3; p++) ledger.poll(p, 1, true);
  const hot = p17;
  ledger.poll(hot, 10, false); // processed but crashed before commit
  console.log(`  ${ledger.owners.get(hot)} crashes before committing P${hot}`);
  ledger.rebalance(['c1', 'c2', 'c3', 'c4'].filter((c) => c !== ledger.owners.get(hot)));
  ledger.poll(hot, 10, true);
  const dups = [...ledger.processedCount].filter(([, n]) => n > 1).map(([id]) => id);
  console.log(`  processed twice: ${dups.join(', ') || 'none'} → handlers must be idempotent`);

  console.log('\n=== 4. Lag = log end − committed ===');
  for (let i = 0; i < 5; i++) topic.produce('pay_99', `refund_${i}`);
  console.log(`  after a burst: ${ledger.lag()}`);
  for (let p = 0; p < 3; p++) ledger.poll(p, 100, true);
  console.log(`  after catching up: ${ledger.lag()}`);

  console.log('\n=== 5. A second group replays from offset 0, independently ===');
  const analytics = new ConsumerGroup('analytics', topic);
  analytics.rebalance(['a1']);
  console.log(`  analytics lag before reading: ${analytics.lag()} (ledger: ${ledger.lag()})`);

  console.log('\n=== 6. acks and ISR (RF=3) ===');
  const cases: [number, '0' | '1' | 'all', number][] = [[2, 'all', 0], [2, 'all', 1], [2, 'all', 2], [1, 'all', 2], [2, '1', 1]];
  for (const [isr, acks, down] of cases) {
    console.log(`  min.insync=${isr} acks=${acks.padEnd(3)} down=${down}: ${writeOutcome(3, isr, acks, down)}`);
  }

  console.log('\n=== 7. Compaction keeps the latest value per key ===');
  const state: Msg[] = [
    { offset: 0, key: 'acct_1', value: 'bal=100' }, { offset: 1, key: 'acct_2', value: 'bal=50' },
    { offset: 2, key: 'acct_1', value: 'bal=80' }, { offset: 3, key: 'acct_3', value: 'bal=10' },
    { offset: 4, key: 'acct_3', value: null }, // tombstone: delete acct_3
  ];
  console.log(`  before: ${state.length} records`);
  console.log(`  after : ${compact(state).map((m) => `${m.key}=${m.value}@${m.offset}`).join('  ')}`);
}

main();
