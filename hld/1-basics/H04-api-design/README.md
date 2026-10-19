# H04 · API design: REST, gRPC, GraphQL

> **Time:** ~45 min · **Visual:** [visual.html](visual.html) · **Code:** [demo.ts](demo.ts) (`npx tsx hld/1-basics/H04-api-design/demo.ts`)
> **Builds on:** [H01 Approach the HLD round](../H01-approach-hld-round/) · [H03 Networking basics](../H03-networking-basics/) · **Used in:** [URL shortener](../../case-studies/01-url-shortener/README.md), [Payment system](../../case-studies/08-payment-system/README.md), [News feed](../../case-studies/07-news-feed/README.md), [Digital wallet](../../case-studies/28-digital-wallet/README.md)

## The idea in one line

An API is a contract: pick the style by who calls it (REST for public, gRPC for internal, GraphQL for many different screens), make every retried write idempotent, paginate lists with a cursor, and only ever change it additively.

## Why it matters (the problem it solves)

In the interview, the API is step 3 of the framework. Writing the endpoints forces you to decide what the system actually does before you draw boxes. In production, a bad API is the hardest thing to fix, because clients you do not control depend on it.

Three problems hurt the most:

- **Retries create duplicates.** A phone on a train sends `POST /payments`, the response is lost, the app retries. Without idempotency the user pays twice.
- **Offset pagination breaks at scale.** `OFFSET 1000000` reads and throws away a million rows. And when new rows arrive while the user scrolls, every page shifts and items repeat.
- **Breaking changes break clients.** Rename one JSON field and every old mobile app version in the wild crashes. You cannot force users to update.

## How it works

### 1. Choose the style by consumer

| | REST + JSON | gRPC | GraphQL |
|---|---|---|---|
| Shape | Resources (URLs) + HTTP verbs | Remote functions in a `.proto` file | One endpoint, typed schema, client picks fields |
| Wire format | JSON text over HTTP/1.1 or 2 | Protobuf binary over HTTP/2 | JSON over HTTP (usually `POST /graphql`) |
| Contract | OpenAPI (optional) | Strict, code-generated stubs | Strict schema, introspection |
| HTTP caching / CDN | Yes (GET by URL) | No | Hard (needs persisted queries) |
| Streaming | No (use SSE/WebSocket) | Yes: server, client, bidirectional | Subscriptions (over WebSocket) |
| Browser | Native | Needs grpc-web + proxy | Native |
| Best for | Public and partner APIs, CRUD | Service-to-service, low latency, polyglot | Web + iOS + Android needing different slices |
| Main weakness | Over-fetching / under-fetching | Hard to debug, not browser-native | N+1 resolvers, expensive queries, caching |

The senior answer: **they compose.** A real system often has REST or GraphQL at the edge (or a BFF, backend-for-frontend) and gRPC between the services behind it.

```
 mobile / web ──REST or GraphQL──▶ [ API gateway / BFF ] ──gRPC──▶ order-svc
 partners     ──REST /v1─────────▶                       ──gRPC──▶ payment-svc
                                                           ──gRPC──▶ user-svc
```

### 2. REST done well

- Nouns for resources, verbs from HTTP: `GET /v1/orders/{id}`, `POST /v1/orders`, `PATCH /v1/orders/{id}`.
- Nest one level at most: `GET /v1/users/{id}/orders`. Deeper nesting is hard to evolve.
- Stateless: each request carries its own auth (a token). Any server can handle it, so you can scale out ([H07](../../2-scaling/H07-scaling-stateless/)).
- Status codes that mean something:

| Code | Meaning | Code | Meaning |
|---|---|---|---|
| 200 | OK | 401 | Not authenticated |
| 201 | Created (+ `Location` header) | 403 | Authenticated but not allowed |
| 202 | Accepted, will finish later | 404 | Not found |
| 204 | OK, no body | 409 | Conflict (state, duplicate in progress) |
| 400 | Malformed input | 422 | Valid JSON, fails business rules |
| 429 | Rate limited (+ `Retry-After`) | 503 | Overloaded or down, retry later |

- One error shape everywhere: `{ "error": { "code": "INSUFFICIENT_FUNDS", "message": "...", "requestId": "req_8f2" } }`. The `requestId` lets support find the log line.

