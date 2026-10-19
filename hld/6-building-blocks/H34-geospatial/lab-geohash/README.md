# 06 · Geohash encode, decode, neighbours

> Time box: **60 min**
> Concept: [Geospatial indexing](../README.md) · Visual: [v17 geohash and quadtree](../visual.html)

## What it is

A geohash turns a `(lat, lon)` point into a short string like `tdr1y`. Each character makes the cell smaller. Points that are close usually share a long prefix. So a normal string index (B-tree, Redis sorted set) can answer "what is near me?" with a **prefix query**.

How it works:

1. Start with the whole world: lon `[-180, 180]`, lat `[-90, 90]`.
2. Bit 0: is `lon` in the upper half? Write 1 and keep the upper half, else 0 and keep the lower half.
3. Bit 1: same for `lat`. Then lon again, then lat, and so on (bits are **interleaved**, longitude first).
4. Every 5 bits become one character of the base32 alphabet `0123456789bcdefghjkmnpqrstuvwxyz`.

| Length | Cell size (approx., at the equator) |
|---|---|
| 4 | 39 km × 20 km |
| 5 | 4.9 km × 4.9 km |
| 6 | 1.2 km × 0.6 km |
| 7 | 153 m × 153 m |
| 8 | 38 m × 19 m |

**The edge problem:** two points 10 m apart can sit on two sides of a cell border and share no prefix at all. So a "nearby" search always queries the cell **and its 8 neighbours**.

## Where it is used

- **Redis `GEOADD` / `GEOSEARCH`**: stores a 52-bit geohash as the score in a sorted set.
- **Elasticsearch, MongoDB, DynamoDB geo libraries**: geohash or similar grid indexes.
- **Uber, Lyft, Swiggy, Zomato, Yelp**: find drivers, restaurants or places near a user. (Uber later moved to H3 hexagons.)

## API to implement (`starter.ts`)

```ts
encode(57.64911, 10.40744, 11);   // → 'u4pruydqqvj'   (precision 1..12, default 9)
bounds('s');                      // → { minLat: 0, maxLat: 45, minLon: 0, maxLon: 45 }
decode('ezs42');                  // → { lat: 42.605, lon: -5.603, latErr: 0.022, lonErr: 0.022 }
adjacent('gbsuv', 'n');           // → 'gbsvj'
neighbours('gbsuv');              // → { n, ne, e, se, s, sw, w, nw }
```

Rules the tests check:

| Rule | Detail |
|---|---|
| Bit order | Bit 0 is longitude. Upper half (`>= mid`) is 1. |
| Validation | `lat` in `[-90, 90]`, `lon` in `[-180, 180]`, precision integer `1..12`. Bad hash characters throw. |
| `decode` | Centre of the cell. `latErr`/`lonErr` are half the cell height/width. |
| Neighbours | Same length as the input. Each one shares an edge (or a corner) with the cell. |
| Seam | Longitude wraps: the east neighbour of a cell at lon 179.99 is the cell at lon -179.99. |
| Poles | There is no cell north of the top row. `adjacent` returns `null`. |

## Complexity

`encode`, `decode`, `adjacent` are all `O(precision)`. `neighbours` is `8 × O(precision)`.

## Hints

<details>
<summary>Hint 1: one loop for encode</summary>

Keep four numbers (`latMin`, `latMax`, `lonMin`, `lonMax`), a flag `evenBit` (true means longitude), and the current 5-bit value `ch`. Each step: compare with the middle, shift `ch` left, maybe add 1, shrink the range, flip the flag. After 5 bits, append `BASE32[ch]` and reset `ch`.

</details>

<details>
<summary>Hint 2: decode is the same loop backwards</summary>

For each character, look up its value (0..31). Read its 5 bits from the highest (`(v >> 4) & 1`) to the lowest. Each bit tells you which half to keep. At the end you have the cell bounds.

</details>

<details>
<summary>Hint 3: the easy way to find a neighbour</summary>

Decode the cell. Move the centre by one full cell (`2 × latErr` or `2 × lonErr`) in the direction you want. Encode again with the same precision. Fix the longitude if it went past ±180. Return `null` if the latitude went past ±90.

There is also a faster table-based method that changes only the last characters. You do not need it here.

</details>

<details>
<summary>Hint 4: radius search with geohash</summary>

Pick the precision where the cell is a bit bigger than the search radius. Take the cell of the user and its 8 neighbours: 9 prefix queries. Then compute the real distance (haversine) for each result and drop the ones that are too far.

</details>

## Extensions interviewers ask

1. **Which precision for "drivers within 2 km"?** Precision 5 (about 4.9 km cells) with 9 cells covers it.
2. **Geohash vs quadtree.** A quadtree adapts to density (more splits in a city, fewer in the desert). A geohash grid is fixed but needs no tree and works with any string index.
3. **Moving objects.** 1M drivers send a location every 4 seconds. Where do you store the geohash? Redis with `GEOADD`, sharded by city.
4. **Near the poles** cells get very thin. Why? Longitude lines meet at the poles. This is one reason Uber built H3.
5. **Hilbert curves and S2 (Google)**: better locality than geohash's Z-order curve.

## Related

- HLD problems: [Proximity service](../../../case-studies/22-proximity-service/README.md) · [Ride hailing](../../../case-studies/10-ride-hailing/README.md) · [Food delivery](../../../case-studies/11-food-delivery/README.md)
