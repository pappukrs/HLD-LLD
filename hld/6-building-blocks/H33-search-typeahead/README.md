# H33 · Search: inverted index and typeahead

> **Time:** ~50 min · **Visual:** [visual.html](visual.html) · **Code:** [demo.ts](demo.ts) (`npx tsx hld/6-building-blocks/H33-search-typeahead/demo.ts`) · **Lab:** [lab-trie](lab-trie/README.md)
> **Builds on:** [H11 Indexing](../../3-databases/H11-indexing/README.md) · [H24 Event-driven and CQRS](../../4-async/H24-event-driven-cqrs/README.md) · [H16 Partitioning and sharding](../../3-databases/H16-partitioning-sharding/README.md) · [H09 Caching](../../2-scaling/H09-caching/README.md) · **Used in:** Search autocomplete, Web crawler, Food delivery (restaurant and dish search), Photo sharing (hashtag search)

## The idea in one line

For full-text search, map every word to the sorted list of documents that contain it (an **inverted index**), intersect the lists and rank the hits; for **typeahead**, precompute the top suggestions for every prefix and serve them from memory.

## Why it matters (the problem it solves)

`SELECT * FROM products WHERE name LIKE '%running shoe%'` cannot use a B-tree: a B-tree is sorted by the start of the string, and the leading `%` gives no starting point, so the DB scans every row. Even if it were fast, it cannot handle:

- "shoes" vs "shoe" vs "Shoe" (stemming and case)
- typos ("runing")
- ranking: which of 40,000 matches is the best?
- facets ("brand", "price range") with counts
- 10,000 queries a second over 100M products

Typeahead is stricter still: a suggestion on **every keystroke**, under about 100 ms end to end, so the server side must answer in a few milliseconds.

## How it works

### 1. The inverted index

```
doc1: "Red Running Shoes"     doc2: "Blue Running Jacket"     doc3: "Red Jacket"

term     posting list (sorted doc ids, + positions)
red    -> [1:0, 3:0]
run    -> [1:1, 2:1]        <- "running" stemmed to "run"
shoe   -> [1:2]
blue   -> [2:0]
jacket -> [2:2, 3:1]
```

A forward index says "doc -> words". An inverted index flips it: "word -> docs". This is the same idea as the index at the back of a book.

### 2. The analysis pipeline

The **same** pipeline runs at index time and at query time, or terms will not match:

```
"Running Shoes!"  -> tokenize -> [Running, Shoes]
                  -> lowercase -> [running, shoes]
                  -> stop words (optional) -> [running, shoes]
                  -> stem -> [run, shoe]
                  -> synonyms (optional) -> tv => television
```

Typo tolerance: fuzzy matching by edit distance (Elasticsearch `fuzziness: AUTO` allows 1 to 2 edits), or n-gram analysers.

### 3. Answering a query: intersect posting lists

Query `red AND jacket`: get both lists and merge them with two pointers. They are sorted by doc id, so the merge is O(a + b) and never goes backwards.

```
red:    [1, 3]        compare 1 vs 2 -> 1 is smaller, advance red
jacket: [2, 3]        compare 3 vs 2 -> 2 is smaller, advance jacket
                      compare 3 vs 3 -> match: doc3
```

Real engines add **skip pointers** (jump ahead in long lists) and start with the **shortest list** first. OR queries union the lists and let ranking sort it out.

### 4. Ranking: TF-IDF and BM25

- **TF** (term frequency): a term that appears more in this doc counts more.
- **IDF** (inverse document frequency): a rare term counts more than a common one. "jacket" in 2 of 1M docs matters; "the" does not.
- **BM25** is TF-IDF with two fixes: TF **saturates** (the 10th "shoe" adds little, controlled by `k1 ≈ 1.2`) and long documents are **normalised** (controlled by `b ≈ 0.75`). It is the default scorer in Lucene, Elasticsearch and OpenSearch.

```
score(doc, query) = sum over terms t of  IDF(t) * tf * (k1 + 1) / (tf + k1 * (1 - b + b * docLen / avgLen))
```

Then business signals on top: popularity, rating, in-stock, distance, personalisation. Large systems use **two stages**: BM25 picks the top 500 cheaply, then a learning-to-rank model re-scores them.

### 5. Elasticsearch / OpenSearch architecture

```
Postgres (source of truth)
   |  CDC (Debezium) or outbox
   v
 Kafka  --->  Indexer (idempotent upsert by doc id + version)
                 |
     +-----------+-----------+
     v                       v
  ES node 1               ES node 2
  P0 (primary)  R1        P1 (primary)  R0         <- shards + replicas
     ^                       ^
     +---- scatter ----------+---- gather top-k ---- Search API (coordinator)
```