**Safe and idempotent methods**

| Method | Safe (no side effect) | Idempotent (repeat = same result) |
|---|---|---|
| GET, HEAD | Yes | Yes |
| PUT, DELETE | No | Yes |
| POST | No | **No**: make it idempotent with a key |
| PATCH | No | Not guaranteed (`{"balance": +10}` is not) |

This matters because proxies, SDKs and load balancers may retry idempotent methods on their own. POST is never retried safely unless you add a key.

### 3. Idempotency keys (the most asked part)

```
client                      server                               DB
  │ POST /v1/payments         │                                    │
  │ Idempotency-Key: k-42 ───▶│ INSERT key k-42 (IN_PROGRESS)      │
  │                           │   unique constraint ──────────────▶│ ok (new)
  │                           │ charge PSP, write payment row      │
  │                           │ UPDATE k-42 = DONE, response=201 ─▶│ same txn
  │   ✗ response lost ◀───────│                                    │
  │ retry, same key k-42 ────▶│ INSERT k-42 → duplicate            │
  │                           │ read stored response ─────────────▶│
  │ ◀── 201 (same body, no second charge)                          │
```

1. The client makes one UUID per logical operation (per "Pay" tap, not per HTTP attempt) and sends `Idempotency-Key`.
2. The server does an atomic insert-if-absent of `(key, requestHash, status=IN_PROGRESS)`. Use a unique constraint or Redis `SET key val NX EX 86400`.
3. New key: process, then store the response with the key, ideally **in the same transaction** as the business write.
4. Existing key and `DONE`: return the stored response. `IN_PROGRESS`: return `409` (or wait). Same key but a different body: return `422`.
5. Expire keys after a window. Stripe keeps them about 24 hours.

Never do "check, then insert" as two steps. Two retries arriving together both see "not found" and both charge.

### 4. Pagination: offset vs cursor

| | Offset | Cursor (keyset) |
|---|---|---|
| Request | `?limit=20&offset=40` | `?limit=20&after=eyJ0IjoxNzAw...` |
| SQL | `ORDER BY created_at DESC LIMIT 20 OFFSET 40` | `WHERE (created_at, id) < (?, ?) ORDER BY created_at DESC, id DESC LIMIT 20` |
| Cost at depth | Grows with offset (scan + skip) | Constant: one index seek |
| New rows while scrolling | Pages shift: duplicates or skips | Stable |
| Jump to page 50 | Yes | No |
| Use for | Small admin tables | Feeds, timelines, transaction history |

Rules: make the cursor **opaque** (base64 of the last sort key) so you can change it later; always add a **tie-breaker** (`id`) because two rows can share a timestamp; return `nextCursor: null` at the end.

### 5. Versioning and evolution

- **Safe:** add an optional field, add an endpoint, add an enum value only if clients ignore unknown ones.
- **Breaking:** remove or rename a field, change a type, make an optional field required, change what a field *means* (the worst, because nothing errors).
- REST: version in the URL (`/v1` → `/v2`), the easiest to route at the gateway. Header versioning keeps URLs clean.
- gRPC: evolve the `.proto` additively and **never reuse a field number**.
- GraphQL: do not version; add fields, mark old ones `@deprecated`, remove when usage hits zero.
- Always publish a deprecation policy: announce, give a window (for example 6 to 12 months), watch traffic, then remove.

### 6. Sync vs async APIs

If the work takes more than about a second or depends on a third party (bank payout, video encode, report export), do not hold the connection open:

```
POST /v1/exports            → 202 Accepted  { "jobId": "job_9", "status": "PENDING" }
GET  /v1/exports/job_9      → 200 { "status": "RUNNING", "progress": 40 }
... or the server calls your webhook:  POST https://merchant.com/hooks  (signed with HMAC)
```

Webhooks must be **signed** (HMAC of the body with a shared secret), **retried** with backoff, and handled **idempotently** by the receiver (dedupe by event id), because they arrive at least once and sometimes out of order.

### 7. gRPC and GraphQL details interviewers probe

