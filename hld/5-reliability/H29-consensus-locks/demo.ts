// H29 · Consensus and locks: majority math, a Raft-style election with the vote rules,
// and the GC-pause lock scenario with and without fencing tokens.
// Run: npx tsx hld/5-reliability/H29-consensus-locks/demo.ts
export {};

function majorityTable(): void {
  console.log('\n== 1. Majority math ==');
  for (const n of [1, 2, 3, 4, 5, 6, 7]) {
    const majority = Math.floor(n / 2) + 1;
    console.log(`${n} nodes: majority ${majority}, tolerates ${n - majority} failure(s)${n % 2 === 0 ? '  <- even size adds nothing' : ''}`);
  }
}

// ---- Raft-style election: one vote per term, only for logs at least as up to date.
type Entry = { term: number; cmd: string };
class RaftNode {
  term = 1;
  votedFor: string | null = null;
  up = true;
  constructor(public id: string, public log: Entry[]) {}
  lastTerm(): number { return this.log.length ? this.log[this.log.length - 1].term : 0; }
  requestVote(candidate: string, term: number, lastTerm: number, lastIndex: number): { granted: boolean; why: string } {
    if (!this.up) return { granted: false, why: 'down' };
    if (term < this.term) return { granted: false, why: `my term ${this.term} is higher` };
    if (term > this.term) { this.term = term; this.votedFor = null; }
    if (this.votedFor && this.votedFor !== candidate) return { granted: false, why: `already voted for ${this.votedFor}` };
    const upToDate = lastTerm > this.lastTerm() || (lastTerm === this.lastTerm() && lastIndex >= this.log.length);
    if (!upToDate) return { granted: false, why: `my log (t${this.lastTerm()} #${this.log.length}) is newer` };
    this.votedFor = candidate;
    return { granted: true, why: 'ok' };
  }
}

function election(nodes: RaftNode[], candidateId: string): boolean {
  const c = nodes.find((n) => n.id === candidateId)!;
  c.term += 1;
  c.votedFor = c.id;
  let votes = 1;
  const lines: string[] = [];
  for (const n of nodes) {
    if (n === c) continue;
    const r = n.requestVote(c.id, c.term, c.lastTerm(), c.log.length);
    if (r.granted) votes++;
    lines.push(`${n.id}:${r.granted ? 'yes' : 'no (' + r.why + ')'}`);
  }
  const won = votes >= Math.floor(nodes.length / 2) + 1;
  console.log(`${c.id} runs for term ${c.term} (log t${c.lastTerm()} #${c.log.length}) -> ${lines.join(', ')} -> ${votes}/${nodes.length} ${won ? 'LEADER' : 'lost'}`);
  return won;
}

function raft(): void {
  console.log('\n== 2. Elections with the "log at least as new" rule ==');
  const base: Entry[] = [{ term: 1, cmd: 'x=1' }];
  const withX5: Entry[] = [...base, { term: 2, cmd: 'x=5' }];
  // x=5 was committed on S1, S2, S3 (a majority). S4, S5 missed it.
  const nodes = [
    new RaftNode('S1', [...withX5]), new RaftNode('S2', [...withX5]), new RaftNode('S3', [...withX5]),
    new RaftNode('S4', [...base]), new RaftNode('S5', [...base]),
  ];
  nodes.forEach((n) => (n.term = 2));
  nodes[2].up = false;
  console.log('S3 (the term-2 leader) crashed. Committed x=5 lives on S1, S2 (and dead S3).');
  election(nodes, 'S5');
  election(nodes, 'S1');
  console.log('A node missing committed data can never win: any majority includes someone who has it.');

  console.log('\nPartition: {S1, S2} | {S3, S4, S5}');
  const minority = nodes.slice(0, 2).length, majority = 3;
  console.log(`minority side has ${minority} of 5 -> cannot elect or commit; majority side has ${majority} -> keeps working`);
}

// ---- Locks with leases and fencing tokens on a virtual clock.
class LockService {
  private holder: string | null = null;
  private expiresAt = 0;
  private token = 32;
  acquire(who: string, now: number, ttlMs: number): number | null {
    if (this.holder && now < this.expiresAt) return null;
    this.holder = who;
    this.expiresAt = now + ttlMs;
    return ++this.token;
  }
}

class PayoutsTable {
  private maxToken = 0;
  paidBy: string[] = [];
  constructor(private checkTokens: boolean) {}
  pay(batch: string, who: string, token: number): string {
    if (this.checkTokens && token < this.maxToken) return `REJECTED (token ${token} < ${this.maxToken})`;
    this.maxToken = Math.max(this.maxToken, token);
    this.paidBy.push(who);
    return `paid ${batch} (token ${token})`;
  }
}

function fencing(checkTokens: boolean): void {
  console.log(`\n-- storage token check ${checkTokens ? 'ON' : 'OFF'} --`);
  const lock = new LockService();
  const table = new PayoutsTable(checkTokens);
  const tA = lock.acquire('A', 0, 10_000)!;
  console.log(`t=0s   A acquires lock -> token ${tA}, lease 10 s`);
  console.log('t=0s   A starts a 15 s GC pause before writing');
  console.log(`t=5s   B tries -> ${lock.acquire('B', 5_000, 10_000) ?? 'denied (A still holds the lease)'}`);
  const tB = lock.acquire('B', 11_000, 10_000)!;
  console.log(`t=11s  A's lease expired; B acquires -> token ${tB}`);
  console.log(`t=12s  B writes: ${table.pay('batch-19', 'B', tB)}`);
  console.log(`t=15s  A wakes, still thinks it holds the lock, writes: ${table.pay('batch-19', 'A', tA)}`);
  const n = table.paidBy.length;
  console.log(`result: batch-19 paid ${n} time(s) ${n > 1 ? '<- DOUBLE PAYOUT' : '<- correct'}`);
}

function main(): void {
  majorityTable();
  raft();
  console.log('\n== 3. Lease lock + GC pause ==');
  fencing(false);
  fencing(true);
}

main();
