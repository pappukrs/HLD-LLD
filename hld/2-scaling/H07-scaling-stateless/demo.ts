// H07 · Why stateful servers break when you scale out, and what fixes them.
// Run: npx tsx hld/2-scaling/H07-scaling-stateless/demo.ts
import { randomUUID } from 'node:crypto';

type Session = { userId: string };
interface SessionStore { get(sid: string): Session | undefined; set(sid: string, s: Session): void }

class LocalStore implements SessionStore {          // a Map inside ONE process
  private m = new Map<string, Session>();
  get(sid: string) { return this.m.get(sid); }
  set(sid: string, s: Session) { this.m.set(sid, s); }
}
const redisLike = new LocalStore();                 // one shared instance = "Redis"

class AppServer {
  constructor(readonly name: string, private store: SessionStore) {}
  login(user: string) { const sid = randomUUID(); this.store.set(sid, { userId: user }); return sid; }
  me(sid: string) { return this.store.get(sid)?.userId ?? null; }
}

class RoundRobinLB {
  private i = 0;
  constructor(private servers: AppServer[]) {}
  next() { return this.servers[this.i++ % this.servers.length]; }
}

function trial(label: string, servers: AppServer[]) {
  const lb = new RoundRobinLB(servers);
  const sid = lb.next().login('pappu');
  let ok = 0;
  const trace: string[] = [];
  for (let r = 0; r < 9; r++) {
    const s = lb.next();
    const who = s.me(sid);
    if (who) ok++;
    trace.push(`${s.name}:${who ? 'ok' : '401'}`);
  }
  console.log(`${label}\n  ${trace.join('  ')}\n  → ${ok}/9 requests still logged in`);
}

// ---- Cron: setInterval in every instance vs one lock ----
const locks = new Map<string, string>();
function setNX(key: string, owner: string) { if (locks.has(key)) return false; locks.set(key, owner); return true; }

function main() {
  console.log('\n== 1. Sessions in each server\'s memory, 3 servers behind round robin ==');
  trial('in-memory sessions:', ['app1', 'app2', 'app3'].map((n) => new AppServer(n, new LocalStore())));

  console.log('\n== 2. Same servers, sessions in one shared store (Redis) ==');
  trial('shared session store:', ['app1', 'app2', 'app3'].map((n) => new AppServer(n, redisLike)));

  console.log('\n== 3. Daily digest job with 3 instances ==');
  let sent = 0;
  for (const inst of ['app1', 'app2', 'app3']) sent++; // each instance's setInterval fires
  console.log(`  setInterval in every instance → digest email sent ${sent} times`);
  sent = 0;
  for (const inst of ['app1', 'app2', 'app3']) {
    if (setNX('lock:digest:2026-10-19', inst)) { sent++; console.log(`  ${inst} won the lock and sends the digest`); }
    else console.log(`  ${inst} skips (lock held by ${locks.get('lock:digest:2026-10-19')})`);
  }
  console.log(`  with SET NX lock → sent ${sent} time`);

  console.log('\n== 4. Rate limit 100/min kept in memory, 3 instances ==');
  const counters = [0, 0, 0];
  let allowed = 0;
  for (let i = 0; i < 300; i++) { const k = i % 3; if (counters[k] < 100) { counters[k]++; allowed++; } }
  console.log(`  user sent 300, allowed ${allowed} (limit silently became 3x). Fix: one counter in Redis.`);

  console.log('\n== 5. Up vs out: same 64 vCPU, very different failure and growth story ==');
  const pricePerVcpuMonth = 36; // illustrative cloud price; roughly linear inside one instance family
  console.log(`  1 × 64 vCPU : $${(64 * pricePerVcpuMonth).toLocaleString()} / month, 1 failure = 100% down, next step = no bigger box`);
  console.log(`  16 × 4 vCPU : $${(16 * 4 * pricePerVcpuMonth).toLocaleString()} / month, 1 failure = ${Math.round(100 / 16)}% capacity lost, next step = add 1 box`);
  console.log(`  at night (load / 4): big box still $${(64 * pricePerVcpuMonth).toLocaleString()}; autoscaled fleet ~$${(4 * 4 * pricePerVcpuMonth).toLocaleString()}`);

  console.log('\n== 6. Scaling out moves the bottleneck to the database ==');
  for (const instances of [5, 20, 100]) {
    const conns = instances * 20;
    const verdict = conns <= 300 ? 'fine' : conns <= 1000 ? 'risky' : 'too many: add PgBouncer, cap autoscaling';
    console.log(`  ${String(instances).padStart(3)} instances × pool 20 = ${String(conns).padStart(4)} DB connections → ${verdict}`);
  }

  console.log('\n== 7. Autoscaling by target tracking (keep CPU near 60%) ==');
  let pods = 3;
  for (const rps of [600, 1500, 3200, 1200]) {
    const perPodCapacity = 400;                                  // rps a pod handles at 100% CPU
    const want = Math.max(3, Math.ceil(rps / (perPodCapacity * 0.6)));
    console.log(`  load ${String(rps).padStart(4)} rps → CPU at ${pods} pods = ${Math.round((rps / (pods * perPodCapacity)) * 100)}% → scale to ${want} pods`);
    pods = want;
  }
}

main();
