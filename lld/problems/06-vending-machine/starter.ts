// 06 · Vending Machine: your implementation goes here.
// Keep the exported names and signatures; the tests import them.
// Run: npx vitest run lld/problems/06-vending-machine

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

export class GreedyChangeMaker implements ChangeMaker {
  makeChange(amount: number, available: ReadonlyMap<Coin, number>): Coin[] | null {
    throw new Error('TODO: largest coin first, respect available counts');
  }
}

// Hint: one class per state. The machine delegates every action to the current state.
export class VendingMachine {
  constructor(options: VendingMachineOptions = {}) {
    // TODO
  }

  get state(): MachineState {
    throw new Error('TODO');
  }

  get balance(): number {
    throw new Error('TODO');
  }

  /** Adds a new product, or restocks an existing one (price and name are updated). */
  addProduct(code: string, name: string, price: number, quantity: number): void {
    throw new Error('TODO');
  }

  stock(code: string): number {
    throw new Error('TODO');
  }

  coinCount(coin: Coin): number {
    throw new Error('TODO');
  }

  insertCoin(coin: Coin): void {
    throw new Error('TODO');
  }

  select(code: string): Purchase {
    throw new Error('TODO: on any error, keep the money and stay in HAS_MONEY');
  }

  cancel(): Coin[] {
    throw new Error('TODO');
  }

  startMaintenance(): void {
    throw new Error('TODO');
  }

  endMaintenance(): void {
    throw new Error('TODO');
  }
}
