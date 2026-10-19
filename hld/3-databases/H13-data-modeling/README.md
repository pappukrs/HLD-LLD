# H13 · Data modelling and normalization

> **Time:** ~50 min · **Visual:** [visual.html](visual.html) · **Code:** [demo.ts](demo.ts) (`npx tsx hld/3-databases/H13-data-modeling/demo.ts`)
> **Builds on:** [H11 Indexes](../H11-indexing/README.md), [H04 API design](../../1-basics/H04-api-design/README.md) · **Used in:** URL shortener, payment system, ticket booking, hotel booking, digital wallet, chat system; LLD BookMyShow, library management, payment wallet, e-commerce cart

## The idea in one line

Store each fact in exactly one place (normalize), connect facts with keys, and then copy data on purpose only where a hot read path needs it (denormalize), knowing who keeps the copy in sync.

## Why it matters (the problem it solves)

A schema is the hardest thing to change later. Code can be redeployed in minutes. A bad schema on a 2 TB table needs a multi-week migration.

When you keep everything in one wide "spreadsheet" table, three bugs appear:

| Anomaly | What happens | Example (one `orders_flat` table) |
|---|---|---|
| **Update anomaly** | One fact lives in many rows. Change it, miss one row, and the data now disagrees with itself. | Asha's email is in all 40 of her order rows. A job updates 39 and crashes. |
| **Insert anomaly** | You cannot store a fact until an unrelated fact exists. | You cannot add a new product until someone orders it. |
| **Delete anomaly** | Deleting one fact deletes another fact by accident. | Delete the only order for "Bag" and the product's name and price are gone. |

Normalization removes these by design. Denormalization brings back some duplication, but only where you choose and only with a sync plan.

In an HLD round the "data model" step comes right after the API. The interviewer checks: can you name the entities, pick keys, show 1:N and M:N correctly, and say which copies you made for speed?

## How it works

### 1. The modelling process (do it in this order)

```
requirements ─► entities ─► relationships ─► keys ─► normalize to 3NF
                                                         │
                 indexes ◄── denormalize hot paths ◄── list access patterns (query + QPS)
```

1. **Entities**: the nouns in the requirements. User, Order, Product, Payment.
2. **Relationships**: 1:1, 1:N, M:N between them.
3. **Keys**: a primary key for each table, foreign keys for each relationship.
4. **Normalize** until each non-key column depends on "the key, the whole key, and nothing but the key".
5. **Access patterns**: write each query with its rate. "Order page by id, 5k/s". "User's orders newest first, 2k/s".
6. **Denormalize** only the patterns that are too slow or too costly as joins.
7. **Indexes** for every WHERE / ORDER BY in step 5 ([H11](../H11-indexing/README.md)).

### 2. Relationships and where the foreign key goes

| Type | Example | How to store it |
|---|---|---|
| 1:1 | user ↔ user_profile | Same PK in both tables (`profile.user_id` is PK and FK). Split only if columns are large or rarely read. |
| 1:N | customer → orders | FK on the **many** side: `orders.customer_id`. Index it. |
| M:N | orders ↔ products | **Junction table** `order_items(order_id, product_id, qty)`, PK `(order_id, product_id)`. |
| Self 1:N | employee → manager | `employees.manager_id` FK to the same table. |
| Polymorphic | comment on post or photo | Prefer two nullable FKs with a CHECK, or one table per parent. Avoid `(target_type, target_id)` without FK. |

```
customers 1 ───< N orders 1 ───< N order_items N >─── 1 products
 (cust_id PK)     (order_id PK,      (order_id, product_id) PK   (product_id PK)
                   cust_id FK)        qty, unit_price_paise
```

The junction table often grows its own columns (qty, price at purchase, role, joined_at). That is a sign it is a real entity.

### 3. Keys: natural vs surrogate

| Key | Example | Good | Bad |
|---|---|---|---|
| Natural | email, PAN, ISBN | Meaningful, already unique | Can change (emails do), may be long, may leak PII in URLs |
| Surrogate auto-increment | `BIGSERIAL` | Small (8 B), ordered, fast B-tree inserts | Guessable, needs one sequence (hard across shards) |
| UUID v4 | random 128-bit | Generated anywhere, not guessable | 16 B, random inserts split B-tree pages |
| Time-ordered (UUID v7, Snowflake) | 64/128-bit with time prefix | Generated anywhere and insert-friendly | Leaks creation time ([H28](../../5-reliability/H28-unique-ids/README.md)) |