- **gRPC** runs on HTTP/2: many calls multiplexed on one TCP connection, binary framing, header compression. Protobuf messages are often 3 to 10 times smaller than the same JSON. Set **deadlines** on every call so a slow downstream cannot hang the chain.
- **GraphQL N+1:** a query for 50 posts with their authors fires 1 + 50 queries. Fix with **DataLoader**: collect the 50 author ids in one tick and run one `WHERE id IN (...)`.
- **GraphQL cost:** a client can ask for `friends { friends { friends ... } }`. Limit depth, score query cost, and rate-limit by cost, not by request count.

## In TypeScript

The core of an idempotent POST handler. The full version (with request-hash checks and a race) is in [demo.ts](demo.ts).

```ts
type Stored = { status: 'IN_PROGRESS' | 'DONE'; hash: string; response?: Res };

async function createPayment(key: string, body: PayReq): Promise<Res> {
  const hash = sha256(JSON.stringify(body));
  const won = store.insertIfAbsent(key, { status: 'IN_PROGRESS', hash }); // atomic
  if (!won) {
    const s = store.get(key)!;
    if (s.hash !== hash) return { code: 422, body: 'key reused with different body' };
    if (s.status === 'IN_PROGRESS') return { code: 409, body: 'in progress, retry' };
    return s.response!;                                // replay: no second charge
  }
  const res = { code: 201, body: await psp.charge(body) };
  store.set(key, { status: 'DONE', hash, response: res });
  return res;
}
```

Cursor pagination: encode the last sort key, decode it on the next call.

```ts
const encode = (c: { t: number; id: number }) => Buffer.from(JSON.stringify(c)).toString('base64url');
const page = rows
  .filter((r) => !after || r.t < after.t || (r.t === after.t && r.id < after.id))
  .slice(0, limit);
const nextCursor = page.length === limit ? encode(page[page.length - 1]) : null;
```

## Trade-offs / when NOT to use it

| Option | Use when | Do not use when |
|---|---|---|
| REST | Public, partner, CRUD, cacheable reads | One screen needs data from 6 resources (round trips) |
| gRPC | Internal hot paths, streaming, many languages | Browser clients or partners who want curl |
| GraphQL | Many client types, fast-changing UIs | Simple CRUD, heavy CDN caching, file upload APIs |
| Offset pagination | Small, slow-changing tables, "go to page 7" | Feeds, anything over ~10k rows deep |
| Cursor pagination | Infinite scroll, history, exports | Users need random page access |
| Sync | Under ~1 s, no third party | Bank, PSP, encoding, reports |
| Async (202 + poll/webhook) | Slow or external work | Simple reads (extra moving parts for nothing) |

Idempotency keys cost a write per request and storage for 24 h. For pure reads they are pointless. For PUT and DELETE they are usually unnecessary because the method is already idempotent.

## Common mistakes

- Verbs in URLs: `POST /createOrder`, `GET /getUser?id=1`. Use nouns and methods.
- Returning `200` with `{ "success": false }`. Clients, monitors and retries all depend on the status code.
- Generating the idempotency key on the server, or a new key per retry. Then every retry looks new.
- "Check then insert" for the key. It is a race; the insert itself must be the check.
- Offset pagination for a feed, and no tie-breaker in the cursor sort.
- Saying "gRPC is always faster, use it everywhere", including for browsers and partners.
- Forgetting deadlines/timeouts on internal calls, and forgetting `429` + `Retry-After` on public ones.
- Choosing GraphQL and never mentioning N+1 or query cost limits.

## Say this in the interview

> "Public and partner traffic gets REST with `/v1` in the path, a consistent error body and cursor pagination. Behind the gateway the services talk gRPC, because the contract is strict and Protobuf over HTTP/2 is small and fast. If web and mobile need very different data, I'd add a GraphQL layer or a BFF at the edge, with DataLoader to avoid N+1."

> "`POST /v1/payments` takes `amount`, `currency`, `orderId` and an `Idempotency-Key` header. The server inserts the key with a unique constraint in the same transaction as the payment row, so a retry returns the first response instead of charging twice. The bank confirmation is async, so I return `202` with `status: PENDING` and send a signed webhook when it settles."

> "For transaction history I'll use keyset pagination on `(created_at, id)`. Offset gets slower with depth and duplicates rows when new transactions land while the user scrolls."

## Your experience hook

