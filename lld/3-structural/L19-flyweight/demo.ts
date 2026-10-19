// L19 Flyweight: share immutable seat-type data across many seats. Count objects and measure heap.
// Run: npx tsx lld/3-structural/L19-flyweight/demo.ts

type SeatStatus = 'FREE' | 'HELD' | 'BOOKED';
const ICON_BYTES = 2048;

// ---------- Before: every seat owns a full copy of its type data ----------
class FatSeat {
  constructor(
    readonly row: string, readonly col: number, public status: SeatStatus,
    readonly typeName: string, readonly basePrice: number, readonly color: string,
    readonly icon: Uint8Array,
  ) {}
}

// ---------- After: flyweight + factory + small context ----------
class SeatType {
  constructor(readonly name: string, readonly basePrice: number, readonly color: string, readonly icon: Uint8Array) {
    Object.freeze(this);
  }
  render(row: string, col: number, status: SeatStatus): string { return `${row}${col}[${this.name}/${status}]`; }
}

class SeatTypeFactory {
  private cache = new Map<string, SeatType>();
  created = 0;
  get(name: string, price: number, color: string): SeatType {
    let t = this.cache.get(name);
    if (!t) { t = new SeatType(name, price, color, new Uint8Array(ICON_BYTES)); this.cache.set(name, t); this.created++; }
    return t;
  }
}

class Seat {
  priceOverride?: number; // extrinsic, per seat
  constructor(readonly row: string, readonly col: number, readonly type: SeatType, public status: SeatStatus = 'FREE') {}
  price(): number { return this.priceOverride ?? this.type.basePrice; }
}

const ROWS = 'ABCDEFGHIJ';
function typeFor(row: string): [string, number, string] {
  return row === 'A' ? ['Recliner', 450, '#c96f12'] : row <= 'D' ? ['Gold', 250, '#a0700a'] : ['Silver', 180, '#9aa5b1'];
}
const mb = (bytes: number) => (bytes / 1024 / 1024).toFixed(1) + ' MB';
const heap = () => process.memoryUsage().heapUsed + process.memoryUsage().arrayBuffers;

function main(): void {
  const SHOWS = 333, COLS = 30; // 333 shows x 300 seats ~ 100k seats
  console.log(`== Building ${SHOWS} shows x ${ROWS.length * COLS} seats = ${SHOWS * ROWS.length * COLS} seats\n`);

  console.log('== 1. Naive: type data copied into every seat');
  let before = heap();
  const fat: FatSeat[] = [];
  for (let s = 0; s < SHOWS; s++) for (const row of ROWS) {
    const [n, p, c] = typeFor(row);
    for (let col = 1; col <= COLS; col++) fat.push(new FatSeat(row, col, 'FREE', n, p, c, new Uint8Array(ICON_BYTES)));
  }
  const fatBytes = heap() - before;
  console.log(`  seat objects: ${fat.length}, icon buffers: ${fat.length}, heap grew by ~${mb(fatBytes)}`);
  fat.length = 0; // let it go

  console.log('\n== 2. Flyweight: one SeatType per type, seats keep only row/col/status');
  before = heap();
  const factory = new SeatTypeFactory();
  const seats: Seat[] = [];
  for (let s = 0; s < SHOWS; s++) for (const row of ROWS) {
    const [n, p, c] = typeFor(row);
    const type = factory.get(n, p, c);
    for (let col = 1; col <= COLS; col++) seats.push(new Seat(row, col, type));
  }
  const flyBytes = heap() - before;
  console.log(`  seat objects: ${seats.length}, SeatType objects: ${factory.created}, heap grew by ~${mb(flyBytes)}`);
  console.log(`  same object? seats[0].type === seats[300].type -> ${seats[0].type === seats[300].type}`);
  console.log(`  heap saving: ~${Math.round((1 - flyBytes / Math.max(fatBytes, 1)) * 100)}% (exact numbers vary with GC)`);

  console.log('\n== 3. Back-of-envelope at city scale (4M seats, 3 types)');
  const N = 4_000_000, ctxB = 40, ptr = 8;
  console.log(`  naive:     ${N} x (${ICON_BYTES} + ${ctxB}) B = ${mb(N * (ICON_BYTES + ctxB))}`);
  console.log(`  flyweight: 3 x ${ICON_BYTES} B + ${N} x (${ctxB} + ${ptr}) B = ${mb(3 * ICON_BYTES + N * (ctxB + ptr))}`);

  console.log('\n== 4. Rendering passes extrinsic state in');
  const show1 = seats.slice(0, 300);
  show1[33].status = 'BOOKED';
  console.log('  ' + [show1[0], show1[1], show1[33], show1[299]].map((s) => s.type.render(s.row, s.col, s.status)).join('  '));

  console.log('\n== 5. Per-seat discount is EXTRINSIC (lives on the seat)');
  show1[270].priceOverride = 90; // J1, "front-row offer" style override
  console.log(`  J1 price=${show1[270].price()}, J2 price=${show1[271].price()} (shared Silver still ${show1[271].type.basePrice})`);

  console.log('\n== 6. Why flyweights must be immutable');
  try {
    (show1[299].type as { basePrice: number }).basePrice = 0; // someone tries to "discount one seat"
  } catch (e) {
    console.log(`  blocked by Object.freeze: ${(e as Error).message}`);
  }
  console.log(`  Silver base price everywhere is still ${seats[seats.length - 1].type.basePrice}`);

  console.log('\nTakeaway: share what is the same (immutable, via a factory); keep what differs on the small context object.');
}

main();

export {};