Rule: use a surrogate PK, and put a `UNIQUE` constraint on the natural key (email, ISBN). Then the natural key can change without touching every FK.

### 4. Normal forms (the ones that matter)

Start with this 1NF table (key = `(order_id, product_id)`):

```
order_id | product_id | product_name | price | qty | cust_id | email
101      | P1         | Pen          | 10    | 2   | C1      | asha@x.in
101      | P2         | Book         | 250   | 1   | C1      | asha@x.in
102      | P3         | Bag          | 900   | 1   | C1      | asha@x.in
103      | P1         | Pen          | 10    | 5   | C2      | ravi@y.in
```

| Form | Rule | Violation here | Fix |
|---|---|---|---|
| **1NF** | Each cell holds one atomic value; no repeating groups. | The raw version had `items = "Pen x2, Book x1"` in one cell. | One row per order line. |
| **2NF** | 1NF + no non-key column depends on only **part** of a composite key. | `product_name, price` depend only on `product_id`. `cust_id` depends only on `order_id`. | Move to `products(product_id, name, price)` and `orders(order_id, cust_id, …)`. |
| **3NF** | 2NF + no non-key column depends on another non-key column (no transitive dependency). | `email` depends on `cust_id`, which depends on `order_id`. | Move to `customers(cust_id, name, email)`. |
| **BCNF** | Every determinant is a candidate key. | Rare in practice. Example: `(student, course) → teacher` and `teacher → course`. | Split `teacher → course` into its own table. |

The test for each column: "If I know only X, do I know this value?" If X is not the whole key, the column is in the wrong table. This "X → Y" is a **functional dependency**. `demo.ts` checks them on real rows.

4NF and 5NF exist (multi-valued and join dependencies). Mention them only if asked. Most production OLTP schemas aim for 3NF.

### 5. Denormalize on purpose

After 3NF, the order page needs a 4-table join. That is fine at 5k/s with FK indexes. It becomes a problem when one read fans out across shards or services, or runs 100k times per second.

| Technique | Example | Who keeps it in sync |
|---|---|---|
| **Snapshot copy** (not really duplication) | `order_items.unit_price_paise` = price at purchase time | Nobody. It must **not** change when the product price changes. |
| **Derived counter** | `posts.like_count` | Same transaction as the `likes` insert, or async from events ([H37](../../6-building-blocks/H37-data-at-scale/README.md)) |
| **Copied column** | `orders.customer_name` for an admin list | Event/CDC consumer; accept seconds of lag |
| **Materialized view** | daily sales per seller | `REFRESH MATERIALIZED VIEW` on a schedule |
| **Read model** | search index, feed table | CQRS projector from events ([H24](../../4-async/H24-event-driven-cqrs/README.md)) |

Rules:
- Keep one **source of truth** per fact. Every copy is derived and can be rebuilt.
- Copy data that rarely changes (product name) or that must be frozen (price paid, address shipped to). Do not copy fast-changing data (user display name into 10M messages).
- Write down the sync path next to every copy. "Copy without a sync plan" is a bug report waiting.

### 6. Document and wide-column modelling (a preview of H14)

NoSQL flips the order: **list access patterns first, then shape the data to answer each one in one read.**

| Choice | Embed (store inside the parent) | Reference (store an id) |
|---|---|---|
| Use when | Child is read with parent, bounded size, owned by parent | Child is shared, unbounded, or updated on its own |
| Example | order → its line items and shipping address | order → product (shared by many orders) |
| Risk | 16 MB Mongo doc limit; rewriting a big doc on each change | Extra round-trip, no join in many stores |

In Cassandra and DynamoDB you design one table (or one item type) per query, with the partition key chosen for even spread ([H16](../H16-partitioning-sharding/README.md)). Duplication is the default there, so the sync plan matters even more.

### 7. Patterns you will reuse in many designs

- **Money as integers**: `amount_paise BIGINT` (or `NUMERIC(19,4)`), never `FLOAT`. 0.1 + 0.2 is not 0.3.
- **Append-only ledger**: `ledger_entries(id, account_id, amount_paise, direction, ref_id)`. Balance = sum, or a cached `accounts.balance` updated in the same transaction. Never update a past entry; post a reversing entry.
- **Status + history**: `payments.status` for the current state, `payment_events` for every transition.
- **Soft delete**: `deleted_at TIMESTAMPTZ NULL` plus a partial unique index `WHERE deleted_at IS NULL`.
- **Audit columns**: `created_at`, `updated_at`, `version` (for optimistic locking, [H12](../H12-transactions-isolation/README.md)).
- **JSONB for the long tail**: fixed, queried fields as columns; rare, flexible attributes in a `JSONB` column with a GIN index if needed.
- **Constraints are free correctness**: `NOT NULL`, `UNIQUE (user_id, post_id)` stops double likes, `CHECK (amount_paise > 0)`.

