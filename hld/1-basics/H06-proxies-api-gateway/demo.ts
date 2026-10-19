// H06 · A tiny API gateway: middleware pipeline that can stop a request early.
// Run: npx tsx hld/1-basics/H06-proxies-api-gateway/demo.ts
import { createHmac, randomUUID } from 'node:crypto';

type Ctx = {
  method: string; path: string; ip: string;
  headers: Record<string, string>;
  userId?: string; status?: number; body?: string; trail: string[];
};
type Mw = (c: Ctx, next: () => Promise<void>) => Promise<void>;

function compose(mws: Mw[]) {
  return (c: Ctx) => {
    const run = (i: number): Promise<void> => (i < mws.length ? mws[i](c, () => run(i + 1)) : Promise.resolve());
    return run(0);
  };
}

// ---- A toy signed token (HMAC), verified locally: no call to the auth service ----
const SECRET = 'gateway-demo-secret';
const sign = (sub: string, exp: number) => {
  const payload = Buffer.from(JSON.stringify({ sub, exp })).toString('base64url');
  return `${payload}.${createHmac('sha256', SECRET).update(payload).digest('base64url')}`;
};
function verify(token: string | undefined, now: number): { sub: string } | null {
  if (!token) return null;
  const [payload, sig] = token.replace('Bearer ', '').split('.');
  if (createHmac('sha256', SECRET).update(payload).digest('base64url') !== sig) return null;
  const claims = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { sub: string; exp: number };
  return claims.exp > now ? { sub: claims.sub } : null;
}

// ---- Middleware ----
const tls: Mw = async (c, next) => { c.trail.push('tls'); await next(); };
const requestId: Mw = async (c, next) => {
  c.headers['x-request-id'] = randomUUID().slice(0, 8);
  c.headers['x-forwarded-for'] = c.ip;
  c.trail.push('req-id'); await next();
};
const auth: Mw = async (c, next) => {
  c.trail.push('auth');
  const user = verify(c.headers.authorization, 1_000);
  if (!user) { c.status = 401; c.body = 'invalid or missing token'; return; }
  c.userId = user.sub; await next();
};
const buckets = new Map<string, number>(); // shared store in real life (Redis), not per-instance memory
const rateLimit = (perWindow: number): Mw => async (c, next) => {
  c.trail.push('rate-limit');
  const used = (buckets.get(c.userId!) ?? 0) + 1;
  buckets.set(c.userId!, used);
  if (used > perWindow) { c.status = 429; c.body = `limit ${perWindow}/window, Retry-After: 30`; return; }
  await next();
};

type Upstream = { prefix: string; name: string; handle: (c: Ctx) => { status: number; body: string } };
const routes: Upstream[] = [
  { prefix: '/v1/orders', name: 'order-svc:3001', handle: (c) => ({ status: 200, body: `orders of ${c.userId}` }) },
  { prefix: '/v1/payments', name: 'payment-svc:3002', handle: (c) => ({ status: 201, body: `payment by ${c.userId}` }) },
];
const route: Mw = async (c) => {
  c.trail.push('route');
  const up = routes.find((r) => c.path.startsWith(r.prefix));
  if (!up) { c.status = 404; c.body = 'no route'; return; }
  c.trail.push(`→ ${up.name}`);
  const res = up.handle(c);
  c.status = res.status; c.body = res.body;
};

const gateway = compose([tls, requestId, auth, rateLimit(3), route]);

async function send(label: string, method: string, path: string, token?: string) {
  const c: Ctx = { method, path, ip: '49.36.10.7', headers: token ? { authorization: `Bearer ${token}` } : {}, trail: [] };
  await gateway(c);
  console.log(`${label.padEnd(26)} ${method.padEnd(4)} ${path.padEnd(16)} → ${c.status} ${c.body}`);
  console.log(`${''.padEnd(26)} path: ${c.trail.join(' > ')}   req-id=${c.headers['x-request-id']}`);
}

async function main() {
  const good = sign('user-7', 5_000);
  const expired = sign('user-7', 500);
  const forged = good.slice(0, -3) + 'abc';

  console.log('\n== Requests through the gateway (limit: 3 per window per user) ==');
  await send('no token', 'GET', '/v1/orders');
  await send('forged signature', 'GET', '/v1/orders', forged);
  await send('expired token', 'GET', '/v1/orders', expired);
  await send('valid', 'GET', '/v1/orders', good);
  await send('valid', 'POST', '/v1/payments', good);
  await send('unknown route', 'GET', '/v1/admin', good);
  await send('burst: 4th in window', 'GET', '/v1/orders', good);
  console.log('Note: the 401s and the 429 never reached a backend service.');

  console.log('\n== Why counters must be shared: 4 gateway instances, each with its own memory ==');
  const perInstance = [0, 0, 0, 0];
  let allowed = 0;
  for (let i = 0; i < 400; i++) {
    const inst = i % 4; // round-robin LB in front of the gateways
    if (perInstance[inst] < 100) { perInstance[inst]++; allowed++; }
  }
  console.log(`limit 100/min per user, local counters → user actually got ${allowed} (4x)`);
  console.log('fix: one counter in Redis (atomic INCR or Lua), or hash each user to one instance');

  console.log('\n== Forward vs reverse proxy: who does the server see? ==');
  console.log('forward : laptop 10.0.0.5 → corp-proxy 52.1.1.1 → example.com     server sees 52.1.1.1 (client hidden)');
  console.log('reverse : phone 49.36.10.7 → nginx 13.2.2.2 → app 10.1.0.12        client sees 13.2.2.2 (servers hidden)');
  console.log('          app reads the real client from X-Forwarded-For: 49.36.10.7');
}

main();
