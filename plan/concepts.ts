// Every concept in the repo, in learning order. This is the map the plan, the hub page
// and the catalog are built from. Each concept is a folder:
//   <track>/<module>/<id>-<slug>/
//     README.md   the notes (idea, why, how, TS code, interview lines, pitfalls, self-test)
//     visual.html the animation (open in a browser)
//     demo.ts     runnable TypeScript: npx tsx <folder>/demo.ts
//     lab-*/      optional: starter.ts + reference.ts + tests (build it yourself)
//     hands-on/   optional: Docker / Node labs (from the old 35-day repo)

export type Track = 'LLD' | 'HLD';

export interface Module {
  track: Track;
  dir: string; // e.g. 'lld/2-creational'
  title: string;
  why: string;
}

export interface Concept {
  id: string; // L08, H17
  slug: string;
  title: string;
  module: string; // Module.dir
  labs?: string[]; // lab-* folder names inside the concept folder
  handsOn?: boolean; // has a hands-on/ folder
}

export const MODULES: Module[] = [
  { track: 'LLD', dir: 'lld/1-foundations', title: 'OOP and design principles in TypeScript', why: 'Every LLD answer is judged on clean classes, interfaces and SOLID. This is the grammar.' },
  { track: 'LLD', dir: 'lld/2-creational', title: 'Creational patterns', why: 'How objects get made without hard-wiring concrete classes.' },
  { track: 'LLD', dir: 'lld/3-structural', title: 'Structural patterns', why: 'How objects are wrapped and combined so features stack without edits.' },
  { track: 'LLD', dir: 'lld/4-behavioral', title: 'Behavioral patterns', why: 'How objects talk and change behaviour. Most machine-coding problems are built from these.' },
  { track: 'LLD', dir: 'lld/5-machine-coding', title: 'Machine-coding toolkit', why: 'The round itself: a framework, DI, concurrency, domain modelling and tests.' },
  { track: 'HLD', dir: 'hld/1-basics', title: 'Basics: how a request travels', why: 'The interview framework, estimation, networking, APIs and the edge.' },
  { track: 'HLD', dir: 'hld/2-scaling', title: 'Scaling the stateless tier', why: 'More servers, load balancers, caches and CDNs: the first answer to any traffic question.' },
  { track: 'HLD', dir: 'hld/3-databases', title: 'Databases and data distribution', why: 'Where most HLD rounds are won or lost: indexes, transactions, replication, sharding, consistency.' },
  { track: 'HLD', dir: 'hld/4-async', title: 'Async systems and messaging', why: 'Queues, Kafka, exactly-once myths, sagas and events.' },
  { track: 'HLD', dir: 'hld/5-reliability', title: 'Architecture and reliability', why: 'Microservices, rate limits, failures, IDs, consensus, observability and security.' },
  { track: 'HLD', dir: 'hld/6-building-blocks', title: 'Specialised building blocks', why: 'The pieces behind famous designs: blobs, search, geo, sketches, streams, payments, multi-region.' },
];

const c = (id: string, slug: string, title: string, module: string, extra: Partial<Concept> = {}): Concept => ({ id, slug, title, module, ...extra });

