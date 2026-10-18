// 15 · Pub-Sub Queue (Kafka-lite): your implementation goes here.
// Keep the exported names and signatures; the tests import them.
// Run: npx vitest run lld/problems/15-pub-sub-queue

export interface Message {
  readonly topic: string;
  readonly partition: number;
  readonly offset: number;
  readonly key: string | null;
  readonly value: string;
}

export interface PublishResult {
  readonly partition: number;
  readonly offset: number;
}

export interface AssignmentStrategy {
  /** consumerIds come sorted. Return partition lists for each consumer id. */
  assign(partitionCount: number, consumerIds: readonly string[]): Map<string, number[]>;
}

export interface BrokerConfig {
  hash?: (key: string) => number;
  assignor?: AssignmentStrategy;
}

export interface Consumer {
  readonly id: string;
  readonly groupId: string;
  readonly topic: string;
  /** Partitions this consumer owns, ascending. */
  assignment(): number[];
  /** Reads up to `max` messages from owned partitions, lowest partition first. */
  poll(max?: number): Message[];
  /** Commits the current position of every owned partition. */
  commit(): void;
  /** Moves the read position of an owned partition (replay or skip). */
  seek(partition: number, offset: number): void;
  /** Leaves the group. Triggers a rebalance. */
  close(): void;
}

/** 32-bit FNV-1a. Simple and stable across runs. (Kafka itself uses murmur2.) */
export function fnv1a(text: string): number {
  throw new Error('TODO: h = 0x811c9dc5; for each char: h ^= code; h = Math.imul(h, 0x01000193); return h >>> 0');
}

/** Contiguous ranges. The first (P % C) consumers get one extra partition. */
export class RangeAssignor implements AssignmentStrategy {
  assign(partitionCount: number, consumerIds: readonly string[]): Map<string, number[]> {
    throw new Error('TODO');
  }
}

export class Broker {
  constructor(config: BrokerConfig = {}) {
    // TODO: keep hash and assignor; set up topics and groups
  }

  createTopic(name: string, partitions: number): void {
    throw new Error('TODO');
  }

  /** Same key → same partition, so order per key is kept. No key → round-robin. */
  publish(topicName: string, value: string, key: string | null = null): PublishResult {
    throw new Error('TODO');
  }

  subscribe(topicName: string, groupId: string, consumerId: string): Consumer {
    throw new Error('TODO: join the group and rebalance; return your own Consumer class');
  }

  /** Next offset the group will read from this partition. */
  committed(groupId: string, topicName: string, partition: number): number {
    throw new Error('TODO');
  }

  endOffset(topicName: string, partition: number): number {
    throw new Error('TODO');
  }
}
