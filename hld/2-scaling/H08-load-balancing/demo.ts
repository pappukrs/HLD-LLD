// H08 · Load balancing algorithms under uneven work, health checks, and hash % N stickiness.
// Run: npx tsx hld/2-scaling/H08-load-balancing/demo.ts
import { createHash } from 'node:crypto';

// Small seeded RNG so every run prints the same numbers.
function rng(seed: number) {
  let x = seed >>> 0;
  return () => ((x = (Math.imul(x, 1664525) + 1013904223) >>> 0) / 2 ** 32);
}

type Server = { id: string; slowFactor: number; inflight: number[]; peak: number; served: number };
type Picker = (servers: Server[], rand: () => number) => Server;

let rrIdx = 0;
const algos: Record<string, Picker> = {
  'round robin': (s) => s[rrIdx++ % s.length],
  random: (s, r) => s[Math.floor(r() * s.length)],
  'least connections': (s) => s.reduce((a, b) => (b.inflight.length < a.inflight.length ? b : a)),
  'power of two': (s, r) => {
    const a = s[Math.floor(r() * s.length)], b = s[Math.floor(r() * s.length)];
    return b.inflight.length < a.inflight.length ? b : a;
  },
};

// 400 ticks, 5 requests per tick. 85% take 2 ticks, 15% are slow reports taking 20 ticks.
// s3 is an older box: everything takes it twice as long.
function simulate(name: string, pick: Picker) {
  rrIdx = 0;
  const r = rng(42);
  const servers: Server[] = ['s1', 's2', 's3', 's4', 's5'].map((id) => ({ id, slowFactor: id === 's3' ? 2 : 1, inflight: [], peak: 0, served: 0 }));
  let latencySum = 0, count = 0;
  for (let t = 0; t < 400; t++) {
    for (const s of servers) s.inflight = s.inflight.filter((end) => end > t); // finished work leaves
    for (let k = 0; k < 5; k++) {
      const base = r() < 0.15 ? 20 : 2;
      const s = pick(servers, r);
      // Work queues behind what is already running: a crude "more in flight = slower" model.
      const dur = base * s.slowFactor * (1 + s.inflight.length * 0.1);
      s.inflight.push(t + dur);
      s.served++;
      s.peak = Math.max(s.peak, s.inflight.length);
      latencySum += dur; count++;
    }
  }
  const worst = servers.reduce((a, b) => (b.peak > a.peak ? b : a));
  const shares = servers.map((s) => `${s.id}:${s.served}`).join(' ');
  console.log(`${name.padEnd(18)} avg latency ${(latencySum / count).toFixed(1).padStart(5)} ticks | worst peak in-flight ${String(worst.peak).padStart(3)} on ${worst.id} | ${shares}`);
}

const h = (s: string) => parseInt(createHash('md5').update(s).digest('hex').slice(0, 8), 16);

function main() {
  console.log('\n== 1. 2,000 requests, mixed fast/slow work, s3 is 2x slower ==');
  for (const [name, pick] of Object.entries(algos)) simulate(name, pick);
  console.log('Round robin and random keep feeding the slow box; least-conn and power-of-two steer away from it.');

  console.log('\n== 2. Health check timing ==');
  for (const [interval, threshold] of [[5, 3], [10, 3], [2, 2]] as const) {
    const detect = interval * threshold;
    const rps = 1000, share = 1 / 5;
    console.log(`  every ${String(interval).padStart(2)} s, ${threshold} failures → removed after ~${detect} s → ~${Math.round(detect * rps * share).toLocaleString()} failed requests at 1k rps over 5 servers (unless retried)`);
  }

  console.log('\n== 3. Sticky by hash(ip) % N: add one server ==');
  const clients = Array.from({ length: 10_000 }, (_, i) => `10.0.${i >> 8}.${i & 255}`);
  for (const [from, to] of [[4, 5], [10, 11]] as const) {
    const moved = clients.filter((ip) => h(ip) % from !== h(ip) % to).length;
    console.log(`  ${from} → ${to} servers: ${((moved / clients.length) * 100).toFixed(0)}% of clients land on a new server (lose in-memory session)`);
  }
  console.log('  with consistent hashing only ~1/(N+1) move: ~20% for 4→5, ~9% for 10→11');

  console.log('\n== 4. gRPC over one HTTP/2 connection behind an L4 LB ==');
  const pods = Array(10).fill(0);
  const connPod = 3; // the single long-lived connection landed here
  for (let i = 0; i < 10_000; i++) pods[connPod]++;
  console.log(`  L4 (per connection): ${pods.map((n) => n).join(' ')}`);
  const l7 = Array(10).fill(0);
  for (let i = 0; i < 10_000; i++) l7[i % 10]++;
  console.log(`  L7 (per request)   : ${l7.join(' ')}`);
}

main();
