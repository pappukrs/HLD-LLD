// L13 · Adapter: Day 17 practice, a rewrite of the core idea on new domains.
// Run: npx tsx lld/3-structural/L13-adapter/practice.ts
// Different domains from demo.ts on purpose:
//   1. Ride Sharing ETA providers: units, coordinate order, async style, errors (self-test Q1, Q3).
//   2. A shared contract suite run against every adapter (Q6).
//   3. A fallback router that only falls through on outages (Q7), plus a decorator (Q4).
//   4. What util.promisify does and does not fix (Q2), object vs class adapter (Q5).
//   5. Mongo to SQL migration: one UserRepo port, two adapters, dual write (your experience hook).

import { promisify } from 'node:util';

export {};

// ---------- YOUR types (the target) ----------
interface LatLng { lat: number; lng: number }
interface EtaReq { from: LatLng; to: LatLng }
interface Eta { meters: number; seconds: number } // integers, one unit everywhere in the domain
interface EtaProvider { readonly name: string; eta(r: EtaReq): Promise<Eta> }

class NoRouteError extends Error { override name = 'NoRouteError'; }           // final answer
class EtaUnavailableError extends Error { override name = 'EtaUnavailableError'; } // try another provider

// ---------- a fake road network shared by the three SDKs ----------
// Lat and lng are weighted differently, so an adapter that swaps them gets a wrong answer.
const ISLAND: LatLng = { lat: 20, lng: 20 };
const road = (aLat: number, aLng: number, bLat: number, bLng: number) => {
  const metres = 1000 * Math.abs(aLat - bLat) + 100 * Math.abs(aLng - bLng);
  return { metres, secs: metres / 10 };
};
const isIsland = (lat: number, lng: number) => lat === ISLAND.lat && lng === ISLAND.lng;

// ---------- three third-party SDKs (adaptees) you cannot change ----------
class AtlasSdk { // promise, "lat,lng" strings, km and minutes as floats, throws { httpStatus }
  down = false;
  async directions(q: { origin: string; dest: string }): Promise<{ distance_km: number; duration_min: number }> {
    if (this.down) throw { httpStatus: 503 };
    const [aLat, aLng] = q.origin.split(',').map(Number);
    const [bLat, bLng] = q.dest.split(',').map(Number);
    if (isIsland(bLat, bLng)) throw { httpStatus: 404 };
    const { metres, secs } = road(aLat, aLng, bLat, bLng);
    return { distance_km: metres / 1000, duration_min: secs / 60 };
  }
}

class PathFinderSdk { // callback with a status code first, [lng, lat] pairs (GeoJSON order)
  down = false;
  route(a: [number, number], b: [number, number], cb: (code: number, res: { metres: number; secs: number } | null) => void): void {
    const { down } = this; // read before going async: a lost `this` then throws here, not in a timer
    setImmediate(() => {
      if (down) return cb(99, null);
      if (isIsland(b[1], b[0])) return cb(7, null);
      cb(0, road(a[1], a[0], b[1], b[0]));
    });
  }
}

class GeoLiteSdk { // never throws: failures hide inside a "200", and it speaks miles and hours
  down = false;
  async getEta(aLat: number, aLng: number, bLat: number, bLng: number):
    Promise<{ status: 'OK' | 'ZERO_RESULTS' | 'OVER_QUERY_LIMIT'; leg?: { miles: number; hours: number } }> {
    if (this.down) return { status: 'OVER_QUERY_LIMIT' };
    if (isIsland(bLat, bLng)) return { status: 'ZERO_RESULTS' };
    const { metres, secs } = road(aLat, aLng, bLat, bLng);
    return { status: 'OK', leg: { miles: metres / 1609.344, hours: secs / 3600 } };
  }
}

// ---------- adapters: one per adaptee ----------
class AtlasAdapter implements EtaProvider {
  readonly name = 'Atlas';
  constructor(private sdk: AtlasSdk) {}
  async eta(r: EtaReq): Promise<Eta> {
    try {
      const d = await this.sdk.directions({ origin: `${r.from.lat},${r.from.lng}`, dest: `${r.to.lat},${r.to.lng}` });
      return { meters: Math.round(d.distance_km * 1000), seconds: Math.round(d.duration_min * 60) };
    } catch (e) {
      const status = (e as { httpStatus?: number }).httpStatus;
      if (status === 404) throw new NoRouteError(`Atlas: ${status}`);
      throw new EtaUnavailableError(`Atlas: ${status ?? 'unknown'}`);
    }
  }
}

