# H10 · CDN and static content

> **Time:** ~40 min · **Visual:** [visual.html](visual.html) · **Code:** [demo.ts](demo.ts) (`npx tsx hld/2-scaling/H10-cdn/demo.ts`)
> **Builds on:** [H03 Networking basics](../../1-basics/H03-networking-basics/) · [H09 Caching](../H09-caching/) · **Used in:** [Video streaming](../../case-studies/14-video-streaming/README.md), [Photo sharing](../../case-studies/16-photo-sharing/README.md), [File storage](../../case-studies/15-file-storage/README.md), [News feed](../../case-studies/07-news-feed/README.md) (media), [URL shortener](../../case-studies/01-url-shortener/README.md) (edge redirects)

## The idea in one line

Copy static and shareable content to servers close to users (edge PoPs), so most requests are answered a few milliseconds away and never reach your origin; control it with `Cache-Control` headers, versioned URLs and a shield tier.

## Why it matters (the problem it solves)

- **Distance.** Light in fibre covers ~200 km per ms. Bengaluru to US-East is ~14,000 km, so one round trip is at least ~140 ms, and a first page load needs several (DNS, TCP, TLS, HTTP). Physics, not code, is the bottleneck.
- **Bytes.** Images, JS bundles and video are most of the bytes. Serving them from app servers burns bandwidth and CPU that should go to real requests.
- **Spikes.** A sale, a viral link or an IPL final multiplies traffic 100x in minutes. Without a CDN every request lands on the origin.

A CDN cuts latency (short distance plus warm connections), offloads the origin (often 90 to 99% of bytes) and absorbs spikes and DDoS traffic.

## How it works

### 1. The path of a request

```
user (Bengaluru) ──DNS / anycast──▶ nearest edge PoP (Chennai)
                                       │ HIT  → served in ~10-30 ms
                                       │ MISS
                                       ▼
                                 regional shield cache (Mumbai)
                                       │ MISS
                                       ▼
                                 origin: S3 bucket or app load balancer (us-east-1)
```

1. **Routing to the edge.** GeoDNS answers with a nearby PoP's IP based on the resolver's location, or **anycast** announces the same IP from every PoP and BGP delivers packets to the closest. Most CDNs use both.
2. **Cache lookup.** The edge computes a **cache key** (by default host + path, plus whichever query params, headers or cookies you include) and checks its store.
3. **Miss handling.** On a miss the edge asks the **shield** (one regional tier), which asks the origin only if it also misses. The response is stored at both tiers on the way back.
4. **Freshness.** The origin's headers decide how long each tier may keep the object.

### 2. Cache-Control: the origin is in charge

| Header | Meaning | Use for |
|---|---|---|
| `public, max-age=31536000, immutable` | Anyone may cache for a year; never revalidate | Hashed assets: `app.3f9a1c.js`, `logo.v7.png` |
| `public, max-age=0, s-maxage=60` | Browser revalidates; CDN keeps 60 s | HTML, product listings, scores |
| `stale-while-revalidate=30` | Serve the old copy up to 30 s while fetching a new one in the background | Smooth refresh, no miss spike |
| `stale-if-error=86400` | Serve stale for a day if the origin is down | Resilience |
| `private, no-store` | Never in a shared cache | Anything user-specific: `/api/me`, carts, tokens |
| `ETag` / `Last-Modified` | Revalidate with `If-None-Match`; origin answers `304 Not Modified` (no body) | Cheap freshness checks |
| `Vary: Accept-Encoding` | Separate cached copy per value of that header | gzip vs brotli. Avoid `Vary: User-Agent` or `Cookie` |

`max-age` applies to every cache; `s-maxage` overrides it for shared caches (CDN, proxies) only.

### 3. The cache key decides the hit rate

Every extra input to the key splits one object into many copies. `?utm_source=...`, a session cookie, or `Vary: User-Agent` can drop a 95% hit rate to 40%. Rules:

- Include only query params that change the response (`?w=400` for an image width); strip tracking params.
- Do not forward cookies or `Authorization` for static paths.
- Normalise: lowercase host, sorted params, one encoding variant per format.

### 4. Pull vs push

| | Pull (default) | Push |
|---|---|---|
| How | Edge fetches from origin on the first miss | You upload content to the CDN ahead of time |
| Good for | Websites, images, cacheable API responses | Big files with known demand: a game patch, a film release |
| Downside | First user per PoP pays the miss | You manage uploads and storage |

### 5. Invalidation

- **Best: versioned URLs.** Put a content hash in the file name (`style.8c1d.css`). A deploy creates new URLs and the HTML points to them. Nothing to purge, so you can cache forever with `immutable`. Only the small HTML file needs a short TTL.
- **Purge API.** Delete a path, prefix or tag from every PoP. Takes seconds to minutes, and the next requests are all misses. Use it for mistakes, not as the normal deploy flow.
- **Short TTL** for content that changes often (prices, live scores), plus `stale-while-revalidate`.

