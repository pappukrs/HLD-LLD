# SD Day 14 — API Design: REST vs gRPC vs GraphQL (+ versioning, pagination)

*(~1 hr · building-blocks block. Day 13 was "protect the API" (rate limiting); today is "design the
API" — the contract every client and service talks through. You've shipped REST APIs, gRPC between
microservices (your fintech work), and consumed GraphQL — today names the trade-offs so you can
*choose* in an interview and defend it. Pairs with Day 11 (queues: async vs the sync request/response
here) and Day 24 (microservices: gateways/BFF sit on these contracts).)*

---

## 1. What "API design" actually means

An **API is a contract**: how a client asks for something and what it gets back. A good contract is
**clear** (predictable, well-named), **stable** (doesn't break clients when you evolve it),
**efficient** (right amount of data, right number of round trips), and **discoverable** (others can
learn it without asking you). The three dominant styles — **REST, gRPC, GraphQL** — make different
trade-offs across those four. There's no "best"; there's "best **for this caller and this traffic**."

> **One line:** *An API is a contract between caller and service; REST, gRPC, and GraphQL are three
> ways to write that contract, each optimizing for a different consumer.*

The two axes that decide most of it: **who's calling** (public 3rd-party? your own mobile app?
another internal service?) and **what hurts** (too many round trips? over-fetching? loose contracts?).

---

## 2. REST — resources over HTTP (the default)

**REST** models everything as **resources** identified by **URLs**, manipulated with **HTTP verbs**.
It's the lingua franca of public web APIs.

```
GET    /users/123          → fetch user 123
POST   /users             → create a user
PUT    /users/123         → replace user 123     (idempotent)
PATCH  /users/123         → partially update     (Day 12: idempotency keys help here)
DELETE /users/123         → delete               (idempotent)
```

Core ideas:
- **Resource-oriented** nouns in the URL, **verbs** as the HTTP method. `GET /users/123/orders`, not
  `GET /getUserOrders?id=123`.
- **Stateless** — each request carries everything needed (auth token etc.); the server keeps no
  per-client session. (This is *why* REST scales horizontally — Day 1.)
- **HTTP status codes** carry meaning: `200` ok, `201` created, `400` bad request, `401`/`403`
  auth, `404` not found, `429` rate-limited (Day 13), `5xx` server error.
- Usually **JSON** over HTTP/1.1 or HTTP/2.

✅ Simple, universal, cacheable (HTTP caching/CDN — Day 4), human-readable, great for **public APIs**.
❌ **Over-fetching / under-fetching:** a fixed endpoint returns a fixed shape — you get fields you
don't need, or must call several endpoints to assemble one screen (the **N+1 round-trips** problem on
mobile). Looser contract (JSON has no enforced schema unless you add OpenAPI).

**Use when:** public-facing APIs, CRUD-shaped resources, you want HTTP caching and broad compatibility.

---

## 3. gRPC — typed RPC over HTTP/2 (service-to-service)

**gRPC** is **Remote Procedure Call**: you call a function on another service as if it were local.
You define the contract in a **`.proto`** file (Protocol Buffers); codegen produces typed client +
server stubs in any language.

```proto
service UserService {
  rpc GetUser (GetUserRequest) returns (User);
}
message GetUserRequest { int64 id = 1; }
message User { int64 id = 1; string name = 2; }
```

Core ideas:
- **Protobuf** = a **binary**, schema-first serialization → much smaller + faster to encode/decode
  than JSON text.
- Runs on **HTTP/2** → multiplexing, and **streaming** (client-stream, server-stream, or
  bidirectional) — great for real-time/IoT telemetry.
- **Strongly typed contract** — the `.proto` is the single source of truth; breaking changes are
  caught at compile time.

✅ **Fast and compact** (binary), **streaming**, strict typed contracts, polyglot codegen — ideal for
**internal microservice-to-microservice** calls at scale.
❌ Not human-readable (binary), **poor browser support** (needs grpc-web + a proxy), harder to
debug/curl, no native HTTP caching. Overkill for simple public CRUD.

**Use when:** internal east-west traffic between services, low latency / high throughput, streaming,
polyglot backends. (This is exactly your fintech microservices over gRPC — say that.)

---

## 4. GraphQL — the client asks for exactly what it needs

**GraphQL** exposes **one endpoint** (`POST /graphql`) and a **typed schema**; the **client writes a
query** describing precisely the fields it wants, and gets back exactly that shape — no more, no less.

```graphql
query {
  user(id: 123) {
    name
    orders(last: 5) { id total }   # one round trip, exactly these fields
  }
}
```