class PathFinderAdapter implements EtaProvider {
  readonly name = 'PathFinder';
  constructor(private sdk: PathFinderSdk) {}
  eta(r: EtaReq): Promise<Eta> {
    return new Promise((ok, fail) =>
      this.sdk.route([r.from.lng, r.from.lat], [r.to.lng, r.to.lat], (code, res) => {
        if (code === 0 && res) return ok({ meters: Math.round(res.metres), seconds: Math.round(res.secs) });
        // Only code 7 is a final answer. An unknown code must not be read as "no route",
        // or the fallback router would stop during an outage.
        fail(code === 7 ? new NoRouteError('PathFinder: 7') : new EtaUnavailableError(`PathFinder: ${code}`));
      }),
    );
  }
}

class GeoLiteAdapter implements EtaProvider {
  readonly name = 'GeoLite';
  constructor(private sdk: GeoLiteSdk) {}
  async eta(r: EtaReq): Promise<Eta> {
    const res = await this.sdk.getEta(r.from.lat, r.from.lng, r.to.lat, r.to.lng);
    if (res.status === 'ZERO_RESULTS') throw new NoRouteError('GeoLite: ZERO_RESULTS');
    if (res.status !== 'OK' || !res.leg) throw new EtaUnavailableError(`GeoLite: ${res.status}`);
    return { meters: Math.round(res.leg.miles * 1609.344), seconds: Math.round(res.leg.hours * 3600) };
  }
}

// ---------- same interface, so these wrap any adapter ----------
class FallbackEta implements EtaProvider {
  readonly name = 'Fallback';
  constructor(private chain: EtaProvider[]) {}
  async eta(r: EtaReq): Promise<Eta> {
    for (const p of this.chain) {
      try { return await p.eta(r); } catch (e) {
        if (!(e instanceof EtaUnavailableError)) throw e; // "no route" is final
      }
    }
    throw new EtaUnavailableError('all providers down');
  }
}

class CountingEta implements EtaProvider { // Decorator: same interface, adds behaviour (Q4)
  calls = 0;
  constructor(private inner: EtaProvider) {}
  get name() { return this.inner.name; }
  eta(r: EtaReq) { this.calls++; return this.inner.eta(r); }
}

// Class adapter (Q5): it works, but every SDK method is now public on the adapter.
class PathFinderClassAdapter extends PathFinderSdk implements EtaProvider {
  readonly name = 'PathFinderClass';
  eta(r: EtaReq): Promise<Eta> {
    return new PathFinderAdapter(this).eta(r);
  }
}

// ---------- 5. Migration: one repository port, two storage adapters ----------
interface User { id: string; email: string; city: string }
interface UserRepo { save(u: User): Promise<void>; find(id: string): Promise<User | null> }

class MongoUsers { // nested documents, _id
  docs = new Map<string, { _id: string; contact: { email: string }; address: { city: string } }>();
}
class SqlUsers { // flat rows, snake_case
  rows = new Map<string, { user_id: string; email_addr: string; city_name: string }>();
  failNext = false;
}

class MongoUserRepo implements UserRepo {
  constructor(private db: MongoUsers) {}
  async save(u: User) { this.db.docs.set(u.id, { _id: u.id, contact: { email: u.email }, address: { city: u.city } }); }
  async find(id: string) {
    const d = this.db.docs.get(id);
    return d ? { id: d._id, email: d.contact.email, city: d.address.city } : null;
  }
}

class SqlUserRepo implements UserRepo {
  constructor(private db: SqlUsers) {}
  async save(u: User) {
    if (this.db.failNext) { this.db.failNext = false; throw new Error('mysql: connection lost'); }
    this.db.rows.set(u.id, { user_id: u.id, email_addr: u.email, city_name: u.city });
  }
  async find(id: string) {
    const r = this.db.rows.get(id);
    return r ? { id: r.user_id, email: r.email_addr, city: r.city_name } : null;
  }
}

// During the migration the old store stays the source of truth. A failed write to the new
// store must not fail the user's request, but it must be remembered for the backfill job.
class DualWriteRepo implements UserRepo {
  readonly missed: string[] = [];
  constructor(private primary: UserRepo, private secondary: UserRepo) {}
  async save(u: User) {
    await this.primary.save(u);
    try { await this.secondary.save(u); } catch { this.missed.push(u.id); }
  }
  find(id: string) { return this.primary.find(id); }
}

// ---------- checks ----------
let pass = 0;
const ok = (cond: boolean, name: string) => {
  if (!cond) throw new Error(`FAILED: ${name}`);
  pass++;
  console.log(`  ok  ${name}`);
};
const failure = async (p: Promise<unknown>): Promise<unknown> => {
  try { await p; } catch (e) { return e; }
  throw new Error('expected a rejection');
};

