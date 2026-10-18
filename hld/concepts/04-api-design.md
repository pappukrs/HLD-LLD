# 04 · API Design (REST, gRPC, GraphQL, Pagination, Idempotency)

> **Read time:** 35 min · **Visual:** [v11 delivery semantics and idempotency](../../visuals/v11-delivery-semantics.html) · **Code it:** [lld/problems/19-payment-wallet](../../lld/problems/19-payment-wallet/README.md) (idempotency keys)
> **Shows up in:** step 3 of every HLD round; [payment system](../problems/08-payment-system/README.md), [URL shortener](../problems/01-url-shortener/README.md), [news feed](../problems/07-news-feed/README.md)

## The idea in one line

An API is a contract: resources and verbs, clear errors, stable versions, cursor pagination for lists, and an idempotency key on every write that a client may retry.

## The problem it solves

In an interview, the API forces you to decide what the system actually does before you draw boxes. In production, a bad API is hard to change because clients depend on it. Two problems hurt the most:

- **Retries create duplicates.** A mobile client times out on `POST /payments` and retries. Without idempotency the user is charged twice.
- **Offset pagination breaks at scale.** `OFFSET 1000000` scans and throws away a million rows, and pages shift when new rows are inserted.

## How it works

### REST basics

- Resources are nouns, verbs are HTTP methods: `GET /v1/orders/{id}`, `POST /v1/orders`, `PATCH /v1/orders/{id}`.
- Nest only one level: `GET /v1/users/{id}/orders`.
- Use status codes correctly: `200` OK, `201` created, `202` accepted (async), `400` bad input, `401` not authenticated, `403` not allowed, `404` not found, `409` conflict, `422` validation failed, `429` rate limited, `500` server bug, `503` overloaded or down.
- Return a consistent error body: `{ "error": { "code": "INSUFFICIENT_FUNDS", "message": "...", "requestId": "..." } }`.

| Method | Safe | Idempotent |
|---|---|---|
| GET, HEAD | Yes | Yes |
| PUT, DELETE | No | Yes |
| POST | No | **No** (make it idempotent with a key) |
| PATCH | No | Not guaranteed |

### Idempotency keys

1. The client generates a unique key (UUID) per logical operation and sends `Idempotency-Key: <uuid>`.
2. The server does an atomic "insert if absent" of `(key, request hash, status=IN_PROGRESS)`. A unique constraint or Redis `SET NX` works.
3. If the key is new, process the request and store the response with the key.
4. If the key exists and is done, return the **stored response**. If it's in progress, return `409` (or wait). If the request body differs, return `422`.
5. Expire keys after a window (Stripe keeps them about 24 hours).

Store the key in the **same transaction** as the business write when you can, so a crash cannot leave one without the other.

### Pagination

| Type | How | Good | Bad |
|---|---|---|---|
| Offset | `?limit=20&offset=40` | Simple, jump to page N | Slow at large offsets; rows shift on insert |
| **Cursor (keyset)** | `?limit=20&after=<opaque cursor>` → `WHERE (created_at, id) < (?, ?) ORDER BY created_at DESC, id DESC` | Fast at any depth (uses the index), stable | No "jump to page 50" |

Make the cursor opaque (base64 of the last sort key) so you can change it later. Always add a tie-breaker (`id`) to the sort.

### Versioning

URL versioning (`/v1/...`) is the most common and easiest to route. Header versioning keeps URLs clean. Either way: add fields freely, never remove or rename without a new version, and give clients a deprecation window.

### REST vs gRPC vs GraphQL

- **REST + JSON:** public APIs, browsers, easy to debug and cache (HTTP caching on GET).
- **gRPC:** Protobuf over HTTP/2. Typed contracts, small payloads, streaming. Best for service-to-service calls. Browsers need gRPC-Web.
- **GraphQL:** one endpoint; the client asks for exactly the fields it needs. Good for many client types (web, Android, iOS) over many backends. Harder to cache and to rate-limit; watch for N+1 queries (use DataLoader).

### Async APIs

For long jobs (report export, payout batch), return `202 Accepted` with a job id, and let the client poll `GET /jobs/{id}` or receive a **webhook**. Webhooks should be signed (HMAC), retried with backoff, and handled idempotently by the receiver.