- An index is split into **primary shards** (count fixed at creation; changing it needs a reindex or split) plus **replicas** for availability and read throughput.
- Each shard is a Lucene index made of immutable **segments**. New docs sit in an in-memory buffer and become searchable after a **refresh** (default every **1 s**). That is why search is **near-real-time**. Background merges combine small segments.
- A query goes to one copy of every shard (**scatter-gather**). Each shard returns its top k; the coordinator merges them. Tail latency = the slowest shard.
- **Elasticsearch is not the source of truth.** Keep data in the DB, sync with CDC or outbox, and you can always rebuild the index.
- **Zero-downtime reindex**: build `products_v2`, backfill, then switch the alias `products` from v1 to v2 in one atomic call.
- **Deep paging is slow**: page 1,000 means every shard sorts `from + size` hits. Use `search_after` (keyset pagination). Default `max_result_window` is 10,000.

### 6. Typeahead (autocomplete)

```
                 (root)                      each node keeps its TOP-K completions
                /      \                     c   -> [car 90, cat 75, card 60]
               c        d                    ca  -> [car 90, cat 75, card 60]
               |        |                    car -> [car 90, card 60, cart 40]
               a        o
            /  |  \     | \
           r*  t*  k    g* o
          / \      |       |
         d*  t*    e*      r*       * = a full query ends here
```

1. **Offline:** aggregate query logs (last 7 days, recent days weighted more) into `(query, count)`, drop rare and blocked queries, build a **trie where every node stores its top-k** (k = 5 to 10). Rebuild hourly or daily (Spark job), ship as an immutable snapshot.
2. **Online:** the suggestion service holds the trie in memory. A lookup walks the prefix and returns the stored list: **O(prefix length + k)**, no subtree walk. A simpler variant: Redis hash `prefix -> top-10 JSON`.
3. **Client:** debounce keystrokes (100 to 200 ms), cache results per prefix in the browser, and let the CDN cache popular short prefixes (1 to 2 chars) for a few minutes. Most keystrokes never reach your servers.
4. **Freshness:** a small streaming layer counts queries over the last hour (Count-Min sketch, see [H35](../H35-probabilistic-ds/README.md)) and its trending list is merged with the offline top-k.
5. **Sharding:** split by prefix range, but by **measured traffic**, not by letter: "s" gets far more queries than "x".

## In TypeScript

```ts
// Build: term -> sorted doc ids
const index = new Map<string, number[]>();
function addDoc(id: number, text: string) {
  for (const term of new Set(analyze(text))) {          // analyze = tokenize + lowercase + stem
    const list = index.get(term) ?? [];
    list.push(id);                                       // ids arrive in order, so the list stays sorted
    index.set(term, list);
  }
}

// AND query: two-pointer merge of sorted posting lists
function intersect(a: number[], b: number[]): number[] {
  const out: number[] = [];
  let i = 0, j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { out.push(a[i]); i++; j++; }
    else if (a[i] < b[j]) i++;
    else j++;
  }
  return out;
}

// Typeahead: every node caches its top-k, so suggest() never walks the subtree
class Node { children = new Map<string, Node>(); top: { q: string; n: number }[] = []; }
function suggest(root: Node, prefix: string): string[] {
  let node: Node | undefined = root;
  for (const ch of prefix) { node = node.children.get(ch); if (!node) return []; }
  return node.top.map((t) => t.q);
}
```

[demo.ts](demo.ts) runs the full thing: analysis, posting lists, AND/OR queries ranked by BM25, near-real-time refresh, and a trie with cached top-k compared against a full subtree walk.

## Trade-offs / when NOT to use it

| Option | Use when | Weakness |
|---|---|---|
| `LIKE 'abc%'` on a B-tree | Small data, prefix-only match | No relevance, no fuzzy, no "contains" |
| Postgres full-text (`tsvector` + GIN) | Moderate data, want one less system | Weaker ranking, facets and scaling than ES |
| Elasticsearch / OpenSearch | Full-text, fuzzy, facets, large scale | Another cluster to run; eventually consistent with the DB; memory-hungry |
| Trie with cached top-k | Typeahead from query logs | Rebuild cost; memory is O(nodes x k) |
| ES completion suggester / edge n-grams | Typeahead over a catalog (product names) | Bigger index, less control over ranking |
| Managed (Algolia, Typesense Cloud) | Small team, instant search UI | Cost, less control |

Do not add Elasticsearch for exact lookups by id or for "filter by status = PAID". A normal DB index does that, with transactions.

## Common mistakes

- Treating Elasticsearch as the primary database. It can lose acknowledged writes in rare failure cases and has no transactions. Keep the DB as truth.
- Dual writes (app writes DB, then ES). One can fail. Use CDC or the outbox, with an idempotent, versioned indexer.
- Different analysers at index and query time, so "Running" never matches "run".
- Expecting a doc to be searchable right after the write. It shows up after the next refresh (about 1 s). Use `refresh=wait_for` only where the user must see it.
- Too many tiny shards. Each shard costs heap. Aim for roughly 10 to 50 GB per shard.
- Walking the whole trie subtree on every keystroke. Cache top-k in every node.
- Updating the trie on every search at 10B searches a day. Log, aggregate in batch or stream, rebuild.
- Sharding the trie by first letter without looking at traffic skew.