export const CONCEPTS: Concept[] = [
  // ---------- LLD ----------
  c('L01', 'classes-and-interfaces', 'Classes, interfaces and types in TypeScript', 'lld/1-foundations'),
  c('L02', 'oop-pillars', 'The four OOP pillars', 'lld/1-foundations'),
  c('L03', 'composition-over-inheritance', 'Composition over inheritance', 'lld/1-foundations'),
  c('L04', 'solid-srp-ocp', 'SOLID part 1: SRP and OCP', 'lld/1-foundations'),
  c('L05', 'solid-lsp-isp-dip', 'SOLID part 2: LSP, ISP and DIP', 'lld/1-foundations'),
  c('L06', 'uml-relationships', 'UML class diagrams and relationships', 'lld/1-foundations'),
  c('L07', 'design-principles', 'DRY, KISS, YAGNI, coupling, cohesion, Law of Demeter', 'lld/1-foundations'),
  c('L08', 'singleton', 'Singleton', 'lld/2-creational'),
  c('L09', 'factory-method', 'Simple Factory and Factory Method', 'lld/2-creational'),
  c('L10', 'abstract-factory', 'Abstract Factory', 'lld/2-creational'),
  c('L11', 'builder', 'Builder', 'lld/2-creational'),
  c('L12', 'prototype', 'Prototype', 'lld/2-creational'),
  c('L13', 'adapter', 'Adapter', 'lld/3-structural'),
  c('L14', 'decorator', 'Decorator', 'lld/3-structural'),
  c('L15', 'facade', 'Facade', 'lld/3-structural'),
  c('L16', 'proxy', 'Proxy', 'lld/3-structural'),
  c('L17', 'composite', 'Composite', 'lld/3-structural'),
  c('L18', 'bridge', 'Bridge', 'lld/3-structural'),
  c('L19', 'flyweight', 'Flyweight', 'lld/3-structural'),
  c('L20', 'strategy', 'Strategy', 'lld/4-behavioral'),
  c('L21', 'observer', 'Observer and pub-sub', 'lld/4-behavioral'),
  c('L22', 'state', 'State', 'lld/4-behavioral'),
  c('L23', 'command', 'Command (undo and redo)', 'lld/4-behavioral'),
  c('L24', 'memento', 'Memento', 'lld/4-behavioral'),
  c('L25', 'chain-of-responsibility', 'Chain of Responsibility', 'lld/4-behavioral'),
  c('L26', 'template-method', 'Template Method', 'lld/4-behavioral'),
  c('L27', 'iterator', 'Iterator (and JS generators)', 'lld/4-behavioral'),
  c('L28', 'mediator', 'Mediator', 'lld/4-behavioral'),
  c('L29', 'visitor', 'Visitor', 'lld/4-behavioral'),
  c('L30', 'machine-coding-framework', 'The machine-coding round framework', 'lld/5-machine-coding'),
  c('L31', 'repository-and-di', 'Repository and dependency injection', 'lld/5-machine-coding'),
  c('L32', 'concurrency-in-node', 'Concurrency in Node: event loop, races, locks', 'lld/5-machine-coding'),
  c('L33', 'domain-modeling', 'Domain modelling in TS: value objects, enums, errors', 'lld/5-machine-coding'),
  c('L34', 'testing-designs', 'Testing your design with Vitest', 'lld/5-machine-coding'),

  // ---------- HLD ----------
  c('H01', 'approach-hld-round', 'How to approach an HLD round', 'hld/1-basics'),
  c('H02', 'back-of-envelope', 'Back-of-the-envelope estimation', 'hld/1-basics'),
  c('H03', 'networking-basics', 'Networking: DNS, TCP/UDP, HTTP, TLS', 'hld/1-basics'),
  c('H04', 'api-design', 'API design: REST, gRPC, GraphQL', 'hld/1-basics'),
  c('H05', 'realtime-communication', 'Real-time: polling, SSE, WebSockets', 'hld/1-basics'),
  c('H06', 'proxies-api-gateway', 'Proxies, reverse proxies and the API gateway', 'hld/1-basics', { handsOn: true }),
  c('H07', 'scaling-stateless', 'Vertical vs horizontal scaling and stateless services', 'hld/2-scaling', { handsOn: true }),
  c('H08', 'load-balancing', 'Load balancing', 'hld/2-scaling', { handsOn: true }),
  c('H09', 'caching', 'Caching patterns, eviction and failures', 'hld/2-scaling', { handsOn: true }),
  c('H10', 'cdn', 'CDN and static content', 'hld/2-scaling'),
  c('H11', 'indexing', 'Indexes: B-tree, hash, composite, covering', 'hld/3-databases'),
  c('H12', 'transactions-isolation', 'Transactions, isolation levels and locking', 'hld/3-databases'),
  c('H13', 'data-modeling', 'Data modelling and normalization', 'hld/3-databases'),
  c('H14', 'sql-vs-nosql', 'SQL vs NoSQL and choosing a database', 'hld/3-databases', { handsOn: true }),
  c('H15', 'replication', 'Replication', 'hld/3-databases'),
  c('H16', 'partitioning-sharding', 'Partitioning and sharding', 'hld/3-databases'),
  c('H17', 'consistent-hashing', 'Consistent hashing', 'hld/3-databases', { labs: ['lab-hash-ring'] }),
  c('H18', 'cap-pacelc-consistency', 'CAP, PACELC and consistency models', 'hld/3-databases'),
  c('H19', 'quorum-merkle', 'Quorums, leaderless replication and Merkle trees', 'hld/3-databases', { labs: ['lab-quorum-kv'] }),
  c('H20', 'message-queues', 'Message queues and pub-sub (RabbitMQ, SQS, Redis)', 'hld/4-async', { handsOn: true }),
  c('H21', 'kafka', 'Kafka deep dive', 'hld/4-async'),
  c('H22', 'delivery-semantics', 'Delivery semantics and idempotency', 'hld/4-async'),
  c('H23', 'distributed-transactions', 'Distributed transactions: 2PC, Saga, Outbox', 'hld/4-async'),
  c('H24', 'event-driven-cqrs', 'Event-driven architecture, CQRS, event sourcing', 'hld/4-async', { handsOn: true }),
  c('H25', 'microservices', 'Microservices and service discovery', 'hld/5-reliability'),
  c('H26', 'rate-limiting', 'Rate limiting algorithms', 'hld/5-reliability', { labs: ['lab-rate-limiters'] }),
  c('H27', 'resilience', 'Resilience: timeouts, retries, circuit breakers, bulkheads', 'hld/5-reliability', { labs: ['lab-circuit-breaker'] }),
  c('H28', 'unique-ids', 'Unique ID generation (Snowflake, Base62)', 'hld/5-reliability', { labs: ['lab-snowflake', 'lab-base62'] }),
  c('H29', 'consensus-locks', 'Consensus, leader election and distributed locks', 'hld/5-reliability'),
  c('H30', 'observability', 'Observability: logs, metrics, traces, SLOs', 'hld/5-reliability'),
  c('H31', 'security-auth', 'Security: authn, authz, JWT, OAuth2', 'hld/5-reliability'),
  c('H32', 'blob-storage', 'Blob storage and large files', 'hld/6-building-blocks'),
  c('H33', 'search-typeahead', 'Search: inverted index and typeahead', 'hld/6-building-blocks', { labs: ['lab-trie'] }),
  c('H34', 'geospatial', 'Geospatial: geohash and quadtree', 'hld/6-building-blocks', { labs: ['lab-geohash'] }),
  c('H35', 'probabilistic-ds', 'Bloom filter, HyperLogLog, Count-Min sketch', 'hld/6-building-blocks', { labs: ['lab-bloom-filter', 'lab-count-min'], handsOn: true }),
  c('H36', 'batch-stream', 'Batch and stream processing', 'hld/6-building-blocks'),
  c('H37', 'data-at-scale', 'Data at scale: fan-out, hot keys, counters', 'hld/6-building-blocks'),
  c('H38', 'payments-domain', 'Payments: ledger, PSPs, reconciliation', 'hld/6-building-blocks'),
  c('H39', 'deployment-multi-region', 'Deployment, autoscaling and multi-region', 'hld/6-building-blocks'),
];

export const conceptDir = (x: Concept) => `${x.module}/${x.id}-${x.slug}`;
export const conceptById = (id: string): Concept => {
  const found = CONCEPTS.find((x) => x.id === id);
  if (!found) throw new Error(`Unknown concept ${id}`);
  return found;
};