## In TypeScript

Checking a functional dependency on sample rows (the full version is in `demo.ts`):

```ts
type Row = Record<string, string | number>;

// Does knowing `lhs` always give one value of `rhs`?  (lhs → rhs)
function holds(rows: Row[], lhs: string[], rhs: string): boolean {
  const seen = new Map<string, Row[string]>();
  for (const r of rows) {
    const k = lhs.map((c) => r[c]).join('|');
    if (seen.has(k) && seen.get(k) !== r[rhs]) return false;
    seen.set(k, r[rhs]);
  }
  return true;
}

holds(flat, ['product_id'], 'price'); // true  → partial dependency: 2NF violation
holds(flat, ['cust_id'], 'email');    // true  → transitive dependency: 3NF violation
```

The final schema as DDL:

```sql
CREATE TABLE customers  (cust_id BIGINT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE);
CREATE TABLE products   (product_id BIGINT PRIMARY KEY, name TEXT NOT NULL, price_paise BIGINT NOT NULL CHECK (price_paise > 0));
CREATE TABLE orders     (order_id BIGINT PRIMARY KEY, cust_id BIGINT NOT NULL REFERENCES customers,
                         total_paise BIGINT NOT NULL, placed_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE order_items(order_id BIGINT REFERENCES orders, product_id BIGINT REFERENCES products,
                         qty INT NOT NULL CHECK (qty > 0), unit_price_paise BIGINT NOT NULL,  -- snapshot
                         PRIMARY KEY (order_id, product_id));
CREATE INDEX ON orders (cust_id, placed_at DESC);   -- "my orders, newest first"
```

## Trade-offs / when NOT to use it

| Choice | Use when | Cost |
|---|---|---|
| Fully normalized (3NF) | OLTP, many writers, correctness matters (payments, inventory, bookings) | Joins on reads; harder to shard across a join |
| Selective denormalization | A few hot reads dominate; joins cross shards or services | Write amplification; sync code; stale copies |
| Star schema (fact + dimension tables) | Analytics / OLAP warehouses | Deliberately denormalized dimensions; not for OLTP writes |
| Document embed | Aggregate read as a whole, bounded size | Shared data gets duplicated; big docs rewrite on change |
| Query-first wide-column | Known, huge-rate access patterns | Every new query may need a new table |

Do not normalize to the extreme: splitting `city` out of `addresses` into a `cities` table to save a few bytes adds a join and helps nobody. Do not denormalize early: "joins are slow" is false for indexed joins on a few thousand rows per second.

## Common mistakes

- Drawing tables before listing access patterns, so the schema cannot serve the main query without a scan.
- Putting an M:N as a comma list (`tags = 'a,b,c'`) or an array, then needing "all posts with tag b".
- Storing money as `FLOAT`, or storing a price on the order line that "joins to the current product price". Old invoices then change.
- Copying mutable data (user name, avatar) into millions of rows with no sync plan.
- Using email or phone as the primary key. Users change them.
- Forgetting the index on the FK column. `DELETE FROM customers` then scans `orders` for each row.
- No uniqueness constraint, relying on app code "checking first". Two concurrent requests both pass the check ([H12](../H12-transactions-isolation/README.md)).
- One table per status (`pending_orders`, `paid_orders`). Use a `status` column and history table.

## Say this in the interview

> "My entities are customers, orders, products and payments. Customer to order is 1:N, so `orders.customer_id` is a foreign key with an index on `(customer_id, placed_at DESC)` for the order history page. Orders to products is M:N, so I add `order_items` with a composite primary key `(order_id, product_id)`. The core tables are in 3NF, so each fact lives in one place and there are no update anomalies."

> "I denormalize only two things. First, `order_items.unit_price` is a snapshot of the price at purchase. That is not duplication, it is a different fact, and it must not change when the catalog price changes. Second, `orders.total` is cached and written in the same transaction as the items. If the admin list later needs customer names without a join, I would copy them through a CDC consumer and accept a few seconds of lag."

## Your experience hook

