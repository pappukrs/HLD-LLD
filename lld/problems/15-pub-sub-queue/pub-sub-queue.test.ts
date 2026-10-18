import * as starter from './starter';
import * as reference from './reference';

// `npm test` checks your starter.ts; `npm run test:ref` checks the reference.
const { Broker } = (process.env.REF ? reference : starter) as typeof reference;
type Message = reference.Message;

// Deterministic hash for tests: 'k7' → 7.
const digitHash = (key: string) => Number(key.replace(/\D/g, ''));

function setup(partitions = 3) {
  const broker = new Broker({ hash: digitHash });
  broker.createTopic('orders', partitions);
  return broker;
}

const values = (msgs: Message[]) => msgs.map((m) => m.value);

describe('15 · Pub-Sub Queue (Kafka-lite)', () => {
  describe('publishing', () => {
    it('sends the same key to the same partition with increasing offsets', () => {
      const broker = setup();
      expect(broker.publish('orders', 'a', 'k4')).toEqual({ partition: 1, offset: 0 });
      expect(broker.publish('orders', 'b', 'k4')).toEqual({ partition: 1, offset: 1 });
      expect(broker.publish('orders', 'c', 'k3')).toEqual({ partition: 0, offset: 0 });
      expect(broker.endOffset('orders', 1)).toBe(2);
    });

    it('spreads keyless messages round-robin', () => {
      const broker = setup();
      const parts = ['a', 'b', 'c', 'd'].map((v) => broker.publish('orders', v).partition);
      expect(parts).toEqual([0, 1, 2, 0]);
    });

    it('the default hash also keeps a key on one partition', () => {
      const broker = new Broker();
      broker.createTopic('t', 8);
      const p = broker.publish('t', 'x', 'user-42').partition;
      for (let i = 0; i < 5; i++) expect(broker.publish('t', 'y', 'user-42').partition).toBe(p);
    });
  });

  describe('consumer groups', () => {
    it('a single consumer reads everything, in order within each partition', () => {
      const broker = setup();
      ['a', 'b', 'c', 'd', 'e'].forEach((v) => broker.publish('orders', v)); // p0: a,d  p1: b,e  p2: c
      const c = broker.subscribe('orders', 'billing', 'c1');
      expect(c.assignment()).toEqual([0, 1, 2]);
      expect(values(c.poll())).toEqual(['a', 'd', 'b', 'e', 'c']);
      expect(c.poll()).toEqual([]);
    });

    it('two groups each get every message, independently', () => {
      const broker = setup();
      ['a', 'b', 'c'].forEach((v) => broker.publish('orders', v));
      const billing = broker.subscribe('orders', 'billing', 'c1');
      const email = broker.subscribe('orders', 'email', 'c1'); // same id, different group: fine
      expect(billing.poll()).toHaveLength(3);
      expect(email.poll()).toHaveLength(3);
    });

    it('splits partitions inside a group with the range assignor, with no overlap', () => {
      const broker = setup();
      ['a', 'b', 'c', 'd', 'e', 'f'].forEach((v) => broker.publish('orders', v));
      const c1 = broker.subscribe('orders', 'g', 'c1');
      const c2 = broker.subscribe('orders', 'g', 'c2');
      expect(c1.assignment()).toEqual([0, 1]);
      expect(c2.assignment()).toEqual([2]);
      const all = [...values(c1.poll()), ...values(c2.poll())].sort();
      expect(all).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
    });

    it('leaves extra consumers idle when there are more consumers than partitions', () => {
      const broker = setup(2);
      const cs = ['c1', 'c2', 'c3'].map((id) => broker.subscribe('orders', 'g', id));
      expect(cs.map((c) => c.assignment())).toEqual([[0], [1], []]);
    });

    it('poll returns at most `max` and continues on the next poll', () => {
      const broker = setup(1);
      ['a', 'b', 'c'].forEach((v) => broker.publish('orders', v));
      const c = broker.subscribe('orders', 'g', 'c1');
      expect(values(c.poll(2))).toEqual(['a', 'b']);
      expect(values(c.poll(2))).toEqual(['c']);
    });
  });

  describe('offsets, rebalance and replay', () => {
    it('re-delivers uncommitted messages when a partition moves (at-least-once)', () => {
      const broker = setup(2);
      broker.publish('orders', 'p0-a', 'k0');
      broker.publish('orders', 'p1-a', 'k1');
      const c1 = broker.subscribe('orders', 'g', 'c1');
      expect(c1.poll()).toHaveLength(2); // polled, NOT committed

      const c2 = broker.subscribe('orders', 'g', 'c2'); // rebalance: p1 moves to c2
      expect(c1.assignment()).toEqual([0]);
      expect(values(c2.poll())).toEqual(['p1-a']); // delivered again
      expect(c1.poll()).toEqual([]); // c1 kept p0 and its position
    });

    it('a new consumer resumes from the committed offset', () => {
      const broker = setup(1);
      ['a', 'b', 'c'].forEach((v) => broker.publish('orders', v));
      const c1 = broker.subscribe('orders', 'g', 'c1');
      c1.poll(2);
      c1.commit();
      expect(broker.committed('g', 'orders', 0)).toBe(2);
      c1.close();

      const c2 = broker.subscribe('orders', 'g', 'c2');
      expect(values(c2.poll())).toEqual(['c']);
    });

    it('seek replays from an older offset', () => {
      const broker = setup(1);
      ['a', 'b', 'c'].forEach((v) => broker.publish('orders', v));
      const c = broker.subscribe('orders', 'g', 'c1');
      c.poll();
      c.seek(0, 1);
      expect(values(c.poll())).toEqual(['b', 'c']);
      expect(() => c.seek(0, 99)).toThrow();
      expect(() => c.seek(5, 0)).toThrow(); // not assigned
    });

    it('when a consumer leaves, its partitions go to the others', () => {
      const broker = setup(2);
      const c1 = broker.subscribe('orders', 'g', 'c1');
      const c2 = broker.subscribe('orders', 'g', 'c2');
      c2.close();
      expect(c1.assignment()).toEqual([0, 1]);
      expect(() => c2.poll()).toThrow();
    });
  });

  describe('errors', () => {
    it('rejects unknown topics, duplicate topics, bad partition counts and duplicate consumer ids', () => {
      const broker = setup();
      expect(() => broker.publish('nope', 'x')).toThrow();
      expect(() => broker.subscribe('nope', 'g', 'c1')).toThrow();
      expect(() => broker.createTopic('orders', 3)).toThrow();
      expect(() => broker.createTopic('empty', 0)).toThrow();
      broker.subscribe('orders', 'g', 'c1');
      expect(() => broker.subscribe('orders', 'g', 'c1')).toThrow();
    });
  });

  describe('extensibility', () => {
    it('accepts any AssignmentStrategy', () => {
      const allToFirst = {
        assign: (n: number, ids: readonly string[]) =>
          new Map(ids.map((id, i) => [id, i === 0 ? Array.from({ length: n }, (_, p) => p) : []])),
      };
      const broker = new Broker({ assignor: allToFirst });
      broker.createTopic('orders', 3);
      const c1 = broker.subscribe('orders', 'g', 'c1');
      const c2 = broker.subscribe('orders', 'g', 'c2');
      expect(c1.assignment()).toEqual([0, 1, 2]);
      expect(c2.assignment()).toEqual([]);
    });
  });
});
