import * as starter from './starter';
import * as reference from './reference';
import type { ChangeMaker, Coin, VendingMachineOptions } from './reference';

// `npm test` checks your starter.ts; `npm run test:ref` checks the reference.
const { VendingMachine } = (process.env.REF ? reference : starter) as typeof reference;

function makeMachine(options: VendingMachineOptions = { float: { 1: 5, 2: 5, 5: 5, 10: 5 } }) {
  const vm = new VendingMachine(options);
  vm.addProduct('A1', 'Chips', 15, 2);
  vm.addProduct('B1', 'Cola', 3, 1);
  return vm;
}

const sum = (coins: Coin[]) => coins.reduce((s, c) => s + c, 0);

describe('06 · Vending Machine', () => {
  describe('buying', () => {
    it('sells a product for exact money and returns to IDLE', () => {
      const vm = makeMachine();
      expect(vm.state).toBe('IDLE');
      vm.insertCoin(10);
      vm.insertCoin(5);
      expect(vm.state).toBe('HAS_MONEY');
      expect(vm.balance).toBe(15);
      const p = vm.select('A1');
      expect(p.product).toEqual({ code: 'A1', name: 'Chips', price: 15 });
      expect(p.change).toEqual([]);
      expect(vm.state).toBe('IDLE');
      expect(vm.balance).toBe(0);
      expect(vm.stock('A1')).toBe(1);
    });

    it('returns change with the fewest coins (greedy)', () => {
      const vm = makeMachine();
      vm.insertCoin(10);
      vm.insertCoin(10);
      const { change } = vm.select('B1'); // 20 - 3 = 17
      expect(change).toEqual([10, 5, 2]);
      expect(vm.coinCount(10)).toBe(6); // 5 + 2 inserted - 1 returned
    });

    it('rejects select before any coin is inserted', () => {
      const vm = makeMachine();
      expect(() => vm.select('A1')).toThrow();
      expect(vm.state).toBe('IDLE');
    });

    it('keeps the money when the balance is too low, and sells once topped up', () => {
      const vm = makeMachine();
      vm.insertCoin(10);
      expect(() => vm.select('A1')).toThrow();
      expect(vm.state).toBe('HAS_MONEY');
      expect(vm.balance).toBe(10);
      vm.insertCoin(5);
      expect(vm.select('A1').product.code).toBe('A1');
    });

    it('rejects unknown and sold-out products without taking the money', () => {
      const vm = makeMachine();
      vm.insertCoin(5);
      vm.select('B1');
      vm.insertCoin(5);
      expect(() => vm.select('B1')).toThrow(/sold out/);
      expect(() => vm.select('Z9')).toThrow();
      expect(vm.balance).toBe(5);
    });

    it('rejects a coin the machine does not accept', () => {
      const vm = makeMachine();
      expect(() => vm.insertCoin(3 as Coin)).toThrow();
      expect(vm.state).toBe('IDLE');
    });
  });

  describe('cancel and change problems', () => {
    it('refunds the exact inserted coins on cancel', () => {
      const vm = makeMachine();
      vm.insertCoin(2);
      vm.insertCoin(10);
      expect(vm.cancel()).toEqual([2, 10]);
      expect(vm.state).toBe('IDLE');
      expect(vm.balance).toBe(0);
      expect(vm.cancel()).toEqual([]);
    });

    it('refuses the sale when it cannot make change, and changes nothing', () => {
      const vm = makeMachine({ float: {} }); // no coins for change
      vm.insertCoin(10);
      expect(() => vm.select('B1')).toThrow(/change/);
      expect(vm.state).toBe('HAS_MONEY');
      expect(vm.balance).toBe(10);
      expect(vm.stock('B1')).toBe(1);
      expect(vm.coinCount(10)).toBe(0);
      expect(vm.cancel()).toEqual([10]);
    });
  });

  describe('maintenance', () => {
    it('blocks buying in maintenance and allows restocking', () => {
      const vm = makeMachine();
      vm.startMaintenance();
      expect(vm.state).toBe('MAINTENANCE');
      expect(() => vm.insertCoin(10)).toThrow();
      expect(() => vm.select('A1')).toThrow();
      vm.addProduct('A1', 'Chips', 15, 3);
      expect(vm.stock('A1')).toBe(5);
      vm.endMaintenance();
      expect(vm.state).toBe('IDLE');
      expect(() => vm.endMaintenance()).toThrow();
    });

    it('does not enter maintenance or restock in the middle of a purchase', () => {
      const vm = makeMachine();
      vm.insertCoin(5);
      expect(() => vm.startMaintenance()).toThrow();
      expect(() => vm.addProduct('A1', 'Chips', 15, 1)).toThrow();
      expect(vm.state).toBe('HAS_MONEY');
    });

    it('rejects a bad price or quantity', () => {
      const vm = new VendingMachine();
      expect(() => vm.addProduct('X', 'Bad', 0, 1)).toThrow();
      expect(() => vm.addProduct('X', 'Bad', 10, -1)).toThrow();
    });
  });

  describe('extensibility', () => {
    it('accepts any ChangeMaker, e.g. an exhaustive one where greedy fails', () => {
      // Exhaustive search: tries every coin count. Fine for small amounts.
      class ExhaustiveChangeMaker implements ChangeMaker {
        makeChange(amount: number, available: ReadonlyMap<Coin, number>): Coin[] | null {
          const coins: Coin[] = [10, 5, 2, 1];
          const go = (i: number, rest: number): Coin[] | null => {
            if (rest === 0) return [];
            if (i === coins.length) return null;
            const c = coins[i];
            for (let n = Math.min(available.get(c) ?? 0, Math.floor(rest / c)); n >= 0; n--) {
              const tail = go(i + 1, rest - n * c);
              if (tail) return [...Array<Coin>(n).fill(c), ...tail];
            }
            return null;
          };
          return go(0, amount);
        }
      }
      const float = { 5: 1, 2: 3 }; // change of 6: greedy takes 5 and is stuck; 2+2+2 works
      const greedy = new VendingMachine({ float });
      const smart = new VendingMachine({ float, changeMaker: new ExhaustiveChangeMaker() });
      for (const vm of [greedy, smart]) {
        vm.addProduct('C1', 'Gum', 4, 1);
        vm.insertCoin(10);
      }
      expect(() => greedy.select('C1')).toThrow();
      const { change } = smart.select('C1');
      expect(sum(change)).toBe(6);
      expect(change).toEqual([2, 2, 2]);
    });
  });
});
