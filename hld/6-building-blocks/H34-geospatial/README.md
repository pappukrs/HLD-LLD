# H34 · Geospatial: geohash and quadtree

> **Time:** ~50 min · **Visual:** [visual.html](visual.html) · **Code:** [demo.ts](demo.ts) (`npx tsx hld/6-building-blocks/H34-geospatial/demo.ts`) · **Lab:** [lab-geohash](lab-geohash/README.md)
> **Builds on:** [H11 Indexing](../../3-databases/H11-indexing/README.md) · [H09 Caching](../../2-scaling/H09-caching/README.md) · [H16 Partitioning and sharding](../../3-databases/H16-partitioning-sharding/README.md) · **Used in:** Proximity service, Ride hailing, Food delivery, Hotel booking

## The idea in one line

Turn a 2-D location into a 1-D key that a normal index can search: cut the map into cells (geohash, quadtree, S2, H3), index each point by its cell, and answer "near me" by reading your cell plus its neighbours, then filtering by exact distance.

## Why it matters (the problem it solves)

"Find drivers within 2 km" with plain columns:

```sql
SELECT id FROM drivers
WHERE lat BETWEEN 12.95 AND 12.99 AND lng BETWEEN 77.57 AND 77.61;
```

- A B-tree on `lat` returns a thin band that crosses the whole country. A B-tree on `lng` returns another band. The database intersects two huge sets.
- With 500k drivers and thousands of searches per second, that is far too slow.
- You need an index where **points close in space are close in the index**. That is what a geohash, a quadtree, S2 and H3 give you.

Every "near me" question in an interview needs this: Uber/Ola matching, Swiggy/Zomato restaurants and delivery partners, Yelp, hotel search, store locators.

## How it works

### 1. Geohash: interleave the bits

1. Split longitude `[-180, 180]` in half. Right half = 1, left half = 0. Keep the half the point is in.
2. Split latitude `[-90, 90]` the same way. Then longitude again, then latitude. The bits **interleave**.
3. Every 5 bits become one base32 character (`0-9 b-z`, without `a i l o`).

```
MG Road, Bengaluru (12.9716, 77.5946)
  length 3  tdr       ~156 km cell
  length 5  tdr1v     ~4.9 km cell
  length 6  tdr1v9    ~1.2 km x 0.6 km
  length 7  tdr1v9q   ~153 m cell
Each extra character = 5 more bits = a cell 32x smaller.
```

Points in the same cell share a **prefix**. So "near me" becomes a **prefix range scan** on any sorted index: a B-tree string column, a Redis sorted set, a DynamoDB sort key.

```sql
SELECT id FROM drivers WHERE geohash LIKE 'tdr1v%';   -- one range on one index
```

The bits trace a **Z-order curve**: it walks the map in a Z pattern, so most of the time nearby points get nearby keys.

### 2. The edge problem: always read 9 cells

Two points 11 m apart can sit on either side of a cell border:

```
 +---------+---------+
 | tdr1v   | tdr1y   |       rider (x) is in tdr1v
 |       x | D2      |       D2 is 1 km away but in tdr1y
 +---------+---------+       prefix 'tdr1v%' never sees D2
```

Fix: query the rider's cell **and its 8 neighbours**, then compute the real distance (haversine) for each candidate, drop those outside the radius, and sort.

```
 +-------+-------+-------+
 | nw    | n     | ne    |
 +-------+-------+-------+
 | w     | HOME  | e     |    9 prefix scans
 +-------+-------+-------+    -> candidates
 | sw    | s     | se    |    -> haversine filter
 +-------+-------+-------+    -> sort, LIMIT k
```

**Pick the length so a cell is a bit bigger than the radius.** For 2 km, use length 5 (4.9 km cells): 9 cells cover about 15 km × 15 km, which surely contains the 4 km circle. Length 6 cells are only 0.6 km tall, so 9 of them are 1.8 km tall: too small.

### 3. Quadtree: split only where it is busy

A fixed grid ignores density. Downtown Mumbai puts 3,000 drivers in one cell. A village cell has zero.

```
Start: one square for the city.
If a square holds > K points (say 100), split it into 4 children. Repeat.

 +-------+---+---+
 |       | . |. .|     dense area  -> deep, small leaves
 |   .   +-+-+---+     empty area  -> one big leaf
 |       |.|.| . |     every leaf holds <= K points
 +-------+-+-+---+
```

- **Search:** walk from the root to the leaf that holds the user (`O(depth)`, about 8-15 levels), then check that leaf and its neighbour leaves until you have k results.
- Usually built **in memory** on each search server from the DB at startup (a few minutes for 200M places), and rebuilt or updated in the background.
- Best for **static places with uneven density** (Yelp, Google Places). Moving points are harder: a driver leaving a leaf can trigger merges and splits.

### 4. S2 and H3

