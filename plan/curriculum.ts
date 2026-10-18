// The day-wise system design plan: the single source of truth.
// Edit this file, then run `npm run plan` to regenerate plan/weeks/*.md and visuals/plan-data.js.
//
// Budget (fits the career plan in ~/career-agent/plan.md, DSA is separate):
//   Weekdays: 60 min after work = LLD 25 min + HLD 35 min
//   Saturday: 150 min = LLD machine-coding 90 min + HLD 60 min
//   Sunday:   150 min = HLD full design 75 min + weekly review 45 min (+ /daily week)

export const START = '2026-10-19'; // Monday, day 1
export const END = '2027-04-18'; // Sunday, day 182

export type Track = 'LLD' | 'HLD' | 'REV' | 'MOCK';

export interface Task {
  track: Track;
  minutes: number;
  title: string;
  todo: string;
  links: string[]; // repo-root-relative paths
}

export interface Day {
  tasks: Task[];
  stretch?: Task; // only if you have energy left; never at the cost of sleep or DSA
}

export interface Week {
  phase: 1 | 2 | 3 | 4;
  theme: string;
  goal: string;
  days: Day[]; // Mon..Sun
  gate?: string[]; // checklist to pass before the next phase
}

export const PHASES = {
  1: { name: 'Foundations', range: 'Weeks 1–3' },
  2: { name: 'Core problems', range: 'Weeks 4–10' },
  3: { name: 'Interview loop', range: 'Weeks 11–18' },
  4: { name: 'Offers and sharpness', range: 'Weeks 19–26' },
} as const;

// ---------- link helpers ----------
const lc = (s: string) => `lld/concepts/${s}.md`;
const pat = (s: string) => `lld/concepts/patterns/${s}.md`;
const patTs = (s: string) => `lld/concepts/patterns/${s}.ts`;
const lp = (s: string) => `lld/problems/${s}/README.md`;
const hc = (s: string) => `hld/concepts/${s}.md`;
const hp = (s: string) => `hld/problems/${s}/README.md`;
const hpMine = (s: string) => `hld/problems/${s}/my-design.md`;
const code = (s: string) => `hld/code/${s}/README.md`;
const vis = (s: string) => `visuals/${s}.html`;
const ADV = 'hld/problems/advanced-37.md';
const TEMPLATE = 'hld/problems/_template/my-design.md';

// ---------- task builders ----------
const t = (track: Track, minutes: number, title: string, todo: string, links: string[]): Task => ({ track, minutes, title, todo, links });

const READ_LLD = 'Read the card, run the .ts file, then close it and write the pattern from memory. Answer the self-test.';
const READ_HLD = 'Read the card. Play the visual if there is one. Answer the self-test without peeking, then say the "what to say" part out loud.';

const lldCard = (slug: string, title: string, extra: string[] = [], min = 25) =>
  t('LLD', min, title, 'Read the card. Write its key idea in 3 lines in your own words. Answer the self-test.', [lc(slug), ...extra]);
const patterns = (a: [string, string], b?: [string, string], extra: string[] = []) =>
  t('LLD', 25, b ? `${a[1]} + ${b[1]}` : a[1], READ_LLD, [pat(a[0]), patTs(a[0]), ...(b ? [pat(b[0]), patTs(b[0])] : []), ...extra]);
const hldCard = (slug: string, title: string, extra: string[] = [], min = 35) => t('HLD', min, title, READ_HLD, [hc(slug), ...extra]);

const lldDesign = (slug: string, title: string, v1 = false) =>
  t('LLD', 25, `${title}: requirements + class diagram`, `${v1 ? 'Read "Your v1 attempt: what to fix" first. ' : ''}Do Step 1 and Step 3 on paper: entities, relationships, patterns. Don't code yet.`, [lp(slug)]);
const lldBuild = (slug: string, title: string) =>
  t('LLD', 25, `${title}: implement the core`, 'Code the main flow in starter.ts. Run the tests and get the first half green.', [lp(slug)]);
const lldFinish = (slug: string, title: string) =>
  t('LLD', 25, `${title}: finish + extensions`, 'Make all tests green. Then answer the Step 5 extensions out loud. Only now compare with reference.ts.', [lp(slug)]);
const lldTimed = (slug: string, title: string, min = 90) =>
  t('LLD', min, `${title}: timed machine-coding`, `Full round, ${min} min on a timer: 10 min clarify, 10 min design, the rest code + tests. Then compare with reference.ts and note 3 differences.`, [lp(slug)]);
