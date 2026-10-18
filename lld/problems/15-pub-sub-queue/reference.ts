// 15 · Pub-Sub Queue (Kafka-lite): reference solution.
// Read this only after your own attempt passes (or after 90 minutes).

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
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Contiguous ranges. The first (P % C) consumers get one extra partition. */
export class RangeAssignor implements AssignmentStrategy {
  assign(partitionCount: number, consumerIds: readonly string[]): Map<string, number[]> {
    const result = new Map<string, number[]>();
    const per = Math.floor(partitionCount / consumerIds.length);
    const extra = partitionCount % consumerIds.length;
    let next = 0;
    consumerIds.forEach((id, i) => {
      const count = per + (i < extra ? 1 : 0);
      result.set(id, Array.from({ length: count }, () => next++));
    });
    return result;
  }
}

interface Topic {
  readonly name: string;
  readonly partitions: Message[][]; // each partition is an append-only log
  roundRobin: number;
}

interface Group {
  readonly id: string;
  readonly topic: Topic;
  readonly members: Map<string, GroupConsumer>;
  readonly committed: number[]; // next offset to read, per partition
}

class GroupConsumer implements Consumer {
  // partition → next offset to read. Only owned partitions are present.
  readonly positions = new Map<number, number>();
  private closed = false;

  constructor(
    readonly id: string,
    private readonly group: Group,
    private readonly onLeave: (c: GroupConsumer) => void,
  ) {}

  get groupId(): string {
    return this.group.id;
  }

  get topic(): string {
    return this.group.topic.name;
  }

  assignment(): number[] {
    return [...this.positions.keys()].sort((a, b) => a - b);
  }

  poll(max = 100): Message[] {
    this.assertOpen();
    const out: Message[] = [];
    for (const p of this.assignment()) {
      const log = this.group.topic.partitions[p];
      let pos = this.positions.get(p)!;
      while (out.length < max && pos < log.length) out.push(log[pos++]);
      this.positions.set(p, pos);
      if (out.length >= max) break;
    }
    return out;
  }

  commit(): void {
    this.assertOpen();
    for (const [p, pos] of this.positions) this.group.committed[p] = pos;
  }

  seek(partition: number, offset: number): void {
    this.assertOpen();
    if (!this.positions.has(partition)) throw new Error(`Partition ${partition} is not assigned to ${this.id}`);
    const end = this.group.topic.partitions[partition].length;
    if (!Number.isInteger(offset) || offset < 0 || offset > end) throw new Error(`Offset ${offset} out of range`);
    this.positions.set(partition, offset);
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.onLeave(this);
  }

  private assertOpen(): void {
    if (this.closed) throw new Error(`Consumer ${this.id} is closed`);
  }
}

export class Broker {
  private readonly topics = new Map<string, Topic>();
  private readonly groups = new Map<string, Group>();
  private readonly hash: (key: string) => number;
  private readonly assignor: AssignmentStrategy;

  constructor(config: BrokerConfig = {}) {
    this.hash = config.hash ?? fnv1a;
    this.assignor = config.assignor ?? new RangeAssignor();
  }

  createTopic(name: string, partitions: number): void {
    if (this.topics.has(name)) throw new Error(`Topic ${name} already exists`);
    if (!Number.isInteger(partitions) || partitions < 1) throw new Error('Need at least 1 partition');
    this.topics.set(name, { name, partitions: Array.from({ length: partitions }, () => []), roundRobin: 0 });
  }

  /** Same key → same partition, so order per key is kept. No key → round-robin. */
  publish(topicName: string, value: string, key: string | null = null): PublishResult {
    const topic = this.topic(topicName);
    const n = topic.partitions.length;
    const partition = key === null ? topic.roundRobin++ % n : Math.abs(this.hash(key)) % n;
    const log = topic.partitions[partition];
    const msg: Message = { topic: topic.name, partition, offset: log.length, key, value };
    log.push(msg);
    return { partition, offset: msg.offset };
  }

  subscribe(topicName: string, groupId: string, consumerId: string): Consumer {
    const topic = this.topic(topicName);
    const groupKey = `${groupId}::${topicName}`;
    let group = this.groups.get(groupKey);
    if (!group) {
      // A new group starts at the earliest offset.
      group = { id: groupId, topic, members: new Map(), committed: topic.partitions.map(() => 0) };
      this.groups.set(groupKey, group);
    }
    if (group.members.has(consumerId)) throw new Error(`Consumer ${consumerId} already in group ${groupId}`);

    const g = group;
    const consumer = new GroupConsumer(consumerId, g, (c) => {
      g.members.delete(c.id);
      this.rebalance(g);
    });
    g.members.set(consumerId, consumer);
    this.rebalance(g);
    return consumer;
  }

  /** Next offset the group will read from this partition. */
  committed(groupId: string, topicName: string, partition: number): number {
    return this.groups.get(`${groupId}::${topicName}`)?.committed[partition] ?? 0;
  }

  endOffset(topicName: string, partition: number): number {
    const log = this.topic(topicName).partitions[partition];
    if (!log) throw new Error(`Unknown partition ${partition}`);
    return log.length;
  }

  // A partition that stays with its owner keeps its read position.
  // A partition that moves starts at the group's committed offset, so uncommitted messages are delivered again (at-least-once).
  private rebalance(group: Group): void {
    const ids = [...group.members.keys()].sort();
    if (ids.length === 0) return;
    const plan = this.assignor.assign(group.topic.partitions.length, ids);
    for (const id of ids) {
      const consumer = group.members.get(id)!;
      const next = new Set(plan.get(id) ?? []);
      for (const p of [...consumer.positions.keys()]) if (!next.has(p)) consumer.positions.delete(p);
      for (const p of next) if (!consumer.positions.has(p)) consumer.positions.set(p, group.committed[p]);
    }
  }

  private topic(name: string): Topic {
    const topic = this.topics.get(name);
    if (!topic) throw new Error(`Unknown topic ${name}`);
    return topic;
  }
}