Core ideas:
- **Client-specified response shape** → kills **over-fetching and under-fetching**. One request can
  stitch together what REST would need several endpoints for.
- **Strongly typed schema** + great introspection/tooling (GraphiQL).
- **Queries** (read), **mutations** (write), **subscriptions** (real-time over WebSockets).

✅ Perfect for **rich frontends / mobile** with varied data needs and bandwidth limits; one round trip;
self-documenting; frontend iterates without new backend endpoints.
❌ **Caching is hard** (it's all `POST` to one URL — you lose simple HTTP/CDN caching). **Server
complexity** (resolvers, the classic **N+1 query** problem → needs DataLoader/batching). Easy for a
client to write an **expensive query** → you need depth/complexity limits + rate limiting. Overkill
for simple internal services.

**Use when:** many heterogeneous clients (web + mobile) with different field needs, a "graph" of
related data, frontend velocity matters.

---

## 5. The comparison (say this in the interview)

| | REST | gRPC | GraphQL |
|---|---|---|---|
| Style | Resources + HTTP verbs | Typed RPC (call a function) | Query a typed schema |
| Payload | JSON (text) | Protobuf (binary) | JSON (text) |
| Transport | HTTP/1.1 or 2 | HTTP/2 (+ streaming) | HTTP (+ WS for subs) |
| Contract | Loose (add OpenAPI) | Strict (`.proto`) | Strict (schema) |
| Fetching | Over/under-fetch | Fixed per RPC | **Exactly what's asked** |
| Caching | **Easy (HTTP/CDN)** | Hard | Hard |
| Browser | Native | Needs grpc-web/proxy | Native |
| Sweet spot | **Public APIs / CRUD** | **Internal microservices** | **Rich/mobile frontends** |

> **Default answer:** *"**REST** for public/3rd-party and simple CRUD; **gRPC** for internal
> service-to-service where latency, streaming, and strict contracts matter; **GraphQL** at the edge
> when many clients need different slices of related data. They're not mutually exclusive — I often use
> gRPC internally behind a REST or GraphQL gateway."*

That last point is gold: a real system frequently uses **all three** — GraphQL/REST at the edge (a
BFF), gRPC between services behind it.

---

## 6. Versioning — evolve without breaking clients

Clients you don't control will break if you change a response shape. So you version. Two big rules:

- **Additive changes are safe; removals/renames/type-changes are breaking.** Adding a new optional
  field shouldn't break anyone → prefer evolving additively. (Protobuf bakes this in: fields have
  numbers and are optional — you never reuse a tag number.)
- **When you must break, version explicitly.** Common strategies for REST:
  - **URL path:** `/v1/users` → `/v2/users`. Most visible/common, easy to route.
  - **Header / media type:** `Accept: application/vnd.api.v2+json`. Cleaner URLs, less obvious.
  - **Query param:** `/users?version=2`. Simple but messy.

GraphQL's philosophy is **avoid versioning** — add new fields, **`@deprecated`** old ones, and remove
once usage drops (you can measure field usage). gRPC: evolve the `.proto` additively, never reuse field
numbers; cut a new service version only for true breaks.

**The real discipline:** publish a **deprecation policy** — announce, give a window, monitor usage, then
remove. Never silently change a field's meaning (that's the worst kind of break — it "works" but lies).

> **Hook:** *"Add, don't mutate; deprecate, don't delete-overnight. Version the URL only when you truly
> break the contract."*

---

## 7. Pagination — never return an unbounded list

A `GET /orders` that returns *all* orders will eventually return millions → slow, memory-blowing,
unusable. **Always paginate** collection endpoints. Two main styles:

- **Offset / page-based:** `?limit=20&offset=40` (or `?page=3`). Simple, lets you jump to any page.
  ❌ **Slow at deep offsets** (`OFFSET 1000000` still scans+skips a million rows) and **inconsistent
  under writes** — if a row is inserted/deleted while paging, you get **duplicates or skips** across
  pages.