### 6. Protecting the origin

- **Origin shield / tiered caching:** 300 edges missing the same object become 1 origin request.
- **Request collapsing:** while one fetch for an object is in flight, the PoP holds other requests for it (the CDN version of single-flight from [H09](../H09-caching/)).
- **The 4% problem:** a 96% hit rate with 100x traffic still means 4% × 100x = 4x normal origin load, all at once when a new object goes viral. Shield plus collapsing is the fix.
- Lock the origin down: only the CDN may reach the bucket (CloudFront Origin Access Control) or the LB (allow-list CDN IPs or a secret header).

### 7. Private and dynamic content

- **Signed URLs or signed cookies** with an expiry let the edge check access without calling your servers, while the file itself stays cached. Used for paid videos and private downloads.
- **Dynamic, uncacheable APIs still get faster through a CDN:** TLS terminates near the user (saving 2 to 3 long round trips on a new connection), and the edge keeps warm, pooled connections to the origin over a tuned backbone.
- **Edge compute** (Cloudflare Workers, Lambda@Edge, CloudFront Functions): redirects, A/B routing, JWT checks, header rewrites, image resizing. Keep it small and stateless.

### 8. Video

Video is cut into small segments (HLS/DASH, 2 to 6 s each) at several bitrates; the player picks the bitrate that fits its bandwidth (adaptive bitrate). Every segment is the same file for every viewer, so it caches perfectly. 1 M viewers × 5 Mbps = 5 Tbps: only CDNs (often several at once) or ISP-embedded boxes like Netflix Open Connect carry that. Live 1-on-1 calls are the opposite: WebRTC, not a CDN ([H05](../../1-basics/H05-realtime-communication/)).

## In TypeScript

Setting the right headers is most of the work. An Express-style origin:

```ts
app.use('/assets', (req, res, next) => {
  // Hashed file names from the bundler: cache for a year, never revalidate.
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  next();
}, express.static('dist/assets'));

app.get('/', (req, res) => {
  // HTML points at the hashed assets; CDN keeps it 60 s, browser always revalidates.
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=30');
  res.sendFile('dist/index.html');
});

app.get('/api/me', auth, (req, res) => {
  res.setHeader('Cache-Control', 'private, no-store');   // never in a shared cache
  res.json(req.user);
});
```

A signed URL the edge can verify without calling the origin:

```ts
function signUrl(path: string, expiresAt: number, secret: string) {
  const sig = createHmac('sha256', secret).update(`${path}:${expiresAt}`).digest('base64url');
  return `${path}?exp=${expiresAt}&sig=${sig}`;
}
```

[demo.ts](demo.ts) simulates 3 edge PoPs with and without an origin shield, shows how a tracking query param in the cache key ruins the hit rate, compares purge vs versioned URLs, and computes latency and bandwidth savings.

## Trade-offs / when NOT to use it

| Option | Use when | Weakness |
|---|---|---|
| Commercial CDN (CloudFront, Cloudflare, Akamai, Fastly) | Almost always for static assets and media | Cost per GB; purge is not instant; less control |
| Multi-CDN | Huge live events, vendor outage risk | Routing logic, multiple configs, cost |
| Own CDN / ISP boxes (Netflix Open Connect) | Huge, predictable video volume | Very expensive to build and operate |
| Caching API responses at the edge | Same answer for many users (catalog, scores) | Key design; risk of leaking personal data |
| No CDN | Internal tools, single-region users, fully personal responses | — |

The biggest risk is caching a user-specific response under a public header. One user's profile then gets served to others. Personal responses are `private, no-store`, always.

## Common mistakes

- `Cache-Control: public` on authenticated API responses (a data breach, not a bug).
- Purging on every deploy instead of hashing file names.
- Long TTL on `index.html`, so users keep loading old asset URLs after a deploy.
- Cookies, tracking params or `User-Agent` in the cache key, then wondering why the hit rate is 40%.
- Forgetting the origin shield, so a viral object sends hundreds of simultaneous misses to the origin.
- Leaving the S3 bucket public, so people bypass the CDN (and its signed URLs).
- Putting live, interactive video (calls) "on the CDN".

## Say this in the interview

> "All media and static assets live in S3 and are served through a CDN like CloudFront. Asset file names carry a content hash, so they're cached for a year with `immutable` and a deploy never needs a purge; only the HTML has a short `s-maxage`. Personal API responses are `private, no-store`."

