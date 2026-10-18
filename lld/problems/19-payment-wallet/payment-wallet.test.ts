import * as starter from './starter';
import * as reference from './reference';
import type { FeePolicy } from './reference';

// `npm test` checks your starter.ts; `npm run test:ref` checks the reference.
const { Wallet, EXTERNAL_ACCOUNT, FEES_ACCOUNT } = (process.env.REF ? reference : starter) as typeof reference;

function makeWallet(feePolicy?: FeePolicy) {
  let now = 1_000;
  const w = new Wallet({ feePolicy, clock: () => now });
  w.openAccount('alice');
  w.openAccount('bob');
  w.deposit('alice', 100_000, 'dep-1'); // ₹1,000
  return { w, advance: (ms: number) => (now += ms) };
}

describe('19 · Payment Wallet', () => {
  describe('ledger', () => {
    it('derives the balance from ledger entries', () => {
      const { w } = makeWallet();
      expect(w.balance('alice')).toBe(100_000);
      expect(w.balance(EXTERNAL_ACCOUNT)).toBe(-100_000);
      const [entry] = w.entries('alice');
      expect(entry).toMatchObject({ accountId: 'alice', direction: 'CREDIT', amountPaise: 100_000, at: 1_000 });
    });

    it('moves money with a transfer and keeps debits equal to credits', () => {
      const { w } = makeWallet();
      const t = w.transfer({ from: 'alice', to: 'bob', amountPaise: 25_050, idempotencyKey: 'k1' });
      expect(t).toMatchObject({ type: 'TRANSFER', from: 'alice', to: 'bob', amountPaise: 25_050 });
      expect(w.balance('alice')).toBe(74_950);
      expect(w.balance('bob')).toBe(25_050);
      const { debits, credits } = w.trialBalance();
      expect(debits).toBe(credits);
    });

    it('writes one debit and one credit per transfer', () => {
      const { w } = makeWallet();
      const t = w.transfer({ from: 'alice', to: 'bob', amountPaise: 500, idempotencyKey: 'k1' });
      const legs = [...w.entries('alice'), ...w.entries('bob')].filter((e) => e.transactionId === t.id);
      expect(legs.map((e) => [e.accountId, e.direction])).toEqual([
        ['alice', 'DEBIT'],
        ['bob', 'CREDIT'],
      ]);
    });
  });

  describe('validation', () => {
    it('rejects insufficient funds and writes nothing', () => {
      const { w } = makeWallet();
      const before = w.entries('alice').length;
      expect(() => w.transfer({ from: 'alice', to: 'bob', amountPaise: 100_001, idempotencyKey: 'k1' })).toThrow(/insufficient/i);
      expect(w.entries('alice')).toHaveLength(before);
      expect(w.balance('bob')).toBe(0);
    });

    it('accepts only positive integer paise', () => {
      const { w } = makeWallet();
      for (const amountPaise of [0, -100, 10.5, Number.NaN]) {
        expect(() => w.transfer({ from: 'alice', to: 'bob', amountPaise, idempotencyKey: `k${amountPaise}` })).toThrow();
      }
      expect(() => w.deposit('bob', 99.99, 'dep-x')).toThrow();
    });

    it('rejects unknown accounts, self transfers and system accounts', () => {
      const { w } = makeWallet();
      expect(() => w.transfer({ from: 'alice', to: 'carol', amountPaise: 100, idempotencyKey: 'a' })).toThrow();
      expect(() => w.transfer({ from: 'alice', to: 'alice', amountPaise: 100, idempotencyKey: 'b' })).toThrow();
      expect(() => w.transfer({ from: EXTERNAL_ACCOUNT, to: 'bob', amountPaise: 100, idempotencyKey: 'c' })).toThrow();
      expect(() => w.openAccount('alice')).toThrow();
    });
  });

  describe('idempotency', () => {
    it('returns the same transaction on a retry and moves money once', () => {
      const { w } = makeWallet();
      const req = { from: 'alice', to: 'bob', amountPaise: 10_000, idempotencyKey: 'pay-42' };
      const first = w.transfer(req);
      const retry = w.transfer({ ...req });
      expect(retry.id).toBe(first.id);
      expect(w.balance('bob')).toBe(10_000);
    });

    it('rejects the same key with a different payload', () => {
      const { w } = makeWallet();
      w.transfer({ from: 'alice', to: 'bob', amountPaise: 10_000, idempotencyKey: 'pay-42' });
      expect(() => w.transfer({ from: 'alice', to: 'bob', amountPaise: 20_000, idempotencyKey: 'pay-42' })).toThrow();
      expect(w.balance('bob')).toBe(10_000);
    });

    it('does not burn the key when the request fails', () => {
      const { w } = makeWallet();
      const req = { from: 'bob', to: 'alice', amountPaise: 5_000, idempotencyKey: 'pay-7' };
      expect(() => w.transfer(req)).toThrow();
      w.deposit('bob', 5_000, 'dep-2');
      expect(() => w.transfer(req)).not.toThrow();
      expect(w.balance('bob')).toBe(0);
    });
  });

  describe('refunds', () => {
    it('reverses a transfer in full and links it to the original', () => {
      const { w } = makeWallet();
      const t = w.transfer({ from: 'alice', to: 'bob', amountPaise: 30_000, idempotencyKey: 'k1' });
      const r = w.refund(t.id, 'r1');
      expect(r).toMatchObject({ type: 'REFUND', from: 'bob', to: 'alice', amountPaise: 30_000, refundOf: t.id });
      expect(w.balance('alice')).toBe(100_000);
      expect(w.balance('bob')).toBe(0);
    });

    it('allows partial refunds up to the original amount, once per key', () => {
      const { w } = makeWallet();
      const t = w.transfer({ from: 'alice', to: 'bob', amountPaise: 30_000, idempotencyKey: 'k1' });
      w.refund(t.id, 'r1', 10_000);
      w.refund(t.id, 'r1', 10_000); // retry, no effect
      w.refund(t.id, 'r2', 15_000);
      expect(w.balance('bob')).toBe(5_000);
      expect(() => w.refund(t.id, 'r3', 5_001)).toThrow();
      w.refund(t.id, 'r4'); // the rest
      expect(w.balance('bob')).toBe(0);
      expect(() => w.refund(t.id, 'r5')).toThrow();
    });

    it('refuses to refund deposits, refunds, or unknown transactions', () => {
      const { w } = makeWallet();
      const dep = w.entries('alice')[0].transactionId;
      expect(() => w.refund(dep, 'r1')).toThrow();
      expect(() => w.refund('T999', 'r2')).toThrow();
      const t = w.transfer({ from: 'alice', to: 'bob', amountPaise: 100, idempotencyKey: 'k1' });
      const r = w.refund(t.id, 'r3');
      expect(() => w.refund(r.id, 'r4')).toThrow();
    });

    it('fails a refund when the payee already spent the money', () => {
      const { w } = makeWallet();
      w.openAccount('carol');
      const t = w.transfer({ from: 'alice', to: 'bob', amountPaise: 10_000, idempotencyKey: 'k1' });
      w.transfer({ from: 'bob', to: 'carol', amountPaise: 8_000, idempotencyKey: 'k2' });
      expect(() => w.refund(t.id, 'r1')).toThrow(/insufficient/i);
      expect(w.balance('alice')).toBe(90_000);
    });
  });

  describe('extensibility', () => {
    it('accepts any FeePolicy; the fee goes to the FEES account', () => {
      const onePercent: FeePolicy = { feeFor: (amount) => Math.floor(amount / 100) };
      const { w } = makeWallet(onePercent);
      const t = w.transfer({ from: 'alice', to: 'bob', amountPaise: 50_000, idempotencyKey: 'k1' });
      expect(t.feePaise).toBe(500);
      expect(w.balance('alice')).toBe(49_500);
      expect(w.balance('bob')).toBe(50_000);
      expect(w.balance(FEES_ACCOUNT)).toBe(500);
      expect(() => w.transfer({ from: 'alice', to: 'bob', amountPaise: 49_500, idempotencyKey: 'k2' })).toThrow();
      const { debits, credits } = w.trialBalance();
      expect(debits).toBe(credits);
    });
  });
});