- **Cursor / keyset-based:** `?limit=20&after=<cursor>`, where the cursor encodes "the last item I
  saw" (e.g. an indexed `id`/`created_at`). The query becomes `WHERE id > :cursor ORDER BY id LIMIT
  20`. ✅ **Fast at any depth** (uses the index, no skipping) and **stable** under inserts/deletes.
  ❌ Can't jump to an arbitrary page; needs a stable sort key.

> **Rule of thumb:** offset for small admin tables where "go to page 7" matters; **cursor for large,
> fast-changing feeds** (timelines, infinite scroll) — which is why every big API (Twitter, Stripe,
> Slack) uses cursors.

Also return useful **metadata**: `next_cursor`/`has_more` (cursor) or `total_count`/`page` (offset),
so clients know when to stop. GraphQL standardizes this as **Relay connections** (`edges`, `node`,
`pageInfo.endCursor`) — same cursor idea, formalized.

> **Hook:** *"Offset is page numbers (simple but slow + drifts); cursor is 'give me what's after
> this' (fast + stable) — use cursors for big feeds."*

---

## 8. Cross-cutting good-API hygiene (quick hits)

- **Idempotency** (Day 12): `GET/PUT/DELETE` idempotent; protect `POST` with idempotency keys.
- **Errors:** consistent shape (`{error: {code, message}}`) + correct status codes; never return `200`
  with an error body.
- **Auth:** tokens (OAuth2/JWT), not sessions, to stay stateless (Day 28).
- **Rate limiting** (Day 13) + **pagination** = protect the server from abuse and from itself.
- **Filtering/sorting:** query params (`?status=open&sort=-created_at`), documented.
- **Documentation:** OpenAPI/Swagger for REST; the schema *is* the doc for gRPC/GraphQL.

---

## 9. Map it to YOUR systems (interview gold)

- **Fintech microservices:** **gRPC** for internal payment/ledger/notification service calls — strict
  `.proto` contracts, binary speed, typed across languages — behind a **REST** gateway for external
  partners. Versioned `.proto` (additive, never reuse field numbers); idempotency keys on charge RPCs.
- **Mobile / PWA (CHESA offline-first):** a **GraphQL or BFF** layer makes sense — the mobile client
  fetches exactly the fields it needs in one round trip (bandwidth matters offline), instead of N REST
  calls.
- **IoT telemetry (10k+ devices):** **gRPC streaming** over HTTP/2 fits device→server streams far
  better than REST polling.
- **Public/partner APIs:** **REST** with `/v1` versioning, cursor pagination, OpenAPI docs, and rate
  limiting.

> The interview line: *"I pick the API style by the consumer: **REST** for public CRUD and 3rd parties
> (cacheable, universal), **gRPC** for internal service-to-service (binary, streaming, strict
> contracts), **GraphQL** for rich/mobile frontends that need exact data in one round trip. I evolve
> **additively** and version (URL `/v2` or deprecate-then-remove) only on true breaks, and I **always
> paginate** — **cursor-based** for large feeds because offset is slow at depth and drifts under
> writes."*

---

## 10. The traps that catch people

1. **"REST vs GraphQL vs gRPC — which is best?"** There's no winner; answer by **consumer + traffic**.
   Saying "it depends, here's the axis" *is* the senior answer.
2. **Forgetting they compose.** gRPC internally + REST/GraphQL at the edge is the common real design —
   not an either/or.
3. **GraphQL caching & N+1.** Don't pitch GraphQL without naming its costs: hard HTTP caching, resolver
   N+1 (→ DataLoader), expensive-query protection.
4. **Offset pagination at scale.** Proposing `offset` for a huge, live feed → interviewer asks about
   deep-page slowness and duplicates/skips. Reach for **cursors**.
5. **Breaking changes without versioning.** Renaming/removing a field silently breaks clients; have a
   versioning + deprecation policy.
6. **Verbs in REST URLs.** `POST /createUser` is RPC-flavored, not REST. Resources are nouns; verbs are
   HTTP methods.

---

## 11. The whole day on one page (say it out loud)

> *"An API is a contract, and I choose its style by the consumer. **REST** models resources over HTTP
> verbs — simple, universal, cacheable — my default for public APIs and CRUD, but it over- and
> under-fetches. **gRPC** is typed RPC over HTTP/2 with binary Protobuf and streaming — fast, strict,
> polyglot — my pick for internal service-to-service traffic, though it's not browser-friendly or
> cacheable. **GraphQL** lets the client query a typed schema for exactly the fields it needs in one
> round trip — ideal for rich and mobile frontends — at the cost of hard caching and resolver N+1, so
> it needs DataLoader and query-complexity limits. They compose: gRPC internally behind a REST/GraphQL
> edge. I evolve contracts **additively** and version explicitly (URL `/v2`, or deprecate-then-remove)
> only on real breaks. And I **always paginate** collections — **offset** when you need page jumps on
> small data, but **cursor/keyset** for large live feeds because offset is slow at deep pages and
> drifts under concurrent writes."*

**Why it matters next:** APIs are the contracts every later design draws as boxes-and-arrows. Next in
the building-blocks block: **consistent hashing** (how distributed caches/limiters/shards place keys),
then bloom filters and unique-ID generation — the internals behind the services these APIs expose.
