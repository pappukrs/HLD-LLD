// 06 · Geohash encode, decode, neighbours: your implementation goes here.
// Keep the exported names and signatures; the tests import them.
// Run: npx vitest run hld/code/06-geohash

/** Geohash base32: digits and lowercase letters without a, i, l, o. */
export const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

export interface Bounds {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

export interface Decoded {
  /** Centre of the cell. */
  lat: number;
  lon: number;
  /** Half the cell height / width: the true point is within ± this. */
  latErr: number;
  lonErr: number;
}

export type Direction = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';

export const DIRECTIONS: readonly Direction[] = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];

/**
 * Bit 0 splits longitude, bit 1 latitude, bit 2 longitude, ... (1 = upper half).
 * Every 5 bits → one BASE32 char. Throws on bad lat/lon or precision outside 1..12.
 */
export function encode(lat: number, lon: number, precision = 9): string {
  throw new Error('TODO');
}

/** The rectangle a geohash stands for. Throws on '' or a bad character. */
export function bounds(hash: string): Bounds {
  throw new Error('TODO');
}

/** Centre of the cell, plus half its height and width. */
export function decode(hash: string): Decoded {
  throw new Error('TODO');
}

/** The cell next to `hash`, same length. Longitude wraps at ±180. Past a pole: null. */
export function adjacent(hash: string, dir: Direction): string | null {
  throw new Error('TODO');
}

/** All 8 neighbours. */
export function neighbours(hash: string): Record<Direction, string | null> {
  throw new Error('TODO');
}