const lldSprint = (slug: string, title: string) =>
  t('LLD', 25, `Redo ${title} from scratch (core only)`, 'Empty file, 25 min. Rebuild the core classes from memory. Spaced repetition: this is what makes it stick.', [lp(slug)]);

const hldHalf1 = (slug: string, title: string) =>
  t('HLD', 35, `${title}: part 1 (steps 1–5)`, 'In my-design.md: requirements, estimates, API, data model, diagram. Don\'t open the hints.', [hp(slug), hpMine(slug)]);
const hldHalf2 = (slug: string, title: string) =>
  t('HLD', 35, `${title}: part 2 (deep dives + compare)`, 'Write the 2–3 deep dives. Then open every hint, compare, and fill in the Review section.', [hp(slug), hpMine(slug)]);
const hldFull = (slug: string, title: string, min = 75) =>
  t('HLD', min, `${title}: full design`, '45 min on a timer in my-design.md, talking out loud as if to an interviewer. Then 30 min comparing with the hints and filling in the Review.', [hp(slug), hpMine(slug)]);
const hldRedo = (slug: string, title: string, min = 35) =>
  t('HLD', min, `Redo ${title} from memory`, 'Blank page. Draw the diagram and list the deep dives in 25 min. Check against your old my-design.md Review notes.', [hp(slug), hpMine(slug)]);
const advOutline = (name: string, min = 35) =>
  t('HLD', min, `Advanced: ${name} (outline)`, 'Copy the template to hld/problems/advanced/<name>.md. Outline it in 30 min: requirements, diagram, top 2 deep dives. Use the mapping table in advanced-37.md.', [ADV, TEMPLATE]);
const advFull = (name: string) =>
  t('HLD', 35, `Advanced: ${name}`, 'Part 1 today, part 2 tomorrow. Copy the template to hld/problems/advanced/<name>.md and run it like a real round.', [ADV, TEMPLATE]);

const review = (focus: string, links: string[] = []) =>
  t('REV', 45, 'Weekly review', `${focus} Then run /daily week.`, links);
const refresh = (a: [string, string], b: [string, string]) =>
  t('HLD', 35, `Refresh: ${a[1]} + ${b[1]}`, 'Self-test only. Answer every question on both cards from memory, then re-read only what you got wrong.', [hc(a[0]), hc(b[0])]);
const debrief = (track: Track) =>
  t(track, track === 'LLD' ? 25 : 35, 'Debrief fix', 'Fix the weakest topic from this week\'s real interviews (see ~/career-agent/debriefs/). No interview this week? Redo the self-test of your lowest-scored card.', []);
const mockLld = t('MOCK', 90, 'Mock machine-coding round', 'Someone else (your brother, a friend, Pramp) picks any finished LLD problem and plays the interviewer. 90 min, full round. Write a debrief.', ['lld/concepts/04-lld-interview-framework.md']);
const mockHld = (min = 60) =>
  t('MOCK', min, 'Mock HLD round', 'Ask a friend, or use Pramp / interviewing.io peers. Pick a problem you have not designed in the last 2 weeks. 45 min + feedback. Write a debrief.', ['hld/concepts/01-how-to-approach-hld.md']);

