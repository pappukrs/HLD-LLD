import * as starter from './starter';
import * as reference from './reference';

// `npm test` checks your starter.ts; `npm run test:ref` checks the reference.
const { ATM, InMemoryBank } = (process.env.REF ? reference : starter) as typeof reference;

const CARD = '4111-0001';
const PIN = '1234';

function setup(balance = 10_000, cash: Record<number, number> = { 2000: 5, 500: 10, 100: 20 }) {
  const bank = new InMemoryBank();
  bank.addAccount({ cardNumber: CARD, pin: PIN, balance });
  const atm = new ATM({ bank, cash });
  return { bank, atm };
}

function login(atm: InstanceType<typeof ATM>) {
  atm.insertCard(CARD);
  expect(atm.enterPin(PIN)).toBe(true);
}

describe('11 · ATM', () => {
  describe('session states', () => {
    it('goes IDLE → CARD_INSERTED → AUTHENTICATED → IDLE', () => {
      const { atm } = setup();
      expect(atm.state).toBe('IDLE');
      atm.insertCard(CARD);
      expect(atm.state).toBe('CARD_INSERTED');
      atm.enterPin(PIN);
      expect(atm.state).toBe('AUTHENTICATED');
      atm.ejectCard();
      expect(atm.state).toBe('IDLE');
    });

    it('rejects actions that are not valid in the current state', () => {
      const { atm } = setup();
      expect(() => atm.withdraw(100)).toThrow();
      expect(() => atm.enterPin(PIN)).toThrow();
      expect(() => atm.ejectCard()).toThrow();
      atm.insertCard(CARD);
      expect(() => atm.insertCard(CARD)).toThrow();
      expect(() => atm.balance()).toThrow(); // PIN not entered yet
    });

    it('rejects an unknown card', () => {
      const { atm } = setup();
      expect(() => atm.insertCard('9999')).toThrow();
      expect(atm.state).toBe('IDLE');
    });

    it('needs the PIN again after the card is ejected', () => {
      const { atm } = setup();
      login(atm);
      atm.ejectCard();
      atm.insertCard(CARD);
      expect(() => atm.withdraw(100)).toThrow();
    });
  });

  describe('PIN attempts', () => {
    it('blocks and ejects the card after 3 wrong PINs', () => {
      const { atm, bank } = setup();
      atm.insertCard(CARD);
      expect(atm.enterPin('0000')).toBe(false);
      expect(atm.enterPin('0000')).toBe(false);
      expect(atm.state).toBe('CARD_INSERTED');
      expect(atm.enterPin('0000')).toBe(false);
      expect(atm.state).toBe('IDLE');
      expect(bank.isBlocked(CARD)).toBe(true);
      expect(() => atm.insertCard(CARD)).toThrow();
    });

    it('resets the counter after a correct PIN', () => {
      const { atm, bank } = setup();
      atm.insertCard(CARD);
      atm.enterPin('0000');
      atm.enterPin('0000');
      expect(atm.enterPin(PIN)).toBe(true);
      atm.ejectCard();
      atm.insertCard(CARD);
      atm.enterPin('0000');
      atm.enterPin('0000');
      expect(bank.isBlocked(CARD)).toBe(false);
    });
  });

  describe('withdraw and deposit', () => {
    it('dispenses the largest notes first and debits the account', () => {
      const { atm } = setup();
      login(atm);
      const r = atm.withdraw(2600);
      expect(r.notes).toEqual({ 2000: 1, 500: 1, 100: 1 });
      expect(r.balance).toBe(7400);
      expect(atm.balance()).toBe(7400);
      expect(atm.cashAvailable()).toBe(17_000 - 2600);
    });

    it('falls back to smaller notes when big notes run out', () => {
      const { atm } = setup(10_000, { 2000: 1, 500: 4, 100: 10 });
      login(atm);
      expect(atm.withdraw(4000).notes).toEqual({ 2000: 1, 500: 4 });
    });

    it('does NOT debit the account when the ATM cannot make the amount', () => {
      const { atm } = setup(50_000, { 2000: 1, 500: 0, 100: 2 });
      login(atm);
      expect(() => atm.withdraw(2500)).toThrow();
      expect(atm.balance()).toBe(50_000);
      expect(atm.cashAvailable()).toBe(2200);
    });

    it('rejects a withdrawal above the balance and keeps the cash', () => {
      const { atm } = setup(1000);
      login(atm);
      expect(() => atm.withdraw(2000)).toThrow();
      expect(atm.balance()).toBe(1000);
      expect(atm.cashAvailable()).toBe(17_000);
    });

    it('rejects amounts that are zero, negative, fractional or not payable in notes', () => {
      const { atm } = setup();
      login(atm);
      expect(() => atm.withdraw(0)).toThrow();
      expect(() => atm.withdraw(-100)).toThrow();
      expect(() => atm.withdraw(150.5)).toThrow();
      expect(() => atm.withdraw(250)).toThrow();
      expect(atm.balance()).toBe(10_000);
    });

    it('deposits into the account', () => {
      const { atm } = setup(1000);
      login(atm);
      expect(atm.deposit(500)).toBe(1500);
      expect(() => atm.deposit(0)).toThrow();
    });
  });

  describe('extensibility', () => {
    it('supports a new denomination with no code change', () => {
      const { atm } = setup(10_000, { 2000: 1, 200: 5, 100: 5 });
      login(atm);
      expect(atm.withdraw(2500).notes).toEqual({ 2000: 1, 200: 2, 100: 1 });
    });
  });
});
