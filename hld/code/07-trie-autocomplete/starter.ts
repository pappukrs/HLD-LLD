// 07 · Trie with top-k suggestions: your implementation goes here.
// Keep the exported names and signatures; the tests import them.
// Run: npx vitest run hld/code/07-trie-autocomplete

export interface Suggestion {
  word: string;
  frequency: number;
}

/** Sort order for results: higher frequency first; ties by plain `<` string order. */
export function compareSuggestions(a: Suggestion, b: Suggestion): number {
  throw new Error('TODO');
}

export class Autocomplete {
  /**
   * Adds `frequency` (default 1) to the word's count.
   * Throws on an empty word or a frequency that is not a positive integer.
   */
  insert(word: string, frequency = 1): void {
    throw new Error('TODO');
  }

  /** The stored count of a word, or 0. */
  frequency(word: string): number {
    throw new Error('TODO');
  }

  /** Number of distinct words. */
  get size(): number {
    throw new Error('TODO');
  }

  /** Top k words that start with `prefix`, sorted by compareSuggestions. k <= 0 → []. */
  suggest(prefix: string, k: number): Suggestion[] {
    throw new Error('TODO');
  }
}
