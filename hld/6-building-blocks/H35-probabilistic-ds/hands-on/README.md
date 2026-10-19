# H35 hands-on: a sign-up API with a Bloom filter

A small Express app (from the old 35-day repo) that checks "is this email already taken?" with a Bloom filter before touching the "database" (an in-memory array).

| File | What it shows |
|---|---|
| `bloomFilter.js` | A 100-bit Bloom filter with 3 hash functions (MD5, SHA-1, SHA-256, each folded into a bit index). `add` sets 3 bits, `contains` checks them. |
| `server.js` | `POST /register` rejects an email if the filter says "maybe present"; otherwise adds it to the filter and the array. `GET /users` lists users. |

## Run it

```bash
cd hld/6-building-blocks/H35-probabilistic-ds/hands-on
npm install
node server.js          # http://localhost:3000
```

```bash
curl -s -X POST localhost:3000/register -H 'content-type: application/json' -d '{"email":"a@x.com","name":"A"}'
curl -s -X POST localhost:3000/register -H 'content-type: application/json' -d '{"email":"a@x.com","name":"A"}'   # 400: already exists
for i in $(seq 1 60); do
  curl -s -X POST localhost:3000/register -H 'content-type: application/json' -d "{\"email\":\"u$i@x.com\",\"name\":\"U$i\"}"; echo
done
```

## What to observe

1. The second request with the same email is rejected: no false negatives.
2. As you register more users, some **new** emails get "already exists (or false positive)". The filter has only 100 bits, so after ~30 users most bits are 1 and false positives climb fast. This is the "size it for n" rule from the README.
3. The bug to spot: the app **rejects** on "maybe". A real system must treat "maybe" as "go check the database" (a unique index), and only "definitely not" as a fast path. Fix `server.js` to look up `users` when `contains` is true.
4. The hash functions sum hex characters, which spreads badly. Compare with the double-hashing version in [../demo.ts](../demo.ts).

## Which README section it backs

- [How it works → Bloom filter](../README.md#how-it-works) and [Common mistakes](../README.md#common-mistakes) (treating "maybe" as "yes", undersizing).
- Build a correct one yourself in [../lab-bloom-filter](../lab-bloom-filter/README.md).
