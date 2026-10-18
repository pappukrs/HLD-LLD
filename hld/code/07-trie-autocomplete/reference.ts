// 07 · Trie with top-k suggestions: reference solution.
// Read this only after your own attempt passes.
//
// This version collects all words under the prefix and sorts them.
// It is simple and correct. The README explains the faster "top-k cached in each node" version.

export interface Suggestion {
  word: string;
  frequency: number;
}

class TrieNode {
  readonly children = new Map<string, TrieNode>();
  /** > 0 means a word ends here. */
  frequency = 0;
}

/** Higher frequency first. Equal frequency: lexicographic by code unit (plain `<`). */
export function compareSuggestions(a: Suggestion, b: Suggestion): number {
  if (a.frequency !== b.frequency) return b.frequency - a.frequency;
  return a.word < b.word ? -1 : a.word > b.word ? 1 : 0;
}

export class Autocomplete {
  private readonly root = new TrieNode();
  private words = 0;

  /** Adds `frequency` to the word's count. Inserting the same word again adds up. */
  insert(word: string, frequency = 1): void {
    if (word.length === 0) throw new Error('word must not be empty');
    if (!Number.isInteger(frequency) || frequency < 1) throw new Error('frequency must be a positive integer');
    let node = this.root;
    for (const ch of word) {
      let next = node.children.get(ch);
      if (!next) {
        next = new TrieNode();
        node.children.set(ch, next);
      }
      node = next;
    }
    if (node.frequency === 0) this.words++;
    node.frequency += frequency;
  }

  /** The stored count of a word, or 0. */
  frequency(word: string): number {
    return this.find(word)?.frequency ?? 0;
  }

  /** Number of distinct words. */
  get size(): number {
    return this.words;
  }

  /** Top k words that start with `prefix` (the prefix itself counts if it is a word). */
  suggest(prefix: string, k: number): Suggestion[] {
    if (k <= 0) return [];
    const start = this.find(prefix);
    if (!start) return [];
    const found: Suggestion[] = [];
    // Iterative DFS: no recursion limit on long words.
    const stack: Array<[TrieNode, string]> = [[start, prefix]];
    while (stack.length > 0) {
      const [node, word] = stack.pop()!;
      if (node.frequency > 0) found.push({ word, frequency: node.frequency });
      for (const [ch, child] of node.children) stack.push([child, word + ch]);
    }
    // O(M log M) for M matches. A size-k heap would make it O(M log k).
    return found.sort(compareSuggestions).slice(0, k);
  }

  private find(prefix: string): TrieNode | undefined {
    let node: TrieNode | undefined = this.root;
    for (const ch of prefix) {
      node = node.children.get(ch);
      if (!node) return undefined;
    }
    return node;
  }
}
