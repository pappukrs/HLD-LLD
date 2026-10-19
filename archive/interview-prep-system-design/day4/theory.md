# SD Day 4 — CDN + Edge
*(Jun 9, 2026 · ~1 hr · Day 3 caching, but the cache is 50 cities away — same ideas, new failure modes)*

---

## 1. The physics that creates the whole topic

Light in fiber ≈ 200,000 km/s. Mumbai ↔ Virginia round trip ≈ 250ms **minimum** —
that's the speed of light, not a slow server. A page with 50 assets × that RTT = seconds
you cannot tune away. **Fix: put a copy of the content physically near the user.**

A CDN = hundreds of **edge servers** (PoPs) worldwide. Mumbai user hits Mumbai edge (~5ms),
not the Virginia origin (~250ms).

> **A CDN is a geographically distributed cache that moves content close to users to beat
> latency, offload the origin, and absorb traffic spikes / DDoS.**

It's Day 3's cache-aside with geography bolted on. Same TTL/hit/miss/invalidation ideas.

## 2. Three wins (say more than just "it's faster")

1. **Latency** — content served from the nearest PoP, beats RTT physics
2. **Origin offload** (the load-shedding win, like Day 3) — 95%+ of requests die at the edge; origin sees a fraction
3. **Spike / DDoS absorption** — the edge fleet soaks flash-crowd and attack traffic before it reaches origin; hides the origin IP

## 3. How content reaches the edge — pull vs push

| | Pull (origin-pull) ⭐ | Push |
|---|---|---|
| Mechanic | first miss → edge fetches origin once → caches → next users hit | you pre-upload content to the CDN |
| It is... | **cache-aside at the edge** — lazy, self-populating | eager pre-warming |
| Use | default (point DNS at CDN, done) | huge files (video libs) where first-user origin-fetch is unacceptable |

## 4. The control plane — response headers the CDN obeys

- `Cache-Control: public, max-age=3600` — anyone may cache, fresh 1 hr
- `s-maxage=86400` — separate TTL for the **shared** (CDN) cache vs browser
- `private` — browser may cache, **CDN must NOT** (per-user data) ⚠️
- `no-store` — never cache anywhere (sensitive)
- `ETag: "abc123"` + `If-None-Match` — content fingerprint; after TTL, client asks "still abc123?"
  → origin returns **`304 Not Modified`** (no body) if unchanged = cheap **revalidation**
- `stale-while-revalidate` — serve stale instantly, refresh in background (Day 3 trick, at the edge)

**Cache key** = URL (+ optionally query string / whitelisted headers). Same key = shared copy.
That sharing is exactly where the catastrophic bug lives (§7).

## 5. Invalidation — the hard problem, and the trick that dodges it

1. **Purge / invalidate** — "drop `/style.css` everywhere now." Works, but global, rate-limited,
   and triggers a brief origin re-fetch stampede.
2. **Versioned / fingerprinted URLs — the senior move.** `style.a1b2c3.css`: new content → new
   hash → new URL → **guaranteed miss → fresh fetch**; old URL never requested again. Set
   `Cache-Control: max-age=31536000, immutable` (a year) and **never invalidate**.

> Best invalidation is none: version the URL, cache forever, change the URL to change content.
> (This is why webpack/vite hash filenames.)

## 6. What goes on a CDN + the layers

- Static assets: JS, CSS, images, fonts. **Video segments** (HLS/DASH `.ts` chunks = cacheable
  files) — this is how Netflix/YouTube **VOD** works.
- ⚠️ **My distinction:** Mediasoup SFU = **real-time live** (WebRTC, sub-second, peer-specific) →
  **NOT** a CDN job. A *recorded* session / VOD playback → **is** CDN. Separating "live real-time"
  from "delivery of recorded media" is the senior tell.

**Cache ladder (Day 3's ladder, extended outward):**
```
Browser cache → CDN edge (Mumbai) → CDN origin-shield (mid-tier) → Origin → DB
```
**Origin shield / tiered caching:** one mid-tier all edges fall back to. 100 edges miss the same
key at once → they hit the shield (1 origin fetch), not origin ×100. **Cache-stampede protection
(Day 3) applied geographically** — the shield collapses the herd.

## 7. Failure modes — the senior talking points

| Trap | What happens | Fix |
|---|---|---|
| ⚠️ **Private data cached public** | `/account` cached `public`, or a stray `Set-Cookie` cached → **user B served user A's page** | `private`/`no-store` on anything per-user; never give auth'd responses a public cache key. (A real breach class.) |
| **Stale after deploy** | old JS calling a changed API → errors | versioned URLs make it structurally impossible |
| **Thundering herd on expiry** | hot key TTLs out → all edges re-fetch origin together | origin shield + stale-while-revalidate |
| **Cache poisoning** | attacker fills cache via an unkeyed header origin reflects → poisoned copy to all | strict cache key; keep reflected headers out of it |
| **`Vary` explosion** | `Vary: User-Agent` → one cached copy per UA string → ~0% hit ratio | vary on as little as possible |

## 8. Edge COMPUTE — the frontier (not just a cache anymore)

Cloudflare Workers / Lambda@Edge / Vercel edge functions run **code at the PoP** before origin:
- **Auth** (validate JWT, bounce anonymous) — reject bad traffic 250ms closer to the user
- **A/B / personalization** (rewrite per cookie)
- **Geo-routing / redirects** (`/` → `/in`)
- **Rate limiting / API assembly** at the edge

Even **uncacheable dynamic** content wins: CDN terminates TLS near the user and keeps a warm,
optimized connection to origin over its private backbone → the slow part (handshake + first byte)
happens at 5ms, not 250ms = "dynamic content acceleration."

> The shift: CDN went from "image cache" to "programmable compute layer at the network edge."

## 9. The diagram sentence

> "Static assets + video segments on a pull CDN, fingerprinted URLs with year-long immutable TTLs
> so I never invalidate; `private`/`no-store` on per-user responses so I never leak one user's data
> to another; origin shield to collapse edge misses; edge functions for auth/geo so I reject or
> route traffic before it crosses an ocean."

---

### Half-page summary (the version to remember)

> CDN = geographically distributed cache; it exists because RTT is bounded by the speed of light.
> Three wins: latency, origin offload, spike/DDoS absorption. Pull (cache-aside at the edge, the
> default) vs push (pre-upload big files). Freshness via Cache-Control (max-age, s-maxage,
> private/no-store) + ETag→304 revalidation. Invalidation is hard → dodge it with fingerprinted
> URLs cached `immutable` for a year; change the URL to change the content. Static assets + VOD
> video segments belong on a CDN; real-time WebRTC (my Mediasoup SFU) does not. Origin shield
> collapses edge-miss stampedes. Top trap: caching per-user data with a public key leaks user A's
> data to user B — `private`/`no-store` always. Frontier: edge compute (Workers/Lambda@Edge) for
> auth, geo-routing, A/B before the request crosses an ocean; even dynamic content gains from warm
> origin connections over the CDN backbone.
