import * as starter from './starter';
import * as reference from './reference';

// `npm test` checks your starter.ts; `npm run test:ref` checks the reference.
const { Autocomplete, compareSuggestions } = (process.env.REF ? reference : starter) as typeof reference;

const words = (s: { word: string }[]) => s.map((x) => x.word);

function sample() {
  const ac = new Autocomplete();
  ac.insert('car', 50);
  ac.insert('card', 20);
  ac.insert('care', 20);
  ac.insert('careful', 5);
  ac.insert('cart', 40);
  ac.insert('cat', 100);
  ac.insert('dog', 70);
  return ac;
}

describe('07 · Trie autocomplete', () => {
  it('returns the top k by frequency for a prefix', () => {
    const ac = sample();
    expect(ac.suggest('ca', 3)).toEqual([
      { word: 'cat', frequency: 100 },
      { word: 'car', frequency: 50 },
      { word: 'cart', frequency: 40 },
    ]);
  });

  it('breaks ties lexicographically', () => {
    const ac = sample();
    expect(words(ac.suggest('car', 10))).toEqual(['car', 'cart', 'card', 'care', 'careful']);
    expect(compareSuggestions({ word: 'b', frequency: 1 }, { word: 'a', frequency: 1 })).toBeGreaterThan(0);
    expect(compareSuggestions({ word: 'b', frequency: 2 }, { word: 'a', frequency: 1 })).toBeLessThan(0);
  });

  it('includes the prefix itself when it is a word', () => {
    const ac = sample();
    expect(words(ac.suggest('care', 5))).toEqual(['care', 'careful']);
  });

  it('adds up frequencies when a word is inserted again', () => {
    const ac = sample();
    ac.insert('careful', 96); // 5 + 96 = 101, now above 'cat'
    expect(ac.frequency('careful')).toBe(101);
    expect(ac.suggest('c', 1)).toEqual([{ word: 'careful', frequency: 101 }]);
    expect(ac.size).toBe(7);
  });

  it('defaults frequency to 1 and counts each insert', () => {
    const ac = new Autocomplete();
    ac.insert('a');
    ac.insert('a');
    ac.insert('ab');
    expect(ac.suggest('a', 5)).toEqual([
      { word: 'a', frequency: 2 },
      { word: 'ab', frequency: 1 },
    ]);
  });

  it('handles empty results, k <= 0, and the empty prefix', () => {
    const ac = sample();
    expect(ac.suggest('x', 5)).toEqual([]);
    expect(ac.suggest('cars', 5)).toEqual([]);
    expect(ac.suggest('ca', 0)).toEqual([]);
    expect(words(ac.suggest('', 2))).toEqual(['cat', 'dog']);
    expect(ac.frequency('ca')).toBe(0); // a prefix, not a word
  });

  it('rejects bad input', () => {
    const ac = new Autocomplete();
    expect(() => ac.insert('', 1)).toThrow();
    expect(() => ac.insert('a', 0)).toThrow();
    expect(() => ac.insert('a', 1.5)).toThrow();
  });

  it('matches a brute-force answer on random data (property check)', () => {
    let seed = 99;
    const rand = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
    const ac = new Autocomplete();
    const truth = new Map<string, number>();
    for (let i = 0; i < 3000; i++) {
      const len = 1 + Math.floor(rand() * 6);
      let w = '';
      for (let j = 0; j < len; j++) w += 'abcd'[Math.floor(rand() * 4)];
      const f = 1 + Math.floor(rand() * 5);
      ac.insert(w, f);
      truth.set(w, (truth.get(w) ?? 0) + f);
    }
    for (const prefix of ['', 'a', 'b', 'ab', 'dc', 'abc', 'cccc']) {
      const expected = [...truth]
        .filter(([w]) => w.startsWith(prefix))
        .map(([word, frequency]) => ({ word, frequency }))
        .sort((x, y) => y.frequency - x.frequency || (x.word < y.word ? -1 : 1))
        .slice(0, 10);
      expect(ac.suggest(prefix, 10)).toEqual(expected);
    }
  });
});