// ---------- the 26 weeks ----------
export const WEEKS: Week[] = [
  // ===== Phase 1: Foundations =====
  {
    phase: 1,
    theme: 'How systems talk + OOP in TypeScript',
    goal: 'Know the interview frameworks for both rounds. Write clean TS classes. Finish your first full LLD and HLD.',
    days: [
      { tasks: [lldCard('01-oop-pillars', 'OOP pillars in TypeScript', ['archive/practice-v1/oop-basics/']), hldCard('01-how-to-approach-hld', 'How to approach an HLD round', [vis('v01-request-lifecycle')])] },
      { tasks: [lldCard('05-ts-for-lld', 'TypeScript features for LLD'), hldCard('03-networking-basics', 'Networking basics')] },
      { tasks: [lldCard('02-solid', 'SOLID part 1: S, O, L', [vis('v21-solid-refactor')]), hldCard('02-back-of-envelope', 'Back-of-the-envelope estimation', [vis('v19-estimation-calculator')])] },
      { tasks: [lldCard('02-solid', 'SOLID part 2: I, D'), hldCard('04-api-design', 'API design')] },
      { tasks: [lldCard('03-uml-relationships', 'UML relationships', [vis('v22-uml-relationships')]), hldCard('06-scaling-basics', 'Scaling basics and stateless services')] },
      { tasks: [t('LLD', 90, 'Machine-coding framework + Parking Lot', 'Read the framework card (20 min). Then do Parking Lot on a 70-min timer.', [lc('04-lld-interview-framework'), lp('01-parking-lot')]), hldCard('07-load-balancing', 'Load balancing', [vis('v02-load-balancing')], 60)] },
      { tasks: [hldFull('01-url-shortener', 'URL Shortener'), review('Answer the self-test of every card from this week. Write 5 flashcards for what you got wrong.')] },
    ],
  },
  {
    phase: 1,
    theme: 'Creational and structural patterns · caching and databases',
    goal: 'Pick the right cache pattern and database for a requirement, and explain why.',
    days: [
      { tasks: [patterns(['p01-singleton', 'Singleton'], ['p02-factory', 'Factory']), hldCard('08-caching', 'Caching', [vis('v03-caching-patterns')])] },
      { tasks: [patterns(['p03-builder', 'Builder'], ['p04-prototype', 'Prototype']), hldCard('09-cdn', 'CDN and edge')] },
      { tasks: [patterns(['p05-adapter', 'Adapter'], ['p07-facade', 'Facade']), hldCard('10-sql-deep-dive', 'SQL part 1: indexes and EXPLAIN')] },
      { tasks: [patterns(['p06-decorator', 'Decorator'], undefined, [vis('v26-decorator-chain')]), hldCard('10-sql-deep-dive', 'SQL part 2: transactions, isolation, locking', [vis('v20-isolation-levels')])] },
      { tasks: [patterns(['p08-proxy', 'Proxy'], ['p09-composite', 'Composite']), hldCard('11-nosql-types', 'NoSQL types and choosing a database')] },
      { tasks: [lldTimed('02-lru-cache', 'LRU / LFU Cache'), hldCard('12-replication', 'Replication', [vis('v05-replication')], 60)], stretch: t('HLD', 30, 'Code: Snowflake IDs', 'Implement it and make the tests pass.', [code('04-snowflake-id')]) },
      { tasks: [t('HLD', 75, 'Unique ID Generator: concept + design', 'Read the unique-ID card (25 min), then design the problem in 50 min.', [hc('25-unique-id-generation'), hp('03-unique-id-generator'), hpMine('03-unique-id-generator')]), review('Self-test all cards from this week. Redo the LRU cache get/put from memory in 10 min.')], stretch: t('HLD', 30, 'Code: base62 + ID ranges', 'Implement it and make the tests pass.', [code('05-base62-shortener')]) },
    ],
  },
  {
    phase: 1,
    theme: 'Behavioural patterns · spreading data across machines',
    goal: 'Explain sharding, consistent hashing, CAP and quorums with a drawing. Use Strategy/Observer/State without thinking.',
    days: [
      { tasks: [patterns(['p10-strategy', 'Strategy'], undefined, [vis('v23-strategy-factory')]), hldCard('13-partitioning-sharding', 'Partitioning and sharding', [vis('v06-sharding')])] },
      { tasks: [patterns(['p11-observer', 'Observer'], undefined, [vis('v24-observer-pubsub')]), hldCard('14-consistent-hashing', 'Consistent hashing', [vis('v04-consistent-hashing')])], stretch: t('HLD', 40, 'Code: consistent hash ring', 'Implement it with virtual nodes.', [code('01-consistent-hashing')]) },
      { tasks: [patterns(['p12-state', 'State'], undefined, [vis('v25-state-machine')]), hldCard('15-cap-pacelc-consistency', 'CAP, PACELC, consistency models', [vis('v07-cap-partition')])] },
      { tasks: [patterns(['p13-command', 'Command + Memento'], undefined, [vis('v27-command-undo-redo')]), hldCard('16-quorum-leaderless', 'Quorums and leaderless replication', [vis('v08-quorum')])], stretch: t('HLD', 40, 'Code: quorum KV', 'Simulate N/R/W with node failures.', [code('08-quorum-kv')]) },
      { tasks: [patterns(['p14-chain-of-responsibility', 'Chain of Responsibility']), hldCard('23-rate-limiting', 'Rate limiting', [vis('v09-rate-limiting')])], stretch: t('HLD', 40, 'Code: rate limiter algorithms', 'Token bucket and sliding window.', [code('02-rate-limiter-algorithms')]) },
      { tasks: [lldTimed('04-rate-limiter', 'Rate Limiter (rewrite your v1)'), t('HLD', 60, 'Distributed Rate Limiter: design', 'Design it in my-design.md in 45 min, then compare.', [hp('02-rate-limiter'), hpMine('02-rate-limiter')])] },
      { tasks: [hldFull('04-key-value-store', 'Distributed Key-Value Store'), review('Phase 1 gate (see below). Explain 10 concepts out loud, 2 min each. Record yourself once.')] },
    ],
    gate: [
      'You can run the 45-minute HLD framework without notes.',
      'You can explain caching patterns, replication, sharding, consistent hashing and CAP with a drawing, in 2 minutes each.',
      'Parking Lot, LRU Cache and Rate Limiter are green in your own starter.ts.',
      'You can name the pattern for: choosing an algorithm at runtime, reacting to events, objects with lifecycle states, undo.',
    ],
  },

  // ===== Phase 2: Core problems =====
  {
    phase: 2,
    theme: 'Async systems: queues, Kafka, idempotency',
    goal: 'Design anything that sends messages. Know at-least-once + idempotency by heart.',
    days: [
      { tasks: [patterns(['p15-template-method', 'Template Method'], ['p16-iterator', 'Iterator']), hldCard('17-message-queues', 'Message queues')] },
      { tasks: [patterns(['p17-mediator', 'Mediator'], ['p18-repository-di', 'Repository + DI']), hldCard('18-kafka-deep-dive', 'Kafka deep dive', [vis('v10-kafka-consumer-groups')])] },
      { tasks: [lldDesign('05-notification-service', 'Notification Service', true), hldCard('19-idempotency-delivery-semantics', 'Idempotency and delivery semantics', [vis('v11-delivery-semantics')])] },
      { tasks: [lldBuild('05-notification-service', 'Notification Service'), hldHalf1('05-notification-system', 'Notification System')] },
      { tasks: [lldFinish('05-notification-service', 'Notification Service'), hldHalf2('05-notification-system', 'Notification System')] },
      { tasks: [lldTimed('06-vending-machine', 'Vending Machine'), hldCard('05-realtime-communication', 'Real-time: polling, SSE, WebSockets', [vis('v14-realtime-transport')], 60)] },
      { tasks: [hldFull('06-chat-system', 'Chat System (WhatsApp)'), review('Self-test this week\'s cards. Redo the vending machine state diagram from memory.')] },
    ],
  },
  {
    phase: 2,
    theme: 'Money and transactions (your strongest area: make it shine)',
    goal: 'Design a payment system that a Razorpay interviewer would accept. Know Saga and Outbox cold.',
    days: [
      { tasks: [lldCard('06-concurrency-in-node', 'Concurrency and race conditions in Node', [vis('v30-node-event-loop')]), hldCard('20-distributed-transactions', 'Distributed transactions: 2PC, Saga, Outbox', [vis('v12-saga-outbox')])] },
      { tasks: [lldDesign('07-tic-tac-toe', 'Tic-Tac-Toe'), hldCard('21-event-driven-cqrs', 'Event-driven, CQRS, event sourcing')] },
      { tasks: [lldFinish('07-tic-tac-toe', 'Tic-Tac-Toe'), hldCard('35-payments-domain', 'Payments domain')] },
      { tasks: [lldSprint('08-snake-ladder', 'Snake and Ladder'), hldHalf1('08-payment-system', 'Payment System')] },
      { tasks: [lldDesign('09-splitwise', 'Splitwise'), hldHalf2('08-payment-system', 'Payment System')] },
      { tasks: [lldTimed('09-splitwise', 'Splitwise'), hldCard('34-data-modeling-at-scale', 'Data modelling at scale', [vis('v15-feed-fanout')], 60)] },
      { tasks: [hldFull('07-news-feed', 'News Feed'), review('Explain your payment design to your brother in 10 minutes. If he gets lost, simplify.')] },
    ],
  },
  {
    phase: 2,
    theme: 'Coordination and bookings',
    goal: 'Never double-book a seat. Explain locks, leases and leader election.',
    days: [
      { tasks: [lldDesign('10-elevator', 'Elevator System'), hldCard('24-resilience-patterns', 'Resilience: timeouts, retries, circuit breakers', [vis('v13-circuit-breaker')])], stretch: t('HLD', 40, 'Code: circuit breaker + retry', 'With an injected clock and jitter.', [code('09-circuit-breaker')]) },
      { tasks: [lldBuild('10-elevator', 'Elevator System'), hldCard('30-consensus-coordination', 'Consensus, leader election, locks', [vis('v18-raft-leader-election')])] },
      { tasks: [lldFinish('10-elevator', 'Elevator System'), hldCard('22-microservices', 'Microservices, API gateway, discovery')] },
      { tasks: [lldDesign('11-atm', 'ATM', true), hldHalf1('09-ticket-booking', 'Ticket Booking (BookMyShow)')] },
      { tasks: [lldBuild('11-atm', 'ATM'), hldHalf2('09-ticket-booking', 'Ticket Booking (BookMyShow)')] },
      { tasks: [lldTimed('13-bookmyshow', 'BookMyShow seat locking'), hldCard('28-geospatial', 'Geospatial indexing', [vis('v17-geohash-quadtree'), vis('v28-seat-locking')], 60)], stretch: t('HLD', 30, 'Code: geohash', 'Encode, decode, neighbours.', [code('06-geohash')]) },
      { tasks: [hldFull('10-ride-hailing', 'Ride Hailing (Uber/Ola)'), review('Finish the ATM tests if they are still red. Self-test this week\'s cards.')] },
    ],
  },
  {
    phase: 2,
    theme: 'Search, storage and observability',
    goal: 'Handle search, big files and "how do you know it works in production?".',
    days: [
      { tasks: [lldDesign('12-library-management', 'Library Management'), hldCard('27-search-indexing', 'Search and typeahead')], stretch: t('HLD', 40, 'Code: trie autocomplete', 'Top-k by prefix.', [code('07-trie-autocomplete')]) },
      { tasks: [lldBuild('12-library-management', 'Library Management'), hldCard('29-probabilistic-data-structures', 'Bloom filter, HLL, Count-Min', [vis('v16-bloom-filter')])], stretch: t('HLD', 40, 'Code: Bloom filter + Count-Min', 'Both, with their tests.', [code('03-bloom-filter'), code('10-count-min-sketch')]) },
      { tasks: [lldFinish('12-library-management', 'Library Management'), hldCard('26-blob-storage', 'Blob storage and large files')] },
      { tasks: [lldDesign('14-kv-store', 'In-memory KV Store'), hldHalf1('11-food-delivery', 'Food Delivery (Swiggy)')] },
      { tasks: [lldBuild('14-kv-store', 'In-memory KV Store'), hldHalf2('11-food-delivery', 'Food Delivery (Swiggy)')] },
      { tasks: [lldTimed('14-kv-store', 'KV Store with transactions', 60), hldCard('31-observability', 'Observability and SLOs', [], 60)] },
      { tasks: [hldFull('12-search-autocomplete', 'Search Autocomplete'), review('Self-test this week\'s cards. Redo the URL shortener diagram in 10 min (first spaced repeat).')] },
    ],
  },
  {
    phase: 2,
    theme: 'Pipelines, security and deployment',
    goal: 'Cover the "platform" questions: batch vs stream, auth, multi-region.',
    days: [
      { tasks: [lldDesign('15-pub-sub-queue', 'Pub-Sub Queue (Kafka-lite)'), hldCard('33-batch-stream-processing', 'Batch and stream processing')] },
      { tasks: [lldBuild('15-pub-sub-queue', 'Pub-Sub Queue'), hldCard('32-security-auth', 'Security and auth')] },
      { tasks: [lldFinish('15-pub-sub-queue', 'Pub-Sub Queue'), hldCard('36-deployment-multi-region', 'Deployment and multi-region')] },
      { tasks: [lldDesign('16-task-scheduler', 'Task Scheduler'), hldHalf1('13-web-crawler', 'Web Crawler')] },
      { tasks: [lldBuild('16-task-scheduler', 'Task Scheduler'), hldHalf2('13-web-crawler', 'Web Crawler')] },
      { tasks: [lldTimed('16-task-scheduler', 'Task Scheduler', 60), t('HLD', 60, 'Spaced repeat: URL Shortener + Rate Limiter', 'Redo both from memory, 25 min each. Compare with your Review notes.', [hp('01-url-shortener'), hp('02-rate-limiter')])] },
      { tasks: [hldFull('14-video-streaming', 'Video Streaming (YouTube)'), review('Self-test this week\'s cards. List your 3 weakest concepts so far in the plan notes.')] },
    ],
  },
  {
    phase: 2,
    theme: 'Rewrite your v1 attempts · storage-heavy systems',
    goal: 'Your old ride-sharing and food-delivery code becomes interview-grade. Design Dropbox and Instagram.',
    days: [
      { tasks: [lldDesign('17-ride-sharing', 'Ride Sharing', true), hldHalf1('15-file-storage', 'File Storage (Dropbox)')] },
      { tasks: [lldBuild('17-ride-sharing', 'Ride Sharing'), hldHalf2('15-file-storage', 'File Storage (Dropbox)')] },
      { tasks: [lldFinish('17-ride-sharing', 'Ride Sharing'), hldRedo('05-notification-system', 'Notification System')] },
      { tasks: [lldDesign('18-food-delivery', 'Food Delivery', true), hldHalf1('16-photo-sharing', 'Photo Sharing (Instagram)')] },
      { tasks: [lldBuild('18-food-delivery', 'Food Delivery'), hldHalf2('16-photo-sharing', 'Photo Sharing (Instagram)')] },
      { tasks: [lldTimed('19-payment-wallet', 'Payment Wallet (ledger + idempotency)'), t('HLD', 60, 'Distributed Cache: design', 'Design it in 45 min, then compare.', [hp('17-distributed-cache'), hpMine('17-distributed-cache')])] },
      { tasks: [hldFull('28-digital-wallet', 'Digital Wallet / UPI'), review('Finish Food Delivery tests. Self-test this week\'s cards.')] },
    ],
  },
  {
    phase: 2,
    theme: 'Readiness gate: mocks',
    goal: 'Prove you are interview-ready before real loops start next week.',
    days: [
      { tasks: [lldDesign('20-ecommerce-cart-coupons', 'Cart with Coupons'), hldRedo('06-chat-system', 'Chat System')] },
      { tasks: [lldBuild('20-ecommerce-cart-coupons', 'Cart with Coupons'), hldRedo('08-payment-system', 'Payment System')] },
      { tasks: [lldFinish('20-ecommerce-cart-coupons', 'Cart with Coupons'), t('HLD', 35, 'Leaderboard: fast design', 'A 30-min design: this is a medium problem, keep it tight.', [hp('21-leaderboard'), hpMine('21-leaderboard')])] },
      { tasks: [lldSprint('01-parking-lot', 'Parking Lot'), t('HLD', 35, 'Proximity Service: fast design', 'A 30-min design. Reuse what you learned for Uber.', [hp('22-proximity-service'), hpMine('22-proximity-service')])] },
      { tasks: [lldSprint('13-bookmyshow', 'BookMyShow'), hldRedo('09-ticket-booking', 'Ticket Booking')] },
      { tasks: [t('MOCK', 90, 'Mock machine-coding: Meeting Room Scheduler', 'An unseen problem. Someone reads you the README prompt only. 90 min. Then compare with reference.ts.', [lp('21-meeting-room-scheduler')]), t('MOCK', 60, 'Mock HLD: Distributed Message Queue', 'An unseen problem, 45 min, ideally with a peer. Then compare with the hints.', [hp('18-distributed-message-queue'), hpMine('18-distributed-message-queue')])] },
      { tasks: [t('REV', 75, 'Phase 2 gate review', 'Score yourself on the gate below. Write your weak list in plan/notes.md. Those topics go first in the Phase 3 debrief slots.', []), review('Plan the Phase 3 interview schedule with your pipeline.')] },
    ],
    gate: [
      'You have done 14+ HLD designs with a filled Review section, and 2+ redos from memory.',
      'You have 15+ LLD problems green in your own code.',
      'In a 45-min mock you reach the deep dives by minute 25.',
      'In a 90-min machine-coding mock you have working code + tests by minute 75.',
      'You can explain Kafka consumer groups, the outbox pattern, idempotency keys and seat locking without notes.',
    ],
  },

  // ===== Phase 3: Interview loop =====
  ...phase3([
    { theme: 'Observability-heavy systems', lld: ['22-text-editor', 'Text Editor (undo/redo)'], sprint: ['02-lru-cache', 'LRU Cache'], hldA: ['19-metrics-monitoring', 'Metrics and Monitoring'], adv: 'Distributed tracing system', sun: hldFull('23-hotel-booking', 'Hotel Reservation'), cards: [['08-caching', 'Caching'], ['12-replication', 'Replication']] },
    { theme: 'Data pipelines at scale', lld: ['23-chess', 'Chess'], sprint: ['06-vending-machine', 'Vending Machine'], hldA: ['20-ad-click-aggregation', 'Ad Click Aggregation'], adv: 'Price alert system', sun: hldFull('24-job-scheduler', 'Distributed Job Scheduler'), cards: [['13-partitioning-sharding', 'Sharding'], ['17-message-queues', 'Message queues']] },
    { theme: 'Real-time collaboration', lld: ['24-file-system', 'In-memory File System'], sprint: ['09-splitwise', 'Splitwise'], hldA: ['25-collaborative-editor', 'Collaborative Editor'], adv: 'Surge pricing engine', sun: hldFull('27-live-comments', 'Live Comments and Viewer Count'), cards: [['18-kafka-deep-dive', 'Kafka'], ['19-idempotency-delivery-semantics', 'Idempotency']] },
    { theme: 'Low latency and location', lld: ['14-kv-store', 'KV Store (full redo)'], sprint: ['11-atm', 'ATM'], hldA: ['26-stock-exchange', 'Stock Exchange'], adv: 'ETA and live location sharing', sun: hldRedo('10-ride-hailing', 'Ride Hailing', 75), cards: [['20-distributed-transactions', 'Distributed transactions'], ['30-consensus-coordination', 'Consensus']] },
    { theme: 'Fintech week (Razorpay / Juspay / PhonePe prep)', lld: ['19-payment-wallet', 'Payment Wallet (full redo)'], sprint: ['15-pub-sub-queue', 'Pub-Sub Queue'], hldA: null, advA: 'Credit card processing engine', adv: 'Wire transfer API between banks', sun: hldRedo('08-payment-system', 'Payment System', 75), cards: [['15-cap-pacelc-consistency', 'CAP and consistency'], ['16-quorum-leaderless', 'Quorums']] },
    { theme: 'Platform and auth', lld: ['16-task-scheduler', 'Task Scheduler (full redo)'], sprint: ['10-elevator', 'Elevator'], hldA: null, advA: 'Login and authentication system', adv: 'A/B testing platform', sun: hldRedo('07-news-feed', 'News Feed', 75), cards: [['21-event-driven-cqrs', 'Event-driven and CQRS'], ['22-microservices', 'Microservices']] },
    { theme: 'Consumer products', lld: ['18-food-delivery', 'Food Delivery (full redo)'], sprint: ['20-ecommerce-cart-coupons', 'Cart with Coupons'], hldA: null, advA: 'Calendar application', adv: 'Distributed file transfer (BitTorrent)', sun: hldRedo('14-video-streaming', 'Video Streaming', 75), cards: [['23-rate-limiting', 'Rate limiting'], ['24-resilience-patterns', 'Resilience']] },
    { theme: 'Hot keys and incidents', lld: ['13-bookmyshow', 'BookMyShow (full redo)'], sprint: ['17-ride-sharing', 'Ride Sharing'], hldA: null, advA: 'Counting and broadcasting likes for very high traffic users', adv: 'On-call escalation system', sun: hldRedo('15-file-storage', 'File Storage', 75), cards: [['34-data-modeling-at-scale', 'Data modelling'], ['35-payments-domain', 'Payments']] },
  ]),

  // ===== Phase 4: Offers and sharpness =====
  ...phase4(),
];