> "I'll enable an origin shield and request collapsing, so a viral object turns hundreds of edge misses into one origin fetch. I expect a 95%+ hit rate, so I size the origin for the remaining few percent of requests plus a spike margin. Private videos use signed URLs with a short expiry; the bucket only accepts requests from the CDN."

> "Even uncacheable API calls go through the CDN: TLS ends near the user and the edge reuses warm connections to our region, which saves a couple of 150 ms round trips for users in India hitting a US origin."

## Your experience hook

- **Portfolio site on Vercel (pappukrs.vercel.app):** Vercel's edge network serves your hashed JS and CSS with long cache headers and the HTML with a short one. Open DevTools, look at `cache-control` and `x-vercel-cache: HIT`, and you have a live example.
- **CHESA PWA (offline):** the service worker is a cache on the device: precache hashed assets, network-first for API calls. Same freshness rules, one level closer to the user.
- **Video SFU:** a good contrast answer. Live calls go over WebRTC through the SFU, not a CDN; recorded sessions would be segmented to HLS and served through a CDN.

## Numbers to remember

| Thing | Number |
|---|---|
| Light in fibre | ~200 km per ms one way |
| India ↔ US-East RTT | ~200 to 250 ms in practice |
| Edge hit served | ~10 to 30 ms |
| Good static hit ratio | 90 to 99% |
| 1080p video | ~5 Mbps; 1 M viewers = 5 Tbps |
| HLS/DASH segment | 2 to 6 s |
| Purge time | seconds to a few minutes |
| `max-age` for hashed assets | 31,536,000 s (1 year) + `immutable` |

## Self-test

<details><summary>1. A junior sets `Cache-Control: public, max-age=300` on every response, including `GET /api/me`. Users see other people's data. Why?</summary>

The CDN caches by URL. `/api/me` is the same URL for everyone, so the first user's response is stored and served to the next users for 5 minutes. It should be `private, no-store`. `/logo.png` is safe with the same header because its content is identical for everyone.
</details>

<details><summary>2. Purge vs content-hashed file names: why do seniors prefer hashing?</summary>

With hashing, a new version is a new URL, so no edge or browser can ever serve the old file for the new page. No purge delay, no miss storm after a purge, and you can safely set `max-age=1 year, immutable`, which you could never do with a fixed name.
</details>

<details><summary>3. Hit rate is 96% but the origin falls over for 30 seconds when a link goes viral. Why, and the fix?</summary>

Hundreds of PoPs all miss the new object at the same moment and each fetches it from the origin (a geographic stampede). Fix: an origin shield (one regional tier collapses the misses) plus request collapsing at each PoP.
</details>

<details><summary>4. Your CDN hit rate is 40%. What do you check first?</summary>

The cache key: tracking query params, cookies, or `Vary: User-Agent` split each object into many copies. Then the origin's headers (`no-cache`, short `max-age`, `Set-Cookie` on static files).
</details>

<details><summary>5. "A CDN is useless for a personalised, uncacheable API." Argue back.</summary>

TLS and TCP terminate at the nearby PoP, saving long round trips on connection setup, and the edge keeps warm, pooled connections to the origin over a better backbone. Edge functions can also do auth checks, redirects or A/B routing without a trip to the origin.
</details>

<details><summary>6. Doctor consults (live 1-on-1) and recorded webinars: which goes on a CDN?</summary>

Recorded webinars: segment them into HLS/DASH files at several bitrates and cache the segments at the edge. Live 1-on-1 consults need sub-second, two-way media: WebRTC over UDP, not a CDN (though TURN servers near users help in a similar way).
</details>

<details><summary>7. How does a user reach the nearest edge?</summary>

GeoDNS answers with a nearby PoP's IP based on the resolver's location, or anycast announces one IP from all PoPs and BGP routes to the closest. Many CDNs combine both.
</details>

<details><summary>8. How do you serve paid videos from the CDN without letting non-payers download them?</summary>

Signed URLs or signed cookies: your server signs the path plus an expiry with a secret the CDN knows. The edge checks the signature and expiry, then serves from cache. The bucket only accepts requests from the CDN.
</details>

## Go deeper

- Next: [H11 Indexing](../../3-databases/H11-indexing/) (the database side of read performance).
- Related: [H09 Caching](../H09-caching/), [H32 Blob storage](../../6-building-blocks/H32-blob-storage/), [H39 Deployment and multi-region](../../6-building-blocks/H39-deployment-multi-region/).
- Case studies: [Video streaming](../../case-studies/14-video-streaming/README.md), [Photo sharing](../../case-studies/16-photo-sharing/README.md).
- Archive notes: [hld-parts/part2.md](../../../archive/notes/hld-parts/part2.md) ("Module 2.5: CDN & Edge Computing").
- RFC 9111 (HTTP Caching); RFC 5861 (`stale-while-revalidate`, `stale-if-error`).