- **Payment orchestration (3 providers):** you built idempotency keys per payment intent, webhook dedupe by provider event id, and a status state machine for out-of-order webhooks. That is sections 3 and 6 of this page, from real code.
- **Video SFU platform:** signaling-to-media calls moved from REST (20 to 50 ms) to gRPC (2 to 5 ms). Use that number when asked "why gRPC internally?".
- **Express API gateway:** REST at the edge, routing to internal services. Good example of "styles compose".

## Numbers to remember

| Thing | Number |
|---|---|
| Idempotency key retention | ~24 h (Stripe) |
| Default / max page size | 20 to 50 / 100 to 1000 |
| Protobuf vs JSON size | often 3 to 10 times smaller |
| REST vs gRPC internal hop (your SFU) | 20 to 50 ms vs 2 to 5 ms |
| Sync API budget before going async | ~1 s |
| Offset cost | grows linearly with offset; keyset is ~constant (one index seek) |
| Deprecation window | 6 to 12 months is common |

## Self-test

<details><summary>1. Two requests with the same idempotency key arrive at the same moment. What happens?</summary>

Only one wins the atomic insert (unique constraint or `SET NX`). The other sees the key as `IN_PROGRESS` and gets `409 Conflict`, or waits and then returns the stored response. A separate "check then insert" would let both through.
</details>

<details><summary>2. A feed uses OFFSET and users see duplicate posts while scrolling. Why, and the fix?</summary>

New posts are inserted at the top, so every row shifts down and the next page repeats items. Use a cursor on `(created_at, id)`: "give me 20 items older than the last one I saw". It is also an index seek, so it stays fast at any depth.
</details>

<details><summary>3. Why is REST easy to cache but GraphQL is not?</summary>

REST uses `GET` with a unique URL per resource plus standard cache headers, so browsers and CDNs cache by URL. GraphQL sends `POST /graphql` with the query in the body, so URL caching cannot tell requests apart. You need persisted queries (query id in a GET) or client-side normalized caches.
</details>

<details><summary>4. Which changes are breaking? How do you evolve a gRPC API safely?</summary>

Removing or renaming a field, changing a type, making a field required, or changing a field's meaning. In gRPC, only add new fields with new numbers, never reuse or renumber an old field number, and keep old fields until no client sends them.
</details>

<details><summary>5. Where should the idempotency key live for a payment, and why?</summary>

In the same database and the same transaction as the payment row, with a unique constraint. Either both commit or neither does, so a crash between them cannot give you a charge with no key (double charge on retry) or a key with no charge (lost payment).
</details>

<details><summary>6. Web, iOS, Android and partners all need data. Which styles?</summary>

REST `/v1` for partners (stable, cacheable, curl-able). GraphQL or one BFF per client type for the apps, so each screen gets exactly its fields in one round trip. gRPC between internal services.
</details>

<details><summary>7. What is the GraphQL N+1 problem and the fix?</summary>

Resolving a list of N items, each with a nested field, fires 1 query for the list and N queries for the nested field. DataLoader batches all the ids requested in one tick into one `IN (...)` query and caches them per request.
</details>

<details><summary>8. A report export takes 3 minutes. Design the API.</summary>

`POST /v1/exports` returns `202` with a `jobId`. The client polls `GET /v1/exports/{jobId}` (with a `Retry-After` hint) or registers a webhook. When done, the status points to a signed, expiring download URL in blob storage. The POST takes an idempotency key so a retry does not start a second export.
</details>

## Go deeper

- Next: [H05 Real-time: polling, SSE, WebSockets](../H05-realtime-communication/) for when request/response is not enough.
- Front door for these APIs: [H06 Proxies and the API gateway](../H06-proxies-api-gateway/).
- Retries and exactly-once effect: [H22 Delivery semantics](../../4-async/H22-delivery-semantics/).
- Limits and auth on public APIs: [H26 Rate limiting](../../5-reliability/H26-rate-limiting/), [H31 Security and auth](../../5-reliability/H31-security-auth/).
- LLD with idempotency in code: [Payment wallet](../../../lld/problems/19-payment-wallet/README.md).
- Archive notes: [hld-parts/part1.md](../../../archive/notes/hld-parts/part1.md) (REST principles), [hld-parts/part3.md](../../../archive/notes/hld-parts/part3.md) (API design patterns, idempotency).