interface P3 {
  theme: string;
  lld: [string, string];
  sprint: [string, string];
  hldA: [string, string] | null;
  advA?: string;
  adv: string;
  sun: Task;
  cards: [[string, string], [string, string]];
}

function phase3(specs: P3[]): Week[] {
  return specs.map((s, i) => {
    const a1 = s.hldA ? hldHalf1(s.hldA[0], s.hldA[1]) : advFull(s.advA!);
    const a2 = s.hldA ? hldHalf2(s.hldA[0], s.hldA[1]) : t('HLD', 35, `Advanced: ${s.advA} (part 2)`, 'Deep dives, failure cases, then the Review section.', [ADV]);
    const week: Week = {
      phase: 3,
      theme: s.theme,
      goal: 'Keep the skills warm while real interviews run. Friday is reserved for fixing what interviews exposed.',
      days: [
        { tasks: [lldDesign(s.lld[0], s.lld[1]), refresh(s.cards[0], s.cards[1])] },
        { tasks: [lldBuild(s.lld[0], s.lld[1]), a1] },
        { tasks: [lldFinish(s.lld[0], s.lld[1]), a2] },
        { tasks: [lldSprint(s.sprint[0], s.sprint[1]), advOutline(s.adv)] },
        { tasks: [debrief('LLD'), debrief('HLD')] },
        { tasks: [mockLld, mockHld()] },
        { tasks: [s.sun, review('Update the pipeline. Turn every debrief gap into a task for next Friday.')] },
      ],
    };
    if (i === specs.length - 1) {
      week.gate = [
        '3+ interview loops completed or running (career plan target).',
        'Every interview has a debrief, and every gap has been fixed on a Friday.',
        'All 28 HLD problems designed at least once; the top 10 designed twice.',
        'All 24 LLD problems green in your own code.',
      ];
    }
    return week;
  });
}

