// L30 · Machine-coding framework: a parking lot laid out the way you'd lay out a 90-minute round.
// Sections mirror the folder layout: types → errors → models → strategies → repositories → services → main.
// Run: npx tsx lld/5-machine-coding/L30-machine-coding-framework/demo.ts

// ---------- models/types.ts ----------
type VehicleType = 'BIKE' | 'CAR' | 'TRUCK';
type SpotSize = 'SMALL' | 'MEDIUM' | 'LARGE';
const FITS: Record<VehicleType, SpotSize[]> = {
  BIKE: ['SMALL', 'MEDIUM', 'LARGE'],
  CAR: ['MEDIUM', 'LARGE'],
  TRUCK: ['LARGE'],
};

// ---------- errors.ts ----------
class DomainError extends Error {
  constructor(message: string) { super(message); this.name = new.target.name; }
}
class NotFoundError extends DomainError {}
class LotFullError extends DomainError {}
class ValidationError extends DomainError {}

// ---------- models/Spot.ts + Ticket.ts ----------
class Spot {
  private occupiedBy: string | null = null;
  constructor(readonly id: string, readonly size: SpotSize) {}
  get free() { return this.occupiedBy === null; }
  occupy(plate: string) {
    if (!this.free) throw new ValidationError(`spot ${this.id} is taken`);
    this.occupiedBy = plate;
  }
  release() { this.occupiedBy = null; }
}

interface Ticket { readonly id: string; readonly plate: string; readonly type: VehicleType; readonly spotId: string; readonly inAt: number }

// ---------- strategies/PricingStrategy.ts ----------
interface PricingStrategy { fee(type: VehicleType, parkedMs: number): number }
const HOUR = 3_600_000;
class HourlyPricing implements PricingStrategy {
  constructor(private readonly rates: Record<VehicleType, number>) {}
  fee(type: VehicleType, ms: number) { return Math.max(1, Math.ceil(ms / HOUR)) * this.rates[type]; }
}
class WeekendFlatPricing implements PricingStrategy {   // the extension: a new class, no edits
  fee(_type: VehicleType, _ms: number) { return 50; }
}

// ---------- repositories/TicketRepo.ts ----------
interface TicketRepo { save(t: Ticket): void; find(id: string): Ticket | undefined; remove(id: string): void }
class InMemoryTicketRepo implements TicketRepo {
  private readonly rows = new Map<string, Ticket>();
  save(t: Ticket) { this.rows.set(t.id, t); }
  find(id: string) { return this.rows.get(id); }
  remove(id: string) { this.rows.delete(id); }
}

// ---------- services/ParkingService.ts ----------
interface Deps { spots: Spot[]; pricing: PricingStrategy; repo: TicketRepo; clock: () => number; nextId: () => string }
class ParkingService {
  constructor(private readonly d: Deps) {}

  park(plate: string, type: VehicleType): Ticket {
    if (!/^[A-Z0-9-]{4,}$/.test(plate)) throw new ValidationError(`bad plate "${plate}"`);
    // Smallest spot that fits: FITS is ordered small → large.
    const spot = FITS[type].map((s) => this.d.spots.find((x) => x.size === s && x.free)).find(Boolean);
    if (!spot) throw new LotFullError(`no spot for ${type}`);
    spot.occupy(plate);   // check + update in one synchronous block: safe in one Node process
    const t: Ticket = { id: this.d.nextId(), plate, type, spotId: spot.id, inAt: this.d.clock() };
    this.d.repo.save(t);
    return t;
  }

  unpark(ticketId: string): { plate: string; fee: number } {
    const t = this.d.repo.find(ticketId);
    if (!t) throw new NotFoundError(`ticket ${ticketId} not found`);
    this.d.spots.find((s) => s.id === t.spotId)!.release();
    this.d.repo.remove(t.id);
    return { plate: t.plate, fee: this.d.pricing.fee(t.type, this.d.clock() - t.inAt) };
  }

  available(size: SpotSize) { return this.d.spots.filter((s) => s.size === size && s.free).length; }
}

// ---------- main.ts (composition root + demo) ----------
function header(title: string) { console.log(`\n=== ${title} ===`); }
function attempt(label: string, fn: () => unknown) {
  try { console.log(`${label} ->`, fn()); }
  catch (e) { console.log(`${label} -> ${(e as Error).name}: ${(e as Error).message}`); }
}

function main() {
  let now = 0;
  let seq = 0;
  const makeLot = (pricing: PricingStrategy) => new ParkingService({
    spots: [new Spot('S1', 'SMALL'), new Spot('M1', 'MEDIUM'), new Spot('M2', 'MEDIUM'), new Spot('L1', 'LARGE')],
    pricing, repo: new InMemoryTicketRepo(), clock: () => now, nextId: () => `T${++seq}`,
  });

  header('Minute 18: driver written first, wiring in one place');
  const lot = makeLot(new HourlyPricing({ BIKE: 10, CAR: 20, TRUCK: 50 }));
  console.log('free spots:', { SMALL: lot.available('SMALL'), MEDIUM: lot.available('MEDIUM'), LARGE: lot.available('LARGE') });

  header('Minute 25-65: must-haves, run after each one');
  const bike = lot.park('KA01-BIKE', 'BIKE');
  const car = lot.park('KA02-CAR1', 'CAR');
  console.log('bike ->', bike.spotId, '(smallest that fits)', '| car ->', car.spotId);
  now += 2.5 * HOUR;   // injected clock: no waiting, fully repeatable
  attempt('unpark car after 2.5h', () => lot.unpark(car.id));

  header('Minute 65-75: edge cases give typed errors, never null');
  attempt('unpark unknown ticket', () => lot.unpark('T999'));
  attempt('bad plate', () => lot.park('??', 'CAR'));
  lot.park('KA03-TRK1', 'TRUCK');
  attempt('second truck', () => lot.park('KA04-TRK2', 'TRUCK'));

  header('Extension question: "add weekend flat pricing"');
  const weekend = makeLot(new WeekendFlatPricing());   // new class, ParkingService untouched (OCP)
  const t = weekend.park('KA05-CAR2', 'CAR');
  now += 7 * HOUR;
  attempt('weekend unpark after 7h', () => weekend.unpark(t.id));

  header('Minute 85: what you say next');
  console.log('- Storage swaps to Postgres by writing PgTicketRepo; service unchanged.');
  console.log('- Two instances? Move spots to DB, claim with UPDATE ... WHERE free = true (see L32).');
}

main();

export {};
