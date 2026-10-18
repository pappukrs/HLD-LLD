// P17 · Mediator
// Run: npx tsx lld/concepts/patterns/p17-mediator.ts

type Direction = 'UP' | 'DOWN';

// ---------- mediator interface ----------
interface Dispatcher {
  requestPickup(floor: number, dir: Direction): void;
  carArrived(car: ElevatorCar, floor: number): void;
}

class ElevatorCar {
  private stops: number[] = [];
  constructor(readonly id: string, public floor: number, private readonly dispatcher: Dispatcher, public maintenance = false) {}
  get idle(): boolean { return this.stops.length === 0; }
  addStop(floor: number) { if (!this.stops.includes(floor)) this.stops.push(floor); }
  step(): void {
    const target = this.stops[0];
    if (target === undefined) return;
    this.floor += Math.sign(target - this.floor);
    if (this.floor === target) {
      this.stops.shift();
      this.dispatcher.carArrived(this, this.floor); // the car only talks to the mediator
    }
  }
}

class Display {
  readonly lines: string[] = [];
  show(carId: string, floor: number) { this.lines.push(`${carId}@${floor}`); }
}

// the decision rule is a strategy inside the mediator
type PickStrategy = (cars: ElevatorCar[], floor: number) => ElevatorCar | undefined;
const nearestIdleFirst: PickStrategy = (cars, floor) =>
  cars
    .filter((c) => !c.maintenance)
    .sort((a, b) => Number(b.idle) - Number(a.idle) || Math.abs(a.floor - floor) - Math.abs(b.floor - floor))[0];

class ElevatorDispatcher implements Dispatcher {
  private cars: ElevatorCar[] = [];
  constructor(private readonly display: Display, private readonly pick: PickStrategy) {}
  register(car: ElevatorCar) { this.cars.push(car); }
  requestPickup(floor: number, dir: Direction): void {
    const car = this.pick(this.cars, floor);
    if (!car) throw new Error('No elevator available');
    console.log(`  pickup ${floor} ${dir} -> ${car.id} (at ${car.floor})`);
    car.addStop(floor);
  }
  carArrived(car: ElevatorCar, floor: number): void {
    this.display.show(car.id, floor);
  }
  tick(n: number) { for (let i = 0; i < n; i++) this.cars.forEach((c) => c.step()); }
}

class FloorButton {
  constructor(private readonly floor: number, private readonly dispatcher: Dispatcher) {}
  press(dir: Direction) { this.dispatcher.requestPickup(this.floor, dir); }
}

// ---------- a second mediator: a support chat room ----------
class ChatRoom {
  private users = new Map<string, ChatUser>();
  private blocked = new Set<string>(); // "a|b" means a blocked b
  join(u: ChatUser) { this.users.set(u.name, u); }
  block(by: string, who: string) { this.blocked.add(`${by}|${who}`); }
  send(from: string, text: string) {
    for (const u of this.users.values()) {
      if (u.name === from || this.blocked.has(`${u.name}|${from}`)) continue;
      u.receive(from, text);
    }
  }
}
class ChatUser {
  readonly inbox: string[] = [];
  constructor(readonly name: string, private readonly room: ChatRoom) { room.join(this); }
  say(text: string) { this.room.send(this.name, text); }
  receive(from: string, text: string) { this.inbox.push(`${from}: ${text}`); }
}

function main() {
  console.log('--- elevator dispatcher (mediator) ---');
  const display = new Display();
  const dispatcher = new ElevatorDispatcher(display, nearestIdleFirst);
  const a = new ElevatorCar('A', 0, dispatcher);
  const b = new ElevatorCar('B', 8, dispatcher);
  const c = new ElevatorCar('C', 5, dispatcher, true); // under maintenance
  [a, b, c].forEach((car) => dispatcher.register(car));

  new FloorButton(6, dispatcher).press('DOWN'); // B is nearest idle (C is in maintenance)
  new FloorButton(2, dispatcher).press('UP');   // A is idle and nearest
  new FloorButton(7, dispatcher).press('DOWN'); // no idle car left: nearest busy car
  dispatcher.tick(10);
  console.log(`  display updates: ${display.lines.join(', ')}`);

  console.log('\n--- chat room (mediator) ---');
  const room = new ChatRoom();
  const agent = new ChatUser('agent', room);
  const asha = new ChatUser('asha', room);
  const spam = new ChatUser('spambot', room);
  room.block('asha', 'spambot');
  agent.say('How can I help with your refund?');
  spam.say('Win a free phone!');
  asha.say('Refund for order ord_77 is pending');
  console.log('  asha inbox :', asha.inbox);
  console.log('  agent inbox:', agent.inbox);
  console.log(`  spambot inbox size: ${spam.inbox.length}`);
}

main();

export {};
