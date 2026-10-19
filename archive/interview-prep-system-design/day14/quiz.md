# SD Day 14 — Quiz: API Design (REST vs gRPC vs GraphQL, versioning, pagination)

*Answer each OUT LOUD, in your own words, before expanding. If you fumble, re-read that section.
Target: explain "which API style and why" by consumer (Q4), GraphQL's costs (Q3), and offset vs cursor
pagination (Q7) cold — those are the differentiators.*

---

**Q1. What makes an API "well designed," and what two things mostly decide the style you pick?**

<details><summary>answer</summary>

A good API contract is **clear** (predictable, well-named), **stable** (evolves without breaking
clients), **efficient** (right data, right number of round trips), and **discoverable** (self-
documenting). The two deciding factors: **who's calling** (public 3rd-party vs your own mobile app vs
another internal service) and **what hurts** (too many round trips / over-fetching / loose contracts).
There's no universally "best" style — it's best *for that consumer and traffic*.
</details>

---

**Q2. Describe REST's core principles and its main weakness.**

<details><summary>answer</summary>

REST models **resources** as **URLs** manipulated with **HTTP verbs** (`GET/POST/PUT/PATCH/DELETE`),
is **stateless** (each request self-contained → scales horizontally), uses **HTTP status codes** for
meaning, and usually JSON. Strengths: simple, universal, **cacheable** (HTTP/CDN), human-readable.
Main weakness: **over-fetching / under-fetching** — fixed endpoints return fixed shapes, so you get
unneeded fields or must make several round trips to assemble one screen (painful on mobile).
</details>

---

**Q3. What is gRPC, when do you use it, and why is it bad in the browser?**

<details><summary>answer</summary>

gRPC is **typed RPC** — you call a remote function defined in a **`.proto`** (Protocol Buffers); codegen
makes typed stubs. It uses **binary Protobuf** (small/fast) over **HTTP/2** (multiplexing + streaming)
with a **strict contract**. Use it for **internal service-to-service** traffic at scale, streaming, and
polyglot backends. Browser-unfriendly because browsers can't speak raw gRPC/HTTP-2 framing directly —
you need **grpc-web + a proxy**; it's also binary (hard to curl/debug) and not HTTP-cacheable.
</details>

---

**Q4. What problem does GraphQL solve, and what are its two big costs?**

<details><summary>answer</summary>

It solves **over/under-fetching**: one endpoint + a typed schema where the **client queries exactly the
fields it wants** in one round trip — great for rich/mobile frontends with varied needs. Costs:
(1) **Caching is hard** — everything is `POST` to one URL, so you lose simple HTTP/CDN caching;
(2) **server complexity / N+1** — resolvers can fire a query per item (needs **DataLoader/batching**),
and clients can write **expensive deep queries** (needs depth/complexity limits + rate limiting).
</details>

---

**Q5. Give the one-sentence "which style when" answer, and the senior nuance.**

<details><summary>answer</summary>

"**REST** for public/3rd-party and CRUD (cacheable, universal); **gRPC** for internal service-to-service
where latency, streaming, and strict contracts matter; **GraphQL** at the edge when many clients need
different slices of related data." The nuance: **they compose** — a real system often uses **gRPC
internally behind a REST or GraphQL gateway/BFF**, not one to the exclusion of others.
</details>

---

**Q6. What changes are safe vs breaking, and how do you version when you must break?**

<details><summary>answer</summary>

**Safe:** additive changes (a new **optional** field). **Breaking:** removing/renaming fields, changing
a type, or changing a field's *meaning* (the worst — it silently lies). When you must break, version
explicitly: REST → **URL path** (`/v1`→`/v2`, most common), header/media-type, or query param. GraphQL
philosophy → **don't version**: add fields, `@deprecated` old ones, remove after usage drops. gRPC →
evolve `.proto` additively, **never reuse field numbers**. Always publish a **deprecation policy**
(announce → window → monitor → remove).
</details>

---

**Q7. Offset vs cursor pagination — how each works and when to use which.**

<details><summary>answer</summary>

- **Offset/page:** `?limit=20&offset=40`. Simple, allows jumping to any page. **Bad at scale:**
  `OFFSET 1000000` still scans+skips a million rows (slow), and it **drifts** under concurrent
  writes → duplicates/skips across pages.
- **Cursor/keyset:** `?limit=20&after=<cursor>` where the cursor = the last item seen; query is
  `WHERE id > :cursor ORDER BY id LIMIT 20`. **Fast at any depth** (uses the index, no skipping) and
  **stable** under inserts/deletes. Can't jump to an arbitrary page; needs a stable sort key.

Use **offset** for small admin tables where "go to page 7" matters; **cursor** for large, fast-moving
feeds (timelines, infinite scroll) — which is why Twitter/Stripe/Slack all use cursors.
</details>

---

**Q8. Why is REST naturally cacheable but GraphQL is not?**

<details><summary>answer</summary>

REST uses **`GET` with a unique URL per resource** and standard HTTP caching headers, so browsers,
CDNs, and proxies can cache responses by URL out of the box (Day 4). GraphQL sends **`POST` to a single
`/graphql` URL** with the query in the body, so URL-based HTTP/CDN caching can't distinguish requests —
you must add application-level caching (persisted queries, normalized client caches like Apollo, etc.).
</details>

---

**Q9. Map it to your systems: which style for fintech internal calls, mobile/PWA, IoT, and public APIs?**

<details><summary>answer</summary>

- **Fintech internal (payment/ledger/notification):** **gRPC** — strict `.proto`, binary speed, typed
  across languages — behind a **REST** gateway for partners.
- **Mobile / offline PWA (CHESA):** **GraphQL / BFF** — fetch exactly the needed fields in one round
  trip; bandwidth matters offline.
- **IoT telemetry (10k+ devices):** **gRPC streaming** over HTTP/2 beats REST polling.
- **Public/partner APIs:** **REST** with `/v1`, cursor pagination, OpenAPI docs, rate limiting.
</details>

---

**Q10 (interview close). In 30 seconds: how do you choose and evolve an API?**

<details><summary>answer</summary>

"I pick by consumer: **REST** for public CRUD and 3rd parties (cacheable, universal), **gRPC** for
internal service-to-service (binary, streaming, strict contracts), **GraphQL** for rich/mobile clients
that need exact data in one round trip — and they compose, gRPC behind a REST/GraphQL edge. I evolve
**additively** and version explicitly (URL `/v2` or deprecate-then-remove) only on true breaks. I
**always paginate** collections, using **cursor/keyset** for large live feeds because offset is slow at
deep pages and drifts under writes. Plus the hygiene: idempotency, consistent error shapes + status
codes, stateless auth, and rate limiting."
</details>

---

> Next (building blocks): **consistent hashing** — how distributed caches, rate limiters, and shards
> place keys across nodes with minimal reshuffling when a node joins/leaves — then **bloom filters** and
> **unique ID generation (Snowflake)**. After the building blocks come the full mock designs, where
> every box-and-arrow is one of these API contracts.
