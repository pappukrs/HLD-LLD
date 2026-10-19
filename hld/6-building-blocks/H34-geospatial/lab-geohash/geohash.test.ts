import * as starter from './starter';
import * as reference from './reference';

// `npm test` checks your starter.ts; `npm run test:ref` checks the reference.
const { encode, decode, bounds, adjacent, neighbours, DIRECTIONS } = (process.env.REF ? reference : starter) as typeof reference;

/** Deterministic pseudo-random numbers (LCG), so tests are repeatable. */
function rng(seed: number) {
  return () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
}

describe('06 · Geohash', () => {
  it('encodes known points', () => {
    expect(encode(57.64911, 10.40744, 11)).toBe('u4pruydqqvj'); // Jutland, from the original geohash.org example
    expect(encode(37.7749, -122.4194, 6)).toBe('9q8yyk'); // San Francisco
    expect(encode(0, 0, 1)).toBe('s');
  });

  it('decodes to the cell centre with an error margin', () => {
    const d = decode('ezs42');
    expect(d.lat).toBeCloseTo(42.605, 3);
    expect(d.lon).toBeCloseTo(-5.603, 3);
    expect(d.latErr).toBeCloseTo(0.022, 3);
    expect(d.lonErr).toBeCloseTo(0.022, 3);
    expect(bounds('s')).toEqual({ minLat: 0, maxLat: 45, minLon: 0, maxLon: 45 });
  });

  it('round trip: the decoded cell always contains the original point (property check)', () => {
    const rand = rng(7);
    for (let i = 0; i < 2000; i++) {
      const lat = rand() * 180 - 90;
      const lon = rand() * 360 - 180;
      const p = 1 + (i % 12);
      const b = bounds(encode(lat, lon, p));
      expect(lat).toBeGreaterThanOrEqual(b.minLat);
      expect(lat).toBeLessThanOrEqual(b.maxLat);
      expect(lon).toBeGreaterThanOrEqual(b.minLon);
      expect(lon).toBeLessThanOrEqual(b.maxLon);
    }
  });

  it('a shorter hash is a prefix of a longer one for the same point', () => {
    const rand = rng(11);
    for (let i = 0; i < 500; i++) {
      const lat = rand() * 180 - 90;
      const lon = rand() * 360 - 180;
      expect(encode(lat, lon, 12).startsWith(encode(lat, lon, 5))).toBe(true);
    }
  });

  it('rejects bad input', () => {
    expect(() => encode(91, 0)).toThrow();
    expect(() => encode(0, -181)).toThrow();
    expect(() => encode(0, 0, 0)).toThrow();
    expect(() => encode(0, 0, 13)).toThrow();
    expect(() => decode('')).toThrow();
    expect(() => decode('abc')).toThrow(); // 'a' is not in the alphabet
  });

  it('finds the 8 neighbours of a known cell', () => {
    expect(neighbours('gbsuv')).toEqual({
      n: 'gbsvj', ne: 'gbsvn', e: 'gbsuy', se: 'gbsuw',
      s: 'gbsut', sw: 'gbsus', w: 'gbsuu', nw: 'gbsvh',
    });
  });

  it('every neighbour touches the cell (property check)', () => {
    const rand = rng(3);
    for (let i = 0; i < 300; i++) {
      // Stay away from the poles and the ±180 seam here; the next test covers those.
      const hash = encode(rand() * 160 - 80, rand() * 340 - 170, 3 + (i % 7));
      const c = bounds(hash);
      for (const dir of DIRECTIONS) {
        const nb = adjacent(hash, dir)!;
        expect(nb).toHaveLength(hash.length);
        const b = bounds(nb);
        if (dir.includes('n')) expect(b.minLat).toBeCloseTo(c.maxLat, 9);
        if (dir.includes('s')) expect(b.maxLat).toBeCloseTo(c.minLat, 9);
        if (dir.includes('e')) expect(b.minLon).toBeCloseTo(c.maxLon, 9);
        if (dir.includes('w')) expect(b.maxLon).toBeCloseTo(c.minLon, 9);
        if (dir === 'n' || dir === 's') expect(b.minLon).toBeCloseTo(c.minLon, 9);
        if (dir === 'e' || dir === 'w') expect(b.minLat).toBeCloseTo(c.minLat, 9);
      }
    }
  });

  it('wraps longitude at ±180 and returns null past a pole', () => {
    const eastEdge = encode(10, 179.99, 5);
    expect(adjacent(eastEdge, 'e')).toBe(encode(10, -179.99, 5));
    const top = encode(89.99, 0, 3);
    expect(adjacent(top, 'n')).toBeNull();
    expect(neighbours(top).ne).toBeNull();
    expect(adjacent(top, 's')).not.toBeNull();
  });
});