| | Google S2 | Uber H3 |
|---|---|---|
| Shape | Squares on a cube projected to the sphere | Hexagons (plus 12 pentagons) |
| Ordering | Hilbert curve: better locality than geohash's Z-curve | Hierarchical index, 16 resolutions |
| Cell id | 64-bit integer, levels 0-30 | 64-bit integer, resolutions 0-15 |
| Superpower | Covering any polygon (a delivery zone) with a few cells | All 6 neighbours are the same distance away: clean "rings" |
| Used by | Google Maps, Foursquare, MongoDB 2dsphere | Uber surge pricing, supply/demand maps |

### 5. Moving objects: drivers and delivery partners

```
Driver app --(location every 4 s)--> Location service --+--> Redis GEO (sharded by city)
                                                        |       GEOADD drivers:blr lng lat D42
                                                        +--> Kafka "locations" --> history store,
                                                                                   ETA models, trip replay
Matching service --> GEOSEARCH drivers:blr FROMLONLAT lng lat BYRADIUS 2 km ASC COUNT 20
                 --> rank the 20 candidates by road ETA (routing service), not straight line
```

- **Current location is ephemeral.** It changes every 4 s and the next update repairs any loss. Keep it in memory, not in a Postgres row with a GiST index you update 125k times a second.
- **Redis GEO** is a sorted set. The score is a 52-bit geohash. `GEOADD` is `O(log n)`. `GEOSEARCH` scans the 9 cell ranges and filters by distance for you.
- **Shard by city** (or by a coarse geohash prefix) so no single key holds the whole country.
- **Stale drivers:** keep `last_seen` per driver and drop entries older than ~30 s (a sweeper, or a per-minute key that expires).
- **Static places** (restaurants, hotels) stay in the database: a geohash column with a B-tree index, or PostGIS, or Elasticsearch `geo_point`.

### 6. Geo index = filter, routing = ranking

Straight-line distance lies: the nearest driver may be across a river or on a one-way flyover. Use the geo index to get ~20 candidates fast, then call a routing/ETA service and pick by ETA.

## In TypeScript

```ts
const B32 = '0123456789bcdefghjkmnpqrstuvwxyz';

function encode(lat: number, lon: number, len: number): string {
  const la = [-90, 90], lo = [-180, 180];
  let out = '', bits = 0, ch = 0, even = true;          // even bit = longitude
  while (out.length < len) {
    const r = even ? lo : la, v = even ? lon : lat, mid = (r[0] + r[1]) / 2;
    if (v >= mid) { ch = ch * 2 + 1; r[0] = mid; } else { ch = ch * 2; r[1] = mid; }
    even = !even;
    if (++bits === 5) { out += B32[ch]; bits = 0; ch = 0; }
  }
  return out;
}

// Radius search: 9 cells -> candidates -> exact distance -> sort.
const cells = nineCells(encode(rider.lat, rider.lon, 5));
const near = cells.flatMap((c) => index.get(c) ?? [])
  .filter((d) => haversineKm(rider, d) <= 2)
  .sort((a, b) => haversineKm(rider, a) - haversineKm(rider, b))
  .slice(0, 20);
```

[demo.ts](demo.ts) indexes 20,000 drivers around Bengaluru, shows that the 9-cell search returns exactly what a brute-force scan returns while reading fewer rows, prints an 11 m pair with different geohashes, and builds a quadtree over the same points.

## Trade-offs / when NOT to use it

| Option | Use when | Weakness |
|---|---|---|
| Lat/lng B-tree ranges | A few thousand points | Two wide bands; slow at scale |
| Geohash (string column / Redis GEO) | Simple radius search; easy to shard by prefix; cheap updates | Fixed cell size; edge problem; uneven density |
| Quadtree (in memory) | Static places, very uneven density, k-nearest | Must build and hold in memory; moving points cause splits/merges |
| S2 | Polygons, delivery zones, region covering | Harder to explain and debug |
| H3 | Equal-distance neighbours, surge zones, analytics by area | Hexagons do not nest perfectly |
| PostGIS (R-tree via GiST) / ES `geo_point` | Polygons + joins + filters with the data | Not built for 100k location writes per second |

When NOT to build any of this: a store locator with 500 stores. Load them into memory and compute the distance to all of them. It takes microseconds.

## Common mistakes

- **Querying only the user's cell.** The edge problem misses the closest point. Always 9 cells (or a covering).
- **Picking a cell much smaller than the radius**, then reading 9 cells that do not cover the circle.
- **Returning cells, not distances.** A cell is a filter. You still compute haversine and sort.
- **Putting live driver locations in the main SQL database.** 125k updates per second cause index churn, WAL and vacuum pressure. Use Redis and stream history to Kafka.
- **One global Redis key** for all drivers. Shard by city or prefix.
- **Ranking by straight-line distance** for dispatch instead of road ETA.
- **Forgetting stale entries**: a driver who lost network still shows as "nearby".
- Saying "geohash prefix similarity = distance". Shared prefix means close; a different prefix does not mean far.

## Say this in the interview

> "Restaurants are static, so they live in Postgres with a geohash column and a B-tree index, or PostGIS. To search 2 km around the user I take the user's length-5 geohash (about 4.9 km cells), query that cell and its 8 neighbours, compute the real distance for each candidate, filter and rank. I read 9 cells because two points 10 m apart can sit across a cell border."