## Say this in the interview

> "Postgres stays the source of truth. Product changes go through the outbox to Kafka, and an idempotent indexer upserts them into Elasticsearch by id and version, so search is about a second behind. The index is an inverted index: each term maps to a sorted posting list, an AND query is a merge of those lists, and BM25 ranks the hits, with boosts for rating and stock. Shards are sized at about 30 GB with one replica, and a query is scatter-gather across shards."

> "For typeahead, a daily Spark job aggregates the last 7 days of query logs and builds a trie where every node stores its top 10 completions. The suggestion service keeps it in memory, so a lookup is O(prefix length). The client debounces at about 150 ms and caches by prefix, and the CDN caches 1 and 2 letter prefixes. Trending queries come from a small streaming layer merged on top."

## Your experience hook

- In the API gateway project you added LRU response caching: typeahead uses the same layered idea (browser cache, CDN, then an in-memory service), and most keystrokes never reach the backend.
- MongoDB to MySQL migration with indexing (Matriot): you know first-hand why `LIKE '%x%'` scans, which is exactly the problem an inverted index solves.
- For payments dashboards, "search transactions by customer name, UPI ref or amount" is a real use case: Postgres is truth, and a CDC pipeline feeds an OpenSearch index for merchant search.

## Numbers to remember

| Fact | Value |
|---|---|
| ES refresh interval (default) | 1 s (near-real-time) |
| `index.max_result_window` | 10,000; use `search_after` beyond |
| Shard size guidance | ~10 to 50 GB per shard |
| BM25 defaults | k1 = 1.2, b = 0.75 |
| Typeahead budget | ~100 ms keystroke to screen; server a few ms |
| Debounce | 100 to 200 ms |
| Trie memory | 10M distinct queries x ~20 chars with top-10 ids per node: a few GB |
| Google-scale typeahead traffic | Each search is ~5 to 10 keystrokes, so suggestion QPS is several times search QPS |

## Self-test

<details><summary>1. Why does LIKE '%shoe%' scan the whole table?</summary>

A B-tree is sorted by the beginning of the string. A leading wildcard gives no starting point in that order, so every row must be checked.
</details>

<details><summary>2. How is an AND query answered from posting lists, and what is its cost?</summary>

Fetch the posting list for each term (sorted by doc id) and merge with two pointers, advancing the smaller id. Cost O(a + b); skip pointers and starting from the shortest list make it faster.
</details>

<details><summary>3. What does BM25 fix compared with plain TF-IDF?</summary>

Term-frequency saturation (repeating a word 50 times stops helping) and document-length normalisation (a long doc does not win just because it has more words).
</details>

<details><summary>4. You indexed a product and a search 200 ms later does not find it. Bug?</summary>

Probably not. The doc becomes searchable after the next refresh (default 1 s). Use `refresh=wait_for` on that write if the user must see it at once.
</details>

<details><summary>5. How do you keep the search index in sync with the database?</summary>

CDC or outbox events to Kafka, then an idempotent indexer that upserts by doc id with an external version, so an older event never overwrites a newer one. A reconciliation job compares counts or checksums and reindexes drift.
</details>

<details><summary>6. Why store top-k at every trie node?</summary>

So a lookup is "walk to the prefix node, return its list": O(prefix + k). Without it, every keystroke walks the whole subtree under the prefix, which for "s" can be millions of nodes.
</details>

<details><summary>7. How do you change the shard count of a live index without downtime?</summary>

Create a new index with the new shard count, backfill it (and double-apply live changes from Kafka), then switch the read alias atomically. Delete the old index later.
</details>

<details><summary>8. How do you make typeahead show a trending query within minutes?</summary>

A streaming job counts queries in a sliding window (for example a Count-Min sketch plus a heap of heavy hitters) and publishes a small trending list that is merged with the offline trie results.
</details>

## Go deeper

- Lab: [lab-trie](lab-trie/README.md) (build the trie with top-k; tests included)
- Case studies: [Search autocomplete](../../case-studies/12-search-autocomplete/README.md) · [Web crawler](../../case-studies/13-web-crawler/README.md) · [Food delivery](../../case-studies/11-food-delivery/README.md)
- Related: [H35 Count-Min sketch](../H35-probabilistic-ds/README.md) for counting queries in a stream
- Archive notes: [hld-parts/part3.md](../../../archive/notes/hld-parts/part3.md) (search engines, Elasticsearch) · [hld-parts/part6b.md](../../../archive/notes/hld-parts/part6b.md) (autocomplete trie) · [hld-parts/part7.md](../../../archive/notes/hld-parts/part7.md) (search and discovery)
- Book: Manning, Raghavan, Schütze, *Introduction to Information Retrieval*, ch. 1, 2, 6