async function main() {
  const trip: EtaReq = { from: { lat: 12, lng: 77 }, to: { lat: 13, lng: 80 } }; // 1300 m by our fake road
  const toIsland: EtaReq = { from: trip.from, to: ISLAND };

  const atlas = new AtlasSdk();
  const path = new PathFinderSdk();
  const geo = new GeoLiteSdk();
  const suite = [
    { p: new AtlasAdapter(atlas), sdk: atlas },
    { p: new PathFinderAdapter(path), sdk: path },
    { p: new GeoLiteAdapter(geo), sdk: geo },
  ];

  console.log('\n=== Contract suite: the same tests for every adapter (Q6) ===');
  for (const { p, sdk } of suite) {
    const r = await p.eta(trip);
    ok(r.meters === 1300 && r.seconds === 130, `${p.name}: units become integer metres and seconds, right coordinate order (Q1)`);
    ok(Object.keys(r).sort().join() === 'meters,seconds', `${p.name}: no SDK field leaks out`);
    ok(await failure(p.eta(toIsland)) instanceof NoRouteError, `${p.name}: its own "no route" becomes NoRouteError (Q3)`);
    sdk.down = true;
    ok(await failure(p.eta(trip)) instanceof EtaUnavailableError, `${p.name}: its own outage becomes EtaUnavailableError (Q3)`);
    sdk.down = false;
  }

  console.log('\n=== Fallback router (Q7) ===');
  const first = new CountingEta(suite[0].p);
  const second = new CountingEta(suite[2].p);
  const router = new FallbackEta([first, second]);

  ok((await router.eta(trip)).meters === 1300 && second.calls === 0, 'healthy first provider: the second is never called');
  atlas.down = true;
  ok((await router.eta(trip)).meters === 1300 && second.calls === 1, 'outage on the first: falls through to the second');
  atlas.down = false;
  const before = second.calls;
  ok(await failure(router.eta(toIsland)) instanceof NoRouteError && second.calls === before, '"no route" is final: no fall through');
  atlas.down = geo.down = true;
  ok(await failure(router.eta(trip)) instanceof EtaUnavailableError, 'all down: the router reports unavailable');
  atlas.down = geo.down = false;
  ok(first.name === 'Atlas' && (await first.eta(trip)).seconds === 130, 'Decorator keeps the interface and the result (Q4)');

  console.log('\n=== util.promisify is only half an adapter (Q2) ===');
  const pf = new PathFinderSdk();
  const lost = promisify(pf.route) as (a: [number, number], b: [number, number]) => Promise<{ metres: number; secs: number }>;
  ok(await failure(lost([77, 12], [80, 13])) instanceof TypeError, 'no bind: `this` is lost, so the call rejects with a TypeError');
  const bound = promisify(pf.route.bind(pf)) as typeof lost;
  ok((await bound([77, 12], [80, 13])).metres === 1300, 'bound: code 0 is falsy, so it resolves like a success');
  ok(await failure(bound([77, 12], [20, 20])) === 7, 'but code 7 rejects with the bare number 7, so errors still need mapping');

  console.log('\n=== Object adapter vs class adapter (Q5) ===');
  ok(!('route' in new PathFinderAdapter(new PathFinderSdk())), 'object adapter: SDK methods stay hidden');
  const classy = new PathFinderClassAdapter();
  ok('route' in classy, 'class adapter: callers can reach route() and depend on the SDK again');
  ok((await classy.eta(trip)).meters === 1300, 'class adapter gives the same result, so hiding the SDK is the real difference');

  console.log('\n=== Migration: Mongo to SQL behind one port ===');
  const mongo = new MongoUsers();
  const sql = new SqlUsers();
  const oldRepo = new MongoUserRepo(mongo);
  const newRepo = new SqlUserRepo(sql);
  const dual: UserRepo & { missed: string[] } = new DualWriteRepo(oldRepo, newRepo);
  const asha: User = { id: 'u1', email: 'asha@x.in', city: 'Patna' };

  await dual.save(asha);
  ok(mongo.docs.get('u1')?.contact.email === 'asha@x.in', 'the Mongo adapter stores a nested document');
  ok(sql.rows.get('u1')?.email_addr === 'asha@x.in', 'the SQL adapter stores a flat row');
  ok(JSON.stringify(await oldRepo.find('u1')) === JSON.stringify(await newRepo.find('u1')), 'both adapters return the same User');

  sql.failNext = true;
  const ravi: User = { id: 'u2', email: 'ravi@y.in', city: 'Pune' };
  await dual.save(ravi);
  ok((await dual.find('u2'))?.email === 'ravi@y.in', 'a failed new-store write does not fail the user');
  ok(dual.missed.join() === 'u2' && (await newRepo.find('u2')) === null, 'the miss is recorded for the backfill job');
  for (const id of dual.missed) await newRepo.save((await oldRepo.find(id))!);
  ok((await newRepo.find('u2'))?.city === 'Pune', 'backfill closes the gap, and the read can then switch to SQL');

  console.log(`\n${pass} checks passed`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