## Numbers to remember

- Idempotency key retention: **~24 h** is a common choice (Stripe documents this).
- Page size: default **20–50**, max **100–1000**.
- Protobuf payloads are usually several times smaller than the same JSON, and faster to parse.
- Offset pagination cost grows **linearly** with the offset; keyset cost stays ~constant (an index seek).

## Trade-offs

| Option | Use when | Weakness |
|---|---|---|
| REST | Public and partner APIs, CRUD | Over/under-fetching; many round trips for complex screens |
| gRPC | Internal, low-latency, streaming | Not browser-native; binary is harder to debug |
| GraphQL | Many clients with different data needs | Caching, rate limiting by cost, N+1 on the server |
| Offset pagination | Small tables, admin UIs | Slow and unstable at depth |
| Cursor pagination | Feeds, timelines, large lists | No random page access |
| Sync API | Fast operations (< ~1 s) | Client waits; timeouts on slow work |
| Async (202 + poll/webhook) | Slow or external work (bank, PSP) | More moving parts; client must handle states |

## In real systems

- **Stripe and Razorpay** accept an idempotency key on POST requests and return the original result on retry. Razorpay's payment flow is also async: the final state comes by webhook, and the merchant must verify the signature.
- **Twitter/X, Slack, Facebook Graph API** use cursor pagination.
- **Google, Netflix, Uber** use gRPC heavily for internal calls.
- **GitHub and Shopify** offer GraphQL APIs next to REST.

## What to say in the interview

"`POST /v1/payments` takes `amount`, `currency`, `orderId` and an `Idempotency-Key` header. The server stores the key with a unique constraint in the same transaction as the payment row, so a retry returns the first response instead of charging twice. The final status is async: we return `202` with `status: PENDING` and send a signed webhook when the PSP confirms. For listing transactions I'll use cursor pagination on `(created_at, id)`."

## Common follow-ups

<details><summary>Two requests with the same idempotency key arrive at the same time. What happens?</summary>

Only one can win the atomic insert (unique constraint or `SET NX`). The loser sees the key in `IN_PROGRESS` and gets `409 Conflict` or waits and then returns the stored result. Never "check then insert" in two steps; that is a race.
</details>

<details><summary>Is PUT idempotent but POST not? Why does it matter?</summary>

PUT sets the full state of a resource, so repeating it gives the same result. POST creates something new each time. Proxies, clients and SDKs may retry idempotent methods automatically, so a non-idempotent POST needs an explicit key to be safe to retry.
</details>

<details><summary>How do you rate-limit and authenticate a public API?</summary>

API keys or OAuth2 tokens at the gateway; per-key rate limits (token bucket) returning `429` with `Retry-After`. See [rate limiting](./23-rate-limiting.md) and [security](./32-security-auth.md).
</details>

## Self-test (answer before opening)

<details><summary>1. A feed API uses `OFFSET`. Users see duplicates when scrolling. Why, and the fix?</summary>

New posts are inserted at the top while the user scrolls, so every row shifts down and the next page repeats items. Use a cursor on `(created_at, id)`: "give me items older than the last one I saw".
</details>

<details><summary>2. Where should the idempotency key be stored for a payment write, and why?</summary>

In the same database and the same transaction as the payment record, with a unique constraint. Then either both commit or neither does, so a crash between them cannot cause a double charge or a lost key.
</details>

<details><summary>3. Mobile app, web app and partner integrations, all needing different fields. Which style?</summary>

REST for partners (stable, cacheable, well understood). GraphQL or a BFF (backend-for-frontend) for the mobile and web apps if their screens need different field sets. gRPC between internal services.
</details>

## Go deeper

- Stripe API docs: "Idempotent requests"
- *API Design Patterns* (JJ Geewax)
- Related cards: [idempotency and delivery semantics](./19-idempotency-delivery-semantics.md), [real-time communication](./05-realtime-communication.md)
- Older notes in this repo: `archive/notes/hld-parts/part1.md`, section "REST API Design Principles"; `archive/notes/hld-parts/part3.md`, "MODULE 3.3: API DESIGN PATTERNS" and "Topic 5: Idempotency in APIs"
