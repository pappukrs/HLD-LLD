// L28 · Mediator
// Run: npx tsx lld/4-behavioral/L28-mediator/demo.ts
// Two mediators: an elevator dispatcher (buttons and cars never talk directly)
// and a chat room (users never hold references to each other).

type Direction = 'UP' | 'DOWN';

// ---------- 1. Elevator dispatcher ----------
interface Dispatcher {
  requestPickup(floor: number, dir: Direction): string;
  carArrived(car: ElevatorCar, floor: number): void;
}

class ElevatorCar {
  private stops: number[] = [];
  constructor(readonly id: string, public floor: number, private readonly dispatcher: Dispatcher, public maintenance = false) {}
  get idle(): boolean { return this.stops.length === 0; }
  addStop(floor: number): void { if (!this.stops.includes(floor)) this.stops.push(floor); }
  step(): void {
    const target = this.stops[0];
    if (target === undefined) return;
    this.floor += Math.sign(target - this.floor);
    if (this.floor === target) {
      this.stops.shift();
      this.dispatcher.carArrived(this, this.floor); // the car only knows the mediator
    }
  }
}

class Display {
  readonly lines: string[] = [];
  show(carId: string, floor: number): void { this.lines.push(`${carId}@${floor}`); }
}

// The decision rule is a Strategy inside the mediator, so the mediator stays thin.
type PickStrategy = (cars: ElevatorCar[], floor: number) => ElevatorCar | undefined;
const nearestIdleFirst: PickStrategy = (cars, floor) =>
  cars
    .filter((c) => !c.maintenance)
    .sort((a, b) => Number(b.idle) - Number(a.idle) || Math.abs(a.floor - floor) - Math.abs(b.floor - floor))[0];

class ElevatorDispatcher implements Dispatcher {
  private cars: ElevatorCar[] = [];
  constructor(private readonly display: Display, private pick: PickStrategy) {}
  register(car: ElevatorCar): void { this.cars.push(car); }
  setStrategy(s: PickStrategy): void { this.pick = s; }
  requestPickup(floor: number, dir: Direction): string {
    const car = this.pick(this.cars, floor);
    if (!car) throw new Error('No elevator available');
    car.addStop(floor);
    return `pickup ${floor} ${dir} -> ${car.id} (was at ${car.floor})`;
  }
  carArrived(car: ElevatorCar, floor: number): void { this.display.show(car.id, floor); }
  tick(n: number): void { for (let i = 0; i < n; i++) this.cars.forEach((c) => c.step()); }
}

class FloorButton {
  constructor(private readonly floor: number, private readonly dispatcher: Dispatcher) {}
  press(dir: Direction): string { return this.dispatcher.requestPickup(this.floor, dir); }
}

// ---------- 2. Chat room ----------
interface ChatMediator { send(from: User, text: string): void; }

class User {
  readonly inbox: string[] = [];
  constructor(readonly name: string, private readonly room: ChatMediator) {}
  say(text: string): void { this.room.send(this, text); }
  receive(from: string, text: string): void { this.inbox.push(`${from}: ${text}`); }
}

class ChatRoom implements ChatMediator {
  private users = new Map<string, User>();
  private blocks = new Map<string, Set<string>>(); // receiver -> blocked senders
  private muted = new Set<string>();
  join(u: User): void { this.users.set(u.name, u); }
  block(receiver: string, sender: string): void {
    const set = this.blocks.get(receiver) ?? new Set<string>();
    set.add(sender);
    this.blocks.set(receiver, set);
  }
  mute(name: string): void { this.muted.add(name); }
  send(from: User, text: string): void {
    if (this.muted.has(from.name)) { console.log(`  [room] ${from.name} is muted, dropped`); return; }
    for (const u of this.users.values()) {
      if (u === from) continue;
      if (this.blocks.get(u.name)?.has(from.name)) { console.log(`  [room] ${u.name} blocked ${from.name}, skip`); continue; }
      u.receive(from.name, text);
    }
  }
}

function main(): void {
  console.log('== 1. Elevator: buttons and cars only know the dispatcher ==');
  const display = new Display();
  const d = new ElevatorDispatcher(display, nearestIdleFirst);
  const a = new ElevatorCar('A', 0, d);
  const b = new ElevatorCar('B', 8, d);
  const c = new ElevatorCar('C', 5, d, true); // under maintenance
  [a, b, c].forEach((car) => d.register(car));
  console.log('  ' + new FloorButton(7, d).press('DOWN'));
  console.log('  ' + new FloorButton(2, d).press('UP'));
  console.log('  ' + new FloorButton(6, d).press('UP'));
  d.tick(10);
  console.log('  display:', display.lines.join(', '));

  console.log('\n== 2. Swap the rule in ONE place (no button or car changes) ==');
  const lowestId: PickStrategy = (cars) => cars.filter((x) => !x.maintenance)[0];
  d.setStrategy(lowestId);
  console.log('  ' + new FloorButton(9, d).press('DOWN'));

  console.log('\n== 3. Chat room: block and mute live in the mediator ==');
  const room = new ChatRoom();
  const [ana, ben, cy] = ['Ana', 'Ben', 'Cy'].map((n) => new User(n, room));
  [ana, ben, cy].forEach((u) => room.join(u));
  ana.say('standup in 5');
  room.block('Cy', 'Ben');
  ben.say('lunch?');
  room.mute('Ana');
  ana.say('spam spam');
  for (const u of [ana, ben, cy]) console.log(`  ${u.name} inbox: [${u.inbox.join(' | ')}]`);

  console.log('\n== 4. Links count ==');
  for (const n of [5, 10, 50]) console.log(`  ${n} components: mesh ${(n * (n - 1)) / 2} links vs mediator ${n} links`);
}

main();

export {};