// Phase 4: maintenance. Short daily redo sprints that rotate through everything, plus mocks.
function phase4(): Week[] {
  const lldAll: [string, string][] = [
    ['01-parking-lot', 'Parking Lot'], ['13-bookmyshow', 'BookMyShow'], ['02-lru-cache', 'LRU Cache'], ['19-payment-wallet', 'Payment Wallet'],
    ['09-splitwise', 'Splitwise'], ['04-rate-limiter', 'Rate Limiter'], ['10-elevator', 'Elevator'], ['14-kv-store', 'KV Store'],
    ['05-notification-service', 'Notification Service'], ['16-task-scheduler', 'Task Scheduler'], ['17-ride-sharing', 'Ride Sharing'], ['20-ecommerce-cart-coupons', 'Cart with Coupons'],
    ['06-vending-machine', 'Vending Machine'], ['15-pub-sub-queue', 'Pub-Sub Queue'], ['21-meeting-room-scheduler', 'Meeting Rooms'], ['03-logger', 'Logger'],
    ['22-text-editor', 'Text Editor'], ['11-atm', 'ATM'], ['18-food-delivery', 'Food Delivery'], ['24-file-system', 'File System'],
    ['12-library-management', 'Library'], ['07-tic-tac-toe', 'Tic-Tac-Toe'], ['23-chess', 'Chess'], ['08-snake-ladder', 'Snake and Ladder'],
  ];
  const hldAll: [string, string][] = [
    ['08-payment-system', 'Payment System'], ['06-chat-system', 'Chat System'], ['07-news-feed', 'News Feed'], ['09-ticket-booking', 'Ticket Booking'],
    ['10-ride-hailing', 'Ride Hailing'], ['05-notification-system', 'Notification System'], ['01-url-shortener', 'URL Shortener'], ['02-rate-limiter', 'Rate Limiter'],
    ['11-food-delivery', 'Food Delivery'], ['28-digital-wallet', 'Digital Wallet'], ['17-distributed-cache', 'Distributed Cache'], ['04-key-value-store', 'KV Store'],
    ['12-search-autocomplete', 'Autocomplete'], ['15-file-storage', 'File Storage'], ['14-video-streaming', 'Video Streaming'], ['16-photo-sharing', 'Photo Sharing'],
    ['18-distributed-message-queue', 'Message Queue'], ['24-job-scheduler', 'Job Scheduler'], ['21-leaderboard', 'Leaderboard'], ['22-proximity-service', 'Proximity Service'],
    ['19-metrics-monitoring', 'Metrics'], ['20-ad-click-aggregation', 'Ad Clicks'], ['23-hotel-booking', 'Hotel Booking'], ['13-web-crawler', 'Web Crawler'],
    ['27-live-comments', 'Live Comments'], ['25-collaborative-editor', 'Collaborative Editor'], ['26-stock-exchange', 'Stock Exchange'], ['03-unique-id-generator', 'Unique IDs'],
  ];
  const cards: [string, string][] = [
    ['01-how-to-approach-hld', 'HLD framework'], ['02-back-of-envelope', 'Estimation'], ['08-caching', 'Caching'], ['10-sql-deep-dive', 'SQL'],
    ['12-replication', 'Replication'], ['13-partitioning-sharding', 'Sharding'], ['17-message-queues', 'Queues'], ['18-kafka-deep-dive', 'Kafka'],
    ['19-idempotency-delivery-semantics', 'Idempotency'], ['20-distributed-transactions', 'Distributed transactions'], ['23-rate-limiting', 'Rate limiting'], ['24-resilience-patterns', 'Resilience'],
    ['30-consensus-coordination', 'Consensus'], ['34-data-modeling-at-scale', 'Data modelling'], ['35-payments-domain', 'Payments'], ['36-deployment-multi-region', 'Multi-region'],
  ];
  const themes = [
    'Offers start: keep sharp', 'Negotiation weeks', 'Final rounds', 'Final rounds', 'Close offers', 'Close offers', 'Notice period: stay sharp', 'Last week',
  ];
  const weeks: Week[] = [];
  let li = 0, hi = 0, ci = 0;
  for (let w = 0; w < 8; w++) {
    const days: Day[] = [];
    for (let d = 0; d < 5; d++) {
      const l = lldAll[li++ % lldAll.length];
      const h = hldAll[hi++ % hldAll.length];
      days.push({
        tasks: [
          t('LLD', 20, `Sprint: ${l[1]}`, 'Rebuild the core classes from memory in 20 min. No reference.', [lp(l[0])]),
          hldRedo(h[0], h[1], 25),
        ],
      });
    }
    const c1 = cards[ci++ % cards.length], c2 = cards[ci++ % cards.length];
    days.push({ tasks: [mockLld, mockHld()] });
    days.push({ tasks: [refresh(c1, c2), t('REV', 45, 'Weekly review', 'Debrief this week\'s interviews. Prepare company-specific questions for next week. Then run /daily week.', [])] });
    weeks.push({
      phase: 4,
      theme: themes[w],
      goal: 'Short daily sprints keep every problem fresh. Real interviews and mocks are the main practice now.',
      days,
    });
  }
  return weeks;
}
