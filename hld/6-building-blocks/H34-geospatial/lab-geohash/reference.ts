// 06 · Geohash encode, decode, neighbours: reference solution.
// Read this only after your own attempt passes.

/** Geohash base32: digits and lowercase letters without a, i, l, o. */
export const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';
const VALUE_OF = new Map<string, number>([...BASE32].map((ch, i) => [ch, i]));

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

const STEP: Record<Direction, [dLat: number, dLon: number]> = {
  n: [1, 0], ne: [1, 1], e: [0, 1], se: [-1, 1],
  s: [-1, 0], sw: [-1, -1], w: [0, -1], nw: [1, -1],
};

/**
 * Interleave bits: even bits (0, 2, 4, ...) split longitude, odd bits split latitude.
 * Each 5 bits become one base32 character.
 */
export function encode(lat: number, lon: number, precision = 9): string {
  if (!(lat >= -90 && lat <= 90)) throw new Error('lat must be in [-90, 90]');
  if (!(lon >= -180 && lon <= 180)) throw new Error('lon must be in [-180, 180]');
  if (!Number.isInteger(precision) || precision < 1 || precision > 12) throw new Error('precision must be 1..12');

  let latMin = -90, latMax = 90, lonMin = -180, lonMax = 180;
  let hash = '';
  let bit = 0;
  let ch = 0;
  let evenBit = true; // true → this bit is for longitude

  while (hash.length < precision) {
    if (evenBit) {
      const mid = (lonMin + lonMax) / 2;
      if (lon >= mid) { ch = (ch << 1) | 1; lonMin = mid; } else { ch <<= 1; lonMax = mid; }
    } else {
      const mid = (latMin + latMax) / 2;
      if (lat >= mid) { ch = (ch << 1) | 1; latMin = mid; } else { ch <<= 1; latMax = mid; }
    }
    evenBit = !evenBit;
    if (++bit === 5) {
      hash += BASE32[ch];
      bit = 0;
      ch = 0;
    }
  }
  return hash;
}

/** The rectangle a geohash stands for. */
export function bounds(hash: string): Bounds {
  if (hash.length === 0) throw new Error('empty geohash');
  let latMin = -90, latMax = 90, lonMin = -180, lonMax = 180;
  let evenBit = true;
  for (const c of hash.toLowerCase()) {
    const v = VALUE_OF.get(c);
    if (v === undefined) throw new Error(`Invalid geohash character: ${c}`);
    for (let b = 4; b >= 0; b--) {
      const on = (v >> b) & 1;
      if (evenBit) {
        const mid = (lonMin + lonMax) / 2;
        if (on) lonMin = mid; else lonMax = mid;
      } else {
        const mid = (latMin + latMax) / 2;
        if (on) latMin = mid; else latMax = mid;
      }
      evenBit = !evenBit;
    }
  }
  return { minLat: latMin, maxLat: latMax, minLon: lonMin, maxLon: lonMax };
}

export function decode(hash: string): Decoded {
  const b = bounds(hash);
  return {
    lat: (b.minLat + b.maxLat) / 2,
    lon: (b.minLon + b.maxLon) / 2,
    latErr: (b.maxLat - b.minLat) / 2,
    lonErr: (b.maxLon - b.minLon) / 2,
  };
}

/**
 * The cell next to `hash` in one direction, same precision.
 * Longitude wraps at ±180. Past a pole there is no cell, so it returns null.
 * Method: step from the centre by one full cell, then encode again.
 */
export function adjacent(hash: string, dir: Direction): string | null {
  const d = decode(hash);
  const [dLat, dLon] = STEP[dir];
  const lat = d.lat + dLat * 2 * d.latErr;
  if (lat > 90 || lat < -90) return null;
  let lon = d.lon + dLon * 2 * d.lonErr;
  if (lon > 180) lon -= 360;
  if (lon < -180) lon += 360;
  return encode(lat, lon, hash.length);
}

/** All 8 neighbours. Used for "nearby" search: query the cell and its 8 neighbours. */
export function neighbours(hash: string): Record<Direction, string | null> {
  const out = {} as Record<Direction, string | null>;
  for (const dir of DIRECTIONS) out[dir] = adjacent(hash, dir);
  return out;
}