- **MongoDB to MySQL migration (Matriot IoT, 10k+ devices)**: "Device data started in Mongo with embedded readings. Reporting needed joins across devices, sites and users, so we moved to MySQL, normalized devices and sites into their own tables, kept readings in a narrow append-only table, and added composite indexes for the dashboard queries."
- **Payment orchestration (SenseGrass)**: the model was `payment_intents` (status as a state machine), `payment_events` (append-only history), and a unique `idempotency_key`. Amounts were integer minor units. The unique constraint, not app code, stopped double charges.
- **Cache-aside on dashboards (Chesa)**: the cached JSON is a denormalized read model. The DB stays normalized as the source of truth, and the cache key is invalidated on write.

## Numbers to remember

- One indexed PK lookup in Postgres: ~0.1 ms on a warm cache. A 4-table join on indexed FKs returning 10 rows: ~1 ms.
- `BIGINT` = 8 bytes, UUID = 16 bytes. 1B rows × 8 extra bytes per key copy = ~8 GB more per index that stores it.
- Mongo document limit: 16 MB. DynamoDB item limit: 400 KB. Postgres row: practical limit is ~8 KB per page before TOAST moves big values out of line.
- Fan-out cost of a copied column: 1 update × N rows. A name copied into 1M messages = 1M writes per rename.

## Self-test

<details><summary>1. Name the three anomalies normalization prevents, with one example each.</summary>

Update (Asha's email in 40 rows, one missed), insert (cannot add a product until it is ordered), delete (deleting the last order of Bag deletes Bag's price).
</details>

<details><summary>2. Table key is (order_id, product_id). product_name depends on product_id. Which normal form is broken?</summary>

2NF. A non-key column depends on only part of the composite key. Move it to `products`.
</details>

<details><summary>3. What is a transitive dependency? Give one.</summary>

A non-key column that depends on another non-key column: `order_id → cust_id → email`. Fix it by moving email into `customers` (3NF).
</details>

<details><summary>4. Where does the foreign key go in 1:N, and how do you store M:N?</summary>

1:N: on the many side (`orders.customer_id`), indexed. M:N: a junction table with a composite PK, e.g. `order_items(order_id, product_id)`.
</details>

<details><summary>5. Is storing unit_price on order_items denormalization? Should it update when the product price changes?</summary>

No and no. It is the price at purchase time, a separate historical fact. Changing it would rewrite past invoices.
</details>

<details><summary>6. When would you embed vs reference in MongoDB?</summary>

Embed when the child is always read with the parent, bounded in size and owned by it (order lines, shipping address). Reference when it is shared, unbounded or updated on its own (products, comments on a viral post).
</details>

<details><summary>7. Why not use email as the primary key of users?</summary>

Emails change, and every FK in every table would need updating. They are also longer than 8 bytes and leak PII into URLs and logs. Use a surrogate id with a UNIQUE constraint on email.
</details>

<details><summary>8. You copied customer_name into orders for an admin list. How do you keep it correct?</summary>

The `customers` table stays the source of truth. A change event (outbox or CDC) feeds an idempotent consumer that updates the copies, plus a periodic repair job. Accept a few seconds of lag and say so.
</details>

## Go deeper

- Next: [H14 SQL vs NoSQL](../H14-sql-vs-nosql/README.md) (choosing the store), [H16 Partitioning](../H16-partitioning-sharding/README.md) (picking partition keys), [H37 Data at scale](../../6-building-blocks/H37-data-at-scale/README.md) (fan-out, hot keys, counters)
- Case studies that need a careful schema: [08 Payment system](../../case-studies/08-payment-system/README.md), [28 Digital wallet](../../case-studies/28-digital-wallet/README.md), [09 Ticket booking](../../case-studies/09-ticket-booking/README.md), [23 Hotel booking](../../case-studies/23-hotel-booking/README.md), [01 URL shortener](../../case-studies/01-url-shortener/README.md), [06 Chat system](../../case-studies/06-chat-system/README.md)
- LLD problems whose entities map to tables: [13 BookMyShow](../../../lld/problems/13-bookmyshow/README.md), [12 Library management](../../../lld/problems/12-library-management/README.md), [19 Payment wallet](../../../lld/problems/19-payment-wallet/README.md), [20 E-commerce cart](../../../lld/problems/20-ecommerce-cart-coupons/README.md)
- Archive notes: [hld-parts/part1.md](../../../archive/notes/hld-parts/part1.md) ("Normalization vs Denormalization")
- Books: DDIA chapter 2 (relational vs document models); Alex DeBrie, *The DynamoDB Book* (access-pattern-first design)
