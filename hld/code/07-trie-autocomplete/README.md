# 07 · Trie with top-k suggestions

> Time box: **45 min**
> Concept: [Search, inverted index, typeahead](../../concepts/27-search-indexing.md)

## What it is

A trie (prefix tree) stores words one character per level. All words that start with `ca` live under the node for `c → a`. So finding the words for a prefix costs `O(prefix length)` to reach the node, plus the work to collect the words below it.

For autocomplete, each word has a **frequency** (how often people searched for it). You return the **top k** words for a prefix, highest frequency first.

```
        (root)
        /    \
       c      d
       |      |
       a      o
      / \     |
     r*  t*   g*        * = a word ends here, with its frequency
    /|\
   d* e* t*
      |
     ...ful*
```

## Where it is used

- **Google, Amazon, Flipkart search boxes**: typeahead suggestions.
- **IDEs and shells**: code and command completion.
- **Routers (longest-prefix match), spell checkers, T9 keyboards**.
- At scale the trie is built **offline** (for example hourly, from search logs with Spark), with the top-k cached in every node. It is served from memory and sharded by prefix.

## API to implement (`starter.ts`)

```ts
const ac = new Autocomplete();
ac.insert('cat', 100);          // frequency default 1; inserting again ADDS to the count
ac.insert('car', 50);
ac.suggest('ca', 2);            // → [{ word: 'cat', frequency: 100 }, { word: 'car', frequency: 50 }]
ac.frequency('car');            // → 50 (0 if not a word)
ac.size;                        // → distinct words
compareSuggestions(a, b);       // the sort order the results use
```

Rules the tests check:

| Rule | Detail |
|---|---|
| Order | Higher frequency first. Same frequency: lexicographic with plain `<` (code unit order, not `localeCompare`). |
| Prefix | The prefix itself is included if it is a word. |
| Empty prefix | Returns the top k over all words. |
| `k <= 0`, no match | Return `[]`. |
| Repeated insert | Frequencies add up. `size` counts distinct words. |
| Validation | Empty word throws. Frequency must be a positive integer. |
| Case | Case-sensitive. No normalising. |

## Complexity

Let `P` = prefix length, `M` = words under the prefix node, `N` = all characters stored.

| Version | `insert` | `suggest` | Memory |
|---|---|---|---|
| Collect and sort (the reference) | `O(L)` | `O(P + subtree + M log M)` | `O(N)` |
| Collect with a size-k heap | `O(L)` | `O(P + subtree + M log k)` | `O(N)` |
| Top-k cached in every node | `O(L · k)` | `O(P + k)` | `O(N · k)` |

## Hints

<details>
<summary>Hint 1: the node</summary>

`class TrieNode { children = new Map<string, TrieNode>(); frequency = 0 }`. `frequency > 0` means a word ends here. You do not need a separate `isWord` flag.

</details>

<details>
<summary>Hint 2: collecting the words</summary>

Walk down to the prefix node. Then do a DFS from there, building the word as you go. Use an explicit stack `[node, wordSoFar]` to avoid deep recursion.

</details>

<details>
<summary>Hint 3: the comparator</summary>

`b.frequency - a.frequency`, and if that is 0, compare words with `<` and `>`. Do not use `localeCompare`: its order depends on the locale, and the tests expect code unit order.

</details>

<details>
<summary>Hint 4: the production version (top-k in every node)</summary>

Store in every node the best `K` words of its subtree (for example `K = 10`). `suggest` just reads that list: `O(P + k)`. On `insert`, walk the path and update the list in each node: remove the word if present, add it with the new count, sort, keep `K`. This works because frequencies only go up. It costs more memory and slower writes, which is fine when the trie is rebuilt offline.

</details>

## Extensions interviewers ask

1. **10 billion searches a day.** You cannot update the trie on every search. Log the searches, aggregate them in batch (or with a stream job over a time window), and rebuild the trie every hour or day.
2. **Sharding.** Split by first characters (`a–f`, `g–m`, ...). Some prefixes are much hotter, so split by measured traffic, not by letters.
3. **Freshness.** A trending topic should show up within minutes. Add a small "recent" trie updated from a stream, and merge results.
4. **Personalisation and filtering.** Merge with the user's own history. Remove blocked words before the result is cached.
5. **Caching.** The browser caches results per prefix. The CDN caches popular prefixes. Most traffic never reaches the trie.

## Related

- HLD problem: [Search autocomplete](../../problems/12-search-autocomplete/README.md)
- Also useful: [Count-Min sketch](../10-count-min-sketch/README.md) for counting search terms in a stream.
