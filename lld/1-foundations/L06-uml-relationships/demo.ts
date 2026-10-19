// L06 demo: decide UML relationships from code facts, then print a mermaid class diagram.
// Run: npx tsx lld/1-foundations/L06-uml-relationships/demo.ts
export {};

type Rel = 'inheritance' | 'realization' | 'composition' | 'aggregation' | 'association' | 'dependency';

// Facts you can read straight off the code.
interface Facts {
  extendsIt?: boolean;      // class A extends B
  implementsIt?: boolean;   // class A implements B
  storedInField?: boolean;  // A keeps a B in a field
  createdInside?: boolean;  // A does `new B()` itself
  sharedOrPassedIn?: boolean; // B comes from outside / can belong to others
}

// The decision order from the README: subtype? owns? holds? knows? uses?
function classify(f: Facts): Rel {
  if (f.extendsIt) return 'inheritance';
  if (f.implementsIt) return 'realization';
  if (f.storedInField && f.createdInside && !f.sharedOrPassedIn) return 'composition';
  if (f.storedInField && f.sharedOrPassedIn && f.createdInside === false) return 'aggregation';
  if (f.storedInField) return 'association';
  return 'dependency';
}

const MERMAID: Record<Rel, (a: string, b: string, m?: [string, string]) => string> = {
  inheritance: (a, b) => `${b} <|-- ${a}`,
  realization: (a, b) => `${b} <|.. ${a}`,
  composition: (a, b, m) => `${a} ${m ? `"${m[0]}" ` : ''}*-- ${m ? `"${m[1]}" ` : ''}${b}`,
  aggregation: (a, b, m) => `${a} ${m ? `"${m[0]}" ` : ''}o-- ${m ? `"${m[1]}" ` : ''}${b}`,
  association: (a, b) => `${a} --> ${b}`,
  dependency: (a, b) => `${a} ..> ${b}`,
};

// ---------- 1. Parking lot: facts -> relationship -> mermaid ----------
const pairs: { a: string; b: string; why: string; f: Facts; m?: [string, string] }[] = [
  { a: 'ParkingLot', b: 'Floor', why: 'lot does new Floor() and never shares it', f: { storedInField: true, createdInside: true }, m: ['1', '1..*'] },
  { a: 'Floor', b: 'Spot', why: 'floor creates its spots', f: { storedInField: true, createdInside: true }, m: ['1', '1..*'] },
  { a: 'Spot', b: 'Vehicle', why: 'vehicle arrives from outside, leaves later', f: { storedInField: true, createdInside: false, sharedOrPassedIn: true }, m: ['1', '0..1'] },
  { a: 'Car', b: 'Vehicle', why: 'class Car extends Vehicle', f: { extendsIt: true } },
  { a: 'HourlyPricing', b: 'PricingStrategy', why: 'implements the interface', f: { implementsIt: true } },
  { a: 'ParkingLot', b: 'PricingStrategy', why: 'injected, kept in a field', f: { storedInField: true } },
  { a: 'Ticket', b: 'Spot', why: 'ticket keeps spot reference', f: { storedInField: true } },
  { a: 'ParkingLot', b: 'PaymentGateway', why: 'only a parameter of exit()', f: {} },
];

console.log('--- 1. Classify each pair (parking lot) ---');
const lines: string[] = [];
for (const p of pairs) {
  const rel = classify(p.f);
  lines.push(MERMAID[rel](p.a, p.b, p.m));
  console.log(`  ${(p.a + ' / ' + p.b).padEnd(32)} ${rel.padEnd(12)} because ${p.why}`);
}

console.log('\n--- 2. The mermaid diagram (paste into a README) ---');
console.log('  classDiagram');
console.log('    class PricingStrategy {\n      <<interface>>\n      +price(minutes) number\n    }');
lines.forEach((l) => console.log('    ' + l));

// ---------- 3. Lifetime: composition vs aggregation in running code ----------
console.log('\n--- 3. Delete the whole: who survives? ---');
class Room { constructor(readonly name: string, public alive = true) {} }
class House {
  private readonly rooms: Room[];
  constructor() { this.rooms = [new Room('hall'), new Room('kitchen')]; } // created inside
  demolish() { this.rooms.forEach((r) => (r.alive = false)); this.rooms.length = 0; }
  roomCount() { return this.rooms.length; }
}
class Player { constructor(readonly name: string) {} }
class Team {
  private players: Player[] = [];
  add(p: Player) { this.players.push(p); } // passed in
  disband() { this.players = []; }
}

const house = new House();
console.log(`  house has ${house.roomCount()} rooms; demolish()`);
house.demolish();
console.log(`  rooms after: ${house.roomCount()} (no one else could reach them) -> composition`);

const league = [new Player('Virat'), new Player('Rohit')]; // the league also holds players
const team = new Team();
league.forEach((p) => team.add(p));
team.disband();
console.log(`  team disbanded; league still has: ${league.map((p) => p.name).join(', ')} -> aggregation`);

// ---------- 4. Dependency vs association ----------
console.log('\n--- 4. Dependency vs association ---');
interface EmailClient { send(to: string, body: string): string; }
class OrderService {
  notify(mail: EmailClient, to: string) { return mail.send(to, 'Order placed'); } // param only: dependency
}
class Order { constructor(readonly customerId: string) {} } // field: association
const svc = new OrderService();
console.log('  ' + svc.notify({ send: (to, body) => `sent "${body}" to ${to}` }, 'pappu@x.in'));
console.log('  OrderService keeps no EmailClient field ->', Object.keys(svc).length === 0 ? 'dependency (..>)' : 'association');
console.log('  Order keeps customerId field ->', Object.keys(new Order('c1')).includes('customerId') ? 'association (-->)' : 'dependency');
