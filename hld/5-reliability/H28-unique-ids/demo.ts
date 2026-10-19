// H28 · Unique IDs: a Snowflake generator on a fake clock, decode, overflow, clock-backwards guard,
// the JS Number trap, and base62 short codes from a range allocator.
// Run: npx tsx hld/5-reliability/H28-unique-ids/demo.ts
export {};

const EPOCH = 1704067200000n; // 2024-01-01T00:00:00Z

class FakeClock {
  constructor(public ms: bigint) {}
  now = (): bigint => this.ms;
}

class Snowflake {
  private lastMs = -1n;
  private seq = 0n;
  waits = 0;
  constructor(private worker: bigint, private clock: FakeClock) {
    if (worker < 0n || worker > 1023n) throw new Error('worker id must fit in 10 bits');
  }
  next(): bigint {
    let now = this.clock.now();
    if (now < this.lastMs) throw new Error(`clock moved back ${this.lastMs - now} ms: refusing`);
    if (now === this.lastMs) {
      this.seq = (this.seq + 1n) & 4095n;
      if (this.seq === 0n) {
        // Real code spins on Date.now(). Here we advance the fake clock to the next ms.
        this.waits++;
        this.clock.ms += 1n;
        now = this.clock.now();
      }
    } else this.seq = 0n;
    this.lastMs = now;
    return ((now - EPOCH) << 22n) | (this.worker << 12n) | this.seq;
  }
}

function decode(id: bigint): { time: string; worker: bigint; seq: bigint } {
  const ms = (id >> 22n) + EPOCH;
  return { time: new Date(Number(ms)).toISOString(), worker: (id >> 12n) & 1023n, seq: id & 4095n };
}

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
function toBase62(n: bigint): string {
  let s = '';
  do { s = ALPHABET[Number(n % 62n)] + s; n /= 62n; } while (n > 0n);
  return s;
}
function fromBase62(s: string): bigint {
  return [...s].reduce((acc, ch) => acc * 62n + BigInt(ALPHABET.indexOf(ch)), 0n);
}

// Leases blocks of ids from a shared counter (a DB row or Redis INCRBY in real life).
class RangeAllocator {
  private next = 0n;
  private end = -1n;
  dbCalls = 0;
  constructor(private shared: { counter: bigint }, private block = 1000n) {}
  take(): bigint {
    if (this.next > this.end) {
      this.dbCalls++;
      const start = this.shared.counter + 1n;
      this.shared.counter += this.block; // atomic UPDATE ... SET counter = counter + 1000 RETURNING
      this.next = start;
      this.end = start + this.block - 1n;
    }
    return this.next++;
  }
}

function main(): void {
  const clock = new FakeClock(BigInt(Date.UTC(2026, 9, 19, 10, 0, 0)));
  const gen7 = new Snowflake(7n, clock);
  const gen8 = new Snowflake(8n, clock);

  console.log('\n== 1. Two workers, same millisecond: unique and time-ordered ==');
  const ids = [gen7.next(), gen7.next(), gen8.next()];
  clock.ms += 1n;
  ids.push(gen7.next());
  for (const id of ids) {
    const d = decode(id);
    console.log(`${id}  -> ${d.time}  worker ${d.worker}  seq ${d.seq}`);
  }
  console.log('sorted by value == sorted by time?', ids.every((v, i) => i === 0 || v > ids[i - 1] || decode(v).time === decode(ids[i - 1]).time));

  console.log('\n== 2. Burst: 6,000 ids in one millisecond on one worker ==');
  const burst = new Snowflake(3n, clock);
  const startMs = clock.ms;
  const set = new Set<bigint>();
  for (let i = 0; i < 6000; i++) set.add(burst.next());
  console.log(`unique ids: ${set.size}, generator waited for the next ms ${burst.waits} time(s), clock moved ${clock.ms - startMs} ms`);

  console.log('\n== 3. NTP steps the clock back 5 ms ==');
  clock.ms -= 5n;
  try { gen7.next(); } catch (e) { console.log('error:', (e as Error).message); }
  clock.ms += 6n;
  console.log('after the clock catches up:', gen7.next().toString());

  console.log('\n== 4. The JavaScript Number trap ==');
  const id = ids[1];
  const json = `{"id": ${id}}`;
  const parsed = JSON.parse(json) as { id: number };
  console.log('sent      ', id.toString());
  console.log('parsed    ', BigInt(parsed.id).toString(), BigInt(parsed.id) === id ? '(same)' : '(WRONG: rounded)');
  console.log('MAX_SAFE  ', Number.MAX_SAFE_INTEGER, '-> send ids as strings: {"id": "' + id + '"}');

  console.log('\n== 5. Short codes: range allocator + base62 ==');
  const shared = { counter: 2_000_000_000n };
  const podA = new RangeAllocator(shared), podB = new RangeAllocator(shared);
  const codes: string[] = [];
  for (let i = 0; i < 2500; i++) {
    const n = (i % 2 === 0 ? podA : podB).take();
    if (i < 4) codes.push(`${n} -> ${toBase62(n)}`);
  }
  console.log(codes.join('\n'));
  console.log(`2,500 codes, DB calls: pod A ${podA.dbCalls}, pod B ${podB.dbCalls}; round trip ok: ${fromBase62(toBase62(2_000_000_123n)) === 2_000_000_123n}`);
  console.log(`7 chars cover ${(62 ** 7).toExponential(2)} codes; a 64-bit Snowflake needs ${toBase62(ids[0]).length} chars (${toBase62(ids[0])})`);
}

main();
