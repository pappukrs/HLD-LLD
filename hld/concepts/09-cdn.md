# 09 · CDN and Edge

> **Read time:** 25 min · **Visual:** [v01 life of a request](../../visuals/v01-request-lifecycle.html) · **Code it:** none (config, not code)
> **Shows up in:** video streaming, photo sharing, file storage, news feed media, e-commerce product images, any global read-heavy design

## The idea in one line

Copy static and cacheable content to servers close to users (edge locations), so most requests are answered a few milliseconds away and never reach your origin.

## The problem it solves

- Light in fibre covers about 200 km per millisecond. Mumbai to US-East is ~13,000 km, so one round trip is at least ~130 ms, and a page needs many round trips (DNS, TCP, TLS, HTTP).
- Images and video are most of the bytes. Serving them from your app servers wastes bandwidth and CPU.
- A sudden spike (a sale, a viral video) can overload the origin.

A CDN cuts latency (short distance, warm TCP/TLS connections), offloads the origin and absorbs spikes and DDoS traffic.

## How it works

```
user (Bengaluru) ──▶ DNS / anycast ──▶ nearest edge PoP (Chennai)
                                          │ hit → return in ~10–30 ms
                                          │ miss
                                          ▼
                                   regional / shield cache
                                          │ miss
                                          ▼
                                   origin (S3 bucket or app LB)
```

1. **Routing to the edge**: GeoDNS returns the IP of a nearby PoP, or anycast announces the same IP from every PoP and the internet routes to the closest.
2. **Cache key**: by default host + path (+ chosen query params, headers, cookies). Keep it small. Every extra header in the key splits the cache and lowers the hit rate.
3. **Freshness**: the origin controls it with headers:
   - `Cache-Control: public, max-age=31536000, immutable` for versioned files (`app.3f9a1c.js`).
   - `Cache-Control: s-maxage=60` caches at the CDN for 60 s but lets browsers use their own rule.
   - `Cache-Control: private` or `no-store` for user-specific data.
   - `stale-while-revalidate` serves the old copy while fetching a new one.
4. **Origin shield**: one extra cache tier between edges and origin. Many edge misses for the same object become one origin request.

### Pull vs push

| | Pull (most common) | Push |
|---|---|---|
| How | Edge fetches from origin on the first miss | You upload content to the CDN ahead of time |
| Good for | Websites, images, APIs with cacheable responses | Large files with known demand (a game patch, a film release) |
| Downside | First user at each PoP pays a miss | You manage uploads and storage |

### Invalidation

- **Best: versioned URLs.** Put a content hash or version in the file name. A new deploy means a new URL, so nothing needs purging, and you can cache forever.
- **Purge API**: delete a path or tag from all edges. Takes from seconds to minutes. Use it for mistakes, not as the normal flow.
- **Short TTL**: for content that changes often (prices, scores).

### Private content

Use **signed URLs or signed cookies** with an expiry. The edge checks the signature, so only paying users can fetch the video, and the file is still cached at the edge.

### Edge compute

Small functions run at the PoP (Cloudflare Workers, Lambda@Edge, CloudFront Functions): redirects, A/B routing, auth token checks, header rewrites, image resizing. Keep them small and stateless.

## Numbers to remember

- Fibre: ~200 km per ms one way. Same city: ~1–5 ms. India ↔ US: ~200–250 ms RTT in practice.
- Good static hit ratio: 90–99%. Video segments for popular titles can be higher.
- Video bandwidth: 1080p is about 5 Mbps. 1M concurrent viewers × 5 Mbps = 5 Tbps. Only CDNs (and ISP-embedded caches) handle that.
- Purge time: seconds to a few minutes, depending on the provider.

## Trade-offs and when not to use it

| Option | Use when | Weakness |
|---|---|---|
| Commercial CDN (CloudFront, Akamai, Cloudflare, Fastly) | Almost always for static and media | Cost per GB; less control; purge is not instant |
| Own CDN / ISP boxes (Netflix Open Connect) | Huge, predictable video volume | Very expensive to build and run |
| Caching dynamic API responses at the edge | Same response for many users (catalog, scores) | Must design the cache key carefully; risk of leaking private data |
| No CDN | Internal tools, single-region users, user-specific responses | — |

**Biggest risk:** caching a user-specific response with a public cache header. One user's data is then shown to others. Mark personal responses `private` and never put auth-dependent data under a shared key.

## In real systems

- **Netflix**: Open Connect appliances inside ISPs; most viewing traffic is served from inside the user's ISP.
- **Hotstar/JioCinema-style live streaming** in India: multi-CDN setups for cricket peaks with tens of millions of concurrent viewers.
- **Flipkart / Amazon product images**: S3-like object store as origin, CDN in front, image resizing at the edge or by URL parameters.
- **Cloudflare**: anycast network that also gives DDoS protection and WAF.

## What to say in the interview

"All media goes to S3 and is served through a CDN like CloudFront. Uploads use versioned or content-hashed keys, so I can cache them for a year with `immutable` and never purge. I'll add an origin shield so a miss storm doesn't hit S3 or the app servers. Private videos use signed URLs that expire. I expect a 95%+ hit rate, so the origin serves only a few percent of the bytes, and that is what I size it for."

## Common follow-ups

<details><summary>How does a user reach the nearest edge?</summary>

GeoDNS (the DNS answer depends on the resolver's location) or anycast (the same IP is announced from many PoPs and BGP routes to the closest). Many CDNs combine both.
</details>

<details><summary>You pushed a wrong image. How do you fix it quickly?</summary>

Use the purge API for that path. For the future, use versioned URLs, so a fix is a new URL and old copies never matter.
</details>

<details><summary>Can a CDN help with dynamic, personalised pages?</summary>

Partly. It still terminates TCP/TLS near the user and keeps warm connections to the origin, which cuts latency. You can cache the shared part (layout, catalog) at the edge and fetch the personal part separately. Edge functions can do small personalisation.
</details>

<details><summary>How do you serve a live cricket match to 20M viewers?</summary>

Encode into short segments (HLS/DASH, a few seconds each) at several bitrates. Push segments to multiple CDNs; the player uses adaptive bitrate. Each segment is the same for everyone, so it caches perfectly at the edge, and origin load stays flat as viewers grow.
</details>

## Self-test (answer before opening)

<details><summary>1. Why is a content hash in the file name better than a purge?</summary>

A new version is a new URL, so caches can never serve the old file for the new page. No purge delay, and you can cache forever.
</details>

<details><summary>2. Your CDN hit rate is 40%. What would you check first?</summary>

The cache key. Query strings, cookies or headers (like `User-Agent`) in the key split the cache into many copies. Also check `Cache-Control` headers from the origin (`no-cache`, short `max-age`).
</details>

<details><summary>3. What does an origin shield do?</summary>

It is a middle cache tier. Misses from many edges for the same object become one request to the origin.
</details>

## Go deeper

- Concepts: [08 caching](./08-caching.md), [03 networking basics](./03-networking-basics.md), [26 blob storage](./26-blob-storage.md), [36 deployment and multi-region](./36-deployment-multi-region.md)
- Problems: [14 video streaming](../problems/14-video-streaming/README.md), [16 photo sharing](../problems/16-photo-sharing/README.md)
- RFC 9111 (HTTP caching) for `Cache-Control` rules
- Older notes in this repo: `archive/notes/hld-parts/part2.md`, "Module 2.5: CDN & Edge Computing" ("Pull vs Push CDNs", "Cache Invalidation & TTL", "Edge Computing")