> "Delivery partners move, so their location is ephemeral. The app sends it every 4 seconds to a location service, which writes to Redis GEO sharded by city. 500k partners every 4 seconds is 125k writes per second, which Redis handles in memory and a SQL index would not. Matching runs GEOSEARCH for the 20 nearest, then ranks them by road ETA. The raw stream also goes to Kafka for history and ETA models."

> "If density varies a lot, for example 3,000 restaurants in one downtown cell and none in a village, I would use a quadtree that splits busy cells, or widen the search by dropping one geohash character until I have enough results."

## Your experience hook

- **IoT platform, 10k+ devices:** "I have run a pipeline where thousands of devices push data every few seconds. The same rule applies to driver locations: keep the latest value in Redis, batch or stream the history, and never update a SQL row per ping."
- **WebSockets at scale:** the driver app's location updates and the rider's live map are the same pattern as my Socket.io servers behind Nginx with a Redis adapter: a persistent connection per device and fan-out of events across nodes.

## Numbers to remember

| Geohash length | Cell size (approx., at the equator) |
|---|---|
| 4 | 39 km × 19.5 km |
| 5 | 4.9 km × 4.9 km |
| 6 | 1.2 km × 0.61 km |
| 7 | 153 m × 153 m |
| 8 | 38 m × 19 m |

- 1° latitude ≈ **111 km**. 1° longitude ≈ 111 km × cos(latitude) ≈ **108 km at Bengaluru** (13° N).
- 500k active drivers / 4 s ≈ **125k writes per second**.
- One location record (id, lat, lng, ts) ≈ 30-50 bytes. 500k drivers ≈ **25 MB**. 10M places ≈ a few hundred MB.
- Redis GEO: geohash score is **52 bits** (≈ 0.6 m precision). `GEOADD` is O(log n).
- Quadtree for 200M places with 100 per leaf ≈ 2M leaves, depth ~12-15, a few GB in memory.

## Self-test

<details><summary>1. Why can't a B-tree on (lat, lng) answer "near me" well?</summary>

A composite index sorts by lat first, so it can only narrow lat to a band; lng is then filtered row by row across that whole band. Two separate indexes give two huge bands to intersect. A geohash maps 2-D to 1-D so that one range scan covers a small area.
</details>

<details><summary>2. Why query 9 geohash cells instead of 1?</summary>

The user can be near a cell border. A point 10 m away across the border has a different prefix. The 8 neighbours catch it.
</details>

<details><summary>3. Which length for "drivers within 2 km"? Why not length 6?</summary>

Length 5 (4.9 km). Nine length-6 cells are about 3.6 km wide and 1.8 km tall, which does not cover a 4 km wide circle, so you would need many more cells.
</details>

<details><summary>4. Two geohashes share the prefix "tdr1". What does that tell you? What doesn't it?</summary>

Both points are in the same ~39 km × 19.5 km cell. It does not tell you that points with different prefixes are far apart: they can be metres apart across a border.
</details>

<details><summary>5. 500k drivers update every 4 s. Why not Postgres + PostGIS?</summary>

125k writes per second, each updating a GiST index, writing WAL and creating dead tuples for vacuum. The current position does not need durability. Redis GEO in memory, sharded by city, handles it easily; Kafka keeps the history.
</details>

<details><summary>6. Your 9 cells return 5,000 restaurants downtown and 0 in a village. Fix?</summary>

Adaptive precision: start fine and drop one character (32x bigger cell) until you have enough results, and cap/rank them. Or use a quadtree or S2 covering, which adapts to density.
</details>

<details><summary>7. The nearest driver by distance is across a river. What do you do?</summary>

Geo index for candidates (top 20 by distance), then a routing service computes road ETA and you pick by ETA. Filter with geo, rank with routing.
</details>

<details><summary>8. Geohash vs quadtree in one sentence each?</summary>

Geohash: a fixed grid encoded as a string, works in any sorted index, cheap updates, but ignores density. Quadtree: an in-memory tree that splits busy cells, so every leaf holds a similar number of points, but it is harder to update for moving objects.
</details>

## Go deeper

- Build it: [lab-geohash](lab-geohash/README.md): encode, decode, neighbours, with tests (`npx vitest run hld/6-building-blocks/H34-geospatial/lab-geohash`)
- Case studies: [Proximity service](../../case-studies/22-proximity-service/README.md) · [Ride hailing](../../case-studies/10-ride-hailing/README.md) · [Food delivery](../../case-studies/11-food-delivery/README.md) · [Hotel booking](../../case-studies/23-hotel-booking/README.md)
- Archive notes: [HLD-guide.md](../../../archive/notes/HLD-guide.md) (ride-matching section), [hld-parts/part7.md](../../../archive/notes/hld-parts/part7.md) ("Geohash Search Concept")
- Alex Xu and Sahn Lam, *System Design Interview* Vol. 2, ch. 1 (Proximity Service) and ch. 2 (Nearby Friends); Uber blog "H3: Uber's Hexagonal Hierarchical Spatial Index"; Redis docs for `GEOADD` / `GEOSEARCH`
