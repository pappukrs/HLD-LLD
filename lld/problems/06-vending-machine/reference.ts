// 06 · Vending Machine: reference solution.
// Read this only after your own attempt passes (or after 60 minutes).

export type Coin = 1 | 2 | 5 | 10;
export const COINS: readonly Coin[] = [10, 5, 2, 1]; // largest first
export type MachineState = 'IDLE' | 'HAS_MONEY' | 'MAINTENANCE';

export interface ProductInfo {
  readonly code: string;
  readonly name: string;
  readonly price: number;
}

export interface Purchase {
  readonly product: ProductInfo;
  readonly change: Coin[];
}

export interface ChangeMaker {
  /** Coins that add up to `amount`, using at most `available` of each. null if impossible. */
  makeChange(amount: number, available: ReadonlyMap<Coin, number>): Coin[] | null;
}

export interface VendingMachineOptions {
  float?: Partial<Record<Coin, number>>; // coins loaded for change at the start
  changeMaker?: ChangeMaker; // default: greedy
}

// Greedy is optimal for unlimited INR coins (1, 2, 5, 10). With limited coins it can
// fail when an answer exists (6 = 5 + ? with no 1s, but 2+2+2 works). Hence a Strategy.
export class GreedyChangeMaker implements ChangeMaker {
  makeChange(amount: number, available: ReadonlyMap<Coin, number>): Coin[] | null {
    const change: Coin[] = [];
    let rest = amount;
    for (const coin of COINS) {
      const take = Math.min(available.get(coin) ?? 0, Math.floor(rest / coin));
      for (let i = 0; i < take; i++) change.push(coin);
      rest -= take * coin;
    }
    return rest === 0 ? change : null;
  }
}

interface Slot extends ProductInfo {
  quantity: number;
}

// The data every state works on. Not exported: callers use VendingMachine.
class Context {
  state: State = IDLE;
  readonly slots = new Map<string, Slot>();
  coins: Map<Coin, number>;
  inserted: Coin[] = [];

  constructor(float: Partial<Record<Coin, number>>, readonly changeMaker: ChangeMaker) {
    this.coins = new Map(COINS.map((c) => [c, float[c] ?? 0]));
  }

  get balance(): number {
    return this.inserted.reduce((sum, c) => sum + c, 0);
  }

  // All checks first, then all changes. If anything throws, nothing has changed.
  purchase(code: string): Purchase {
    const slot = this.slots.get(code);
    if (!slot) throw new Error(`Unknown product ${code}`);
    if (slot.quantity === 0) throw new Error(`${slot.name} is sold out`);
    if (this.balance < slot.price) throw new Error(`Insert ${slot.price - this.balance} more`);

    // The inserted coins can be used for change too.
    const pool = new Map(this.coins);
    for (const c of this.inserted) pool.set(c, pool.get(c)! + 1);
    const due = this.balance - slot.price;
    const change = this.changeMaker.makeChange(due, pool);
    if (!change) throw new Error('Cannot make change. Use exact coins or cancel');
    for (const c of change) {
      const left = (pool.get(c) ?? 0) - 1;
      if (left < 0) throw new Error('Change maker used coins the machine does not have');
      pool.set(c, left);
    }
    if (change.reduce((s, c) => s + c, 0) !== due) throw new Error('Change maker returned a wrong amount');

    this.coins = pool;
    this.inserted = [];
    slot.quantity--;
    return { product: { code: slot.code, name: slot.name, price: slot.price }, change };
  }

  refund(): Coin[] {
    const coins = this.inserted;
    this.inserted = [];
    return coins;
  }
}

// State pattern: each state answers every action. Illegal actions throw in one place,
// instead of `if (state === ...)` checks inside every method of the machine.
interface State {
  readonly name: MachineState;
  insertCoin(ctx: Context, coin: Coin): void;
  select(ctx: Context, code: string): Purchase;
  cancel(ctx: Context): Coin[];
  startMaintenance(ctx: Context): void;
  endMaintenance(ctx: Context): void;
}

class IdleState implements State {
  readonly name = 'IDLE';
  insertCoin(ctx: Context, coin: Coin): void {
    ctx.inserted.push(coin);
    ctx.state = HAS_MONEY;
  }
  select(): Purchase {
    throw new Error('Insert coins first');
  }
  cancel(): Coin[] {
    return [];
  }
  startMaintenance(ctx: Context): void {
    ctx.state = MAINTENANCE;
  }
  endMaintenance(): void {
    throw new Error('Not in maintenance');
  }
}

class HasMoneyState implements State {
  readonly name = 'HAS_MONEY';
  insertCoin(ctx: Context, coin: Coin): void {
    ctx.inserted.push(coin);
  }
  select(ctx: Context, code: string): Purchase {
    const purchase = ctx.purchase(code); // on error we stay here and keep the money
    ctx.state = IDLE;
    return purchase;
  }
  cancel(ctx: Context): Coin[] {
    ctx.state = IDLE;
    return ctx.refund();
  }
  startMaintenance(): void {
    throw new Error('Finish or cancel the current purchase first');
  }
  endMaintenance(): void {
    throw new Error('Not in maintenance');
  }
}

class MaintenanceState implements State {
  readonly name = 'MAINTENANCE';
  insertCoin(): void {
    throw new Error('Machine is in maintenance');
  }
  select(): Purchase {
    throw new Error('Machine is in maintenance');
  }
  cancel(): Coin[] {
    return [];
  }
  startMaintenance(): void {
    throw new Error('Already in maintenance');
  }
  endMaintenance(ctx: Context): void {
    ctx.state = IDLE;
  }
}

// States hold no data, so one shared instance of each is enough.
const IDLE: State = new IdleState();
const HAS_MONEY: State = new HasMoneyState();
const MAINTENANCE: State = new MaintenanceState();

export class VendingMachine {
  private readonly ctx: Context;

  constructor(options: VendingMachineOptions = {}) {
    this.ctx = new Context(options.float ?? {}, options.changeMaker ?? new GreedyChangeMaker());
  }

  get state(): MachineState {
    return this.ctx.state.name;
  }

  get balance(): number {
    return this.ctx.balance;
  }

  /** Adds a new product, or restocks an existing one (price and name are updated). */
  addProduct(code: string, name: string, price: number, quantity: number): void {
    if (this.ctx.state === HAS_MONEY) throw new Error('Cannot restock during a purchase');
    if (!Number.isInteger(price) || price <= 0) throw new Error('Price must be a positive integer');
    if (!Number.isInteger(quantity) || quantity < 0) throw new Error('Quantity must be a non-negative integer');
    const existing = this.ctx.slots.get(code);
    this.ctx.slots.set(code, { code, name, price, quantity: (existing?.quantity ?? 0) + quantity });
  }

  stock(code: string): number {
    return this.ctx.slots.get(code)?.quantity ?? 0;
  }

  coinCount(coin: Coin): number {
    return this.ctx.coins.get(coin) ?? 0;
  }

  insertCoin(coin: Coin): void {
    if (!COINS.includes(coin)) throw new Error(`Coin ${coin} is not accepted`);
    this.ctx.state.insertCoin(this.ctx, coin);
  }

  select(code: string): Purchase {
    return this.ctx.state.select(this.ctx, code);
  }

  cancel(): Coin[] {
    return this.ctx.state.cancel(this.ctx);
  }

  startMaintenance(): void {
    this.ctx.state.startMaintenance(this.ctx);
  }

  endMaintenance(): void {
    this.ctx.state.endMaintenance(this.ctx);
  }
}
