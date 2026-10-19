// The day-wise system design plan, built from plan/concepts.ts.
// Edit this file, then run `npm run plan` to regenerate plan/weeks/*.md, plan-data.js and CATALOG.md.
//
// Budget (fits the career plan in ~/career-agent/plan.md, DSA is separate):
//   Mon–Fri:  60 min = LLD 25 + HLD 35
//   Saturday: 150 min = LLD timed machine-coding 90 + HLD lab 60
//   Sunday:   120 min = HLD full design 75 + weekly review 45 (+ /daily week)
//
// Shape (matches the career plan's phases):
//   Phase 1 (wk 1–3):   one LLD + one HLD concept every weekday. First 3 LLD problems, first 3 HLD designs.
//   Phase 2 (wk 4–10):  concepts Mon–Wed, an LLD problem Thu–Sat, an HLD case study Thu–Fri + one on Sunday.
//   Phase 3 (wk 11–18): last concepts, hard designs, advanced problems, interview debrief fixes.
//   Phase 4 (wk 19–26): spaced redo sprints, mocks, offers.

import { CONCEPTS, MODULES, conceptDir, type Concept } from './concepts';

export const START = '2026-10-19'; // Monday, day 1
export const END = '2027-04-18'; // Sunday, day 182
const WEEK_COUNT = 26;

export type Track = 'LLD' | 'HLD' | 'REV' | 'MOCK';

export interface Task {
  track: Track;
  minutes: number;
  title: string;
  todo: string;
  links: string[]; // repo-root-relative paths
  concept?: string; // concept id, when the task is a concept day
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

const phaseOf = (w: number): Week['phase'] => (w <= 3 ? 1 : w <= 10 ? 2 : w <= 18 ? 3 : 4);

// ---------- what gets practised, in order ----------

// LLD problems, one a week, ordered so the patterns they need are already learned.
const LLD_PROBLEMS: [string, string][] = [
  ['07-tic-tac-toe', 'Tic-Tac-Toe'], ['01-parking-lot', 'Parking Lot'], ['08-snake-ladder', 'Snake and Ladder'],
  ['24-file-system', 'In-memory File System'], ['02-lru-cache', 'LRU / LFU Cache'], ['06-vending-machine', 'Vending Machine'],
  ['03-logger', 'Logger framework'], ['05-notification-service', 'Notification Service'], ['13-bookmyshow', 'BookMyShow (seat locking)'],
  ['04-rate-limiter', 'Rate Limiter'], ['09-splitwise', 'Splitwise'], ['22-text-editor', 'Text Editor (undo/redo)'],
  ['10-elevator', 'Elevator System'], ['11-atm', 'ATM'], ['19-payment-wallet', 'Payment Wallet'],
  ['14-kv-store', 'KV Store (TTL + transactions)'], ['20-ecommerce-cart-coupons', 'Cart with Coupons'], ['12-library-management', 'Library Management'],
  ['21-meeting-room-scheduler', 'Meeting Room Scheduler'], ['16-task-scheduler', 'Task Scheduler'], ['15-pub-sub-queue', 'Pub-Sub Queue'],
  ['17-ride-sharing', 'Ride Sharing'], ['18-food-delivery', 'Food Delivery'], ['23-chess', 'Chess'],
];
// The ones asked most, used for redo sprints and the last weeks.
const LLD_HOT = ['01-parking-lot', '13-bookmyshow', '02-lru-cache', '06-vending-machine', '09-splitwise', '10-elevator', '04-rate-limiter', '19-payment-wallet', '03-logger', '22-text-editor'];

// HLD case studies, in the order they're designed (two a week from week 4).
const CASE_STUDIES: [string, string][] = [
  ['01-url-shortener', 'URL Shortener'], ['03-unique-id-generator', 'Unique ID Generator'], ['02-rate-limiter', 'Distributed Rate Limiter'],
  ['04-key-value-store', 'Distributed KV Store'], ['17-distributed-cache', 'Distributed Cache'],
  ['05-notification-system', 'Notification System'], ['06-chat-system', 'Chat System (WhatsApp)'],
  ['07-news-feed', 'News Feed'], ['08-payment-system', 'Payment System'],
  ['09-ticket-booking', 'Ticket Booking (BookMyShow)'], ['12-search-autocomplete', 'Search Autocomplete'],
  ['11-food-delivery', 'Food Delivery'], ['10-ride-hailing', 'Ride Hailing (Uber)'],
  ['13-web-crawler', 'Web Crawler'], ['16-photo-sharing', 'Photo Sharing (Instagram)'],
  ['21-leaderboard', 'Real-time Leaderboard'], ['22-proximity-service', 'Proximity Service'],
  ['18-distributed-message-queue', 'Distributed Message Queue'], ['15-file-storage', 'File Storage (Dropbox)'],
  ['20-ad-click-aggregation', 'Ad Click Aggregation'], ['19-metrics-monitoring', 'Metrics and Monitoring'],
  ['27-live-comments', 'Live Comments'], ['25-collaborative-editor', 'Collaborative Editor'],
  ['23-hotel-booking', 'Hotel Reservation'], ['14-video-streaming', 'Video Streaming'],
  ['28-digital-wallet', 'Digital Wallet / UPI'], ['26-stock-exchange', 'Stock Exchange'],
  ['24-job-scheduler', 'Distributed Job Scheduler'],
];
const HLD_HOT = ['01-url-shortener', '06-chat-system', '07-news-feed', '08-payment-system', '09-ticket-booking', '10-ride-hailing', '05-notification-system', '02-rate-limiter', '12-search-autocomplete', '15-file-storage', '14-video-streaming', '28-digital-wallet'];

const ADVANCED = [
  'Distributed tracing system', 'Surge pricing engine', 'ETA and live location sharing', 'Login and authentication system',
  'Credit card processing engine', 'Wire transfer API between banks', 'Price alert system', 'A/B testing platform',
  'Ads serving for a social feed', 'User analytics pipeline', 'Calendar (Google Calendar)', 'Counting likes for celebrity posts',
  'On-call escalation system', 'Rider matching', 'Reliable file downloader library', 'Bulk data migration to cloud',
  'Distributed sort of huge datasets', 'Control plane for a distributed database', 'Marketplace inside a social app',
  'Parts compatibility for e-commerce', 'Cluster health monitoring', 'Weather app backend', 'BitTorrent-style file transfer',
];

// ---------- link helpers ----------
const lp = (s: string) => `lld/problems/${s}/README.md`;
const hp = (s: string) => `hld/case-studies/${s}/README.md`;
const hpMine = (s: string) => `hld/case-studies/${s}/my-design.md`;
const ADV = 'hld/case-studies/advanced-37.md';
const TEMPLATE = 'hld/case-studies/_template/my-design.md';
const readme = (x: Concept) => `${conceptDir(x)}/README.md`;
const visual = (x: Concept) => `${conceptDir(x)}/visual.html`;
const demo = (x: Concept) => `${conceptDir(x)}/demo.ts`;
const byId = (id: string) => CONCEPTS.find((x) => x.id === id)!;
const FRAMEWORK_LLD = readme(byId('L30'));
const FRAMEWORK_HLD = readme(byId('H01'));

const t = (track: Track, minutes: number, title: string, todo: string, links: string[], concept?: string): Task =>
  concept ? { track, minutes, title, todo, links, concept } : { track, minutes, title, todo, links };

// ---------- task builders ----------
const conceptTask = (x: Concept, min?: number): Task =>
  x.id.startsWith('L')
    ? t('LLD', min ?? 25, `${x.id} ${x.title}`, 'Play the visual first (5 min). Read the README. Run demo.ts, then close it and rewrite the core classes from memory in a scratch file. Answer the self-test.', [readme(x), visual(x), demo(x)], x.id)
    : t('HLD', min ?? 35, `${x.id} ${x.title}`, 'Play the visual (5 min). Read the README. Run demo.ts. Answer the self-test without peeking, then say the "Say this in the interview" part out loud.', [readme(x), visual(x), demo(x)], x.id);

const lldDesign = ([s, n]: [string, string]) => t('LLD', 25, `${n}: requirements + class diagram`, 'Steps 1–3 on paper: clarify, list entities, draw the class diagram, name the patterns. No code yet.', [lp(s), FRAMEWORK_LLD]);
const lldBuild = ([s, n]: [string, string]) => t('LLD', 25, `${n}: build the core`, 'Code the main flow in starter.ts. Run `npx vitest run lld/problems/' + s + '` and get the first tests green.', [lp(s)]);
const lldFinishTimed = ([s, n]: [string, string]) => t('LLD', 90, `${n}: finish + timed redo`, 'Finish starter.ts until all tests pass (40 min). Then answer the extension questions out loud. Only now open reference.ts and write down 3 differences.', [lp(s)]);
const lldTimed = ([s, n]: [string, string]) => t('LLD', 90, `${n}: timed machine-coding round`, '90 min on a timer: 10 clarify, 10 design, 60 code + tests, 10 demo it out loud. Then compare with reference.ts and note 3 differences.', [lp(s), FRAMEWORK_LLD]);
const lldSprint = (s: string) => t('LLD', 25, `Redo sprint: ${LLD_PROBLEMS.find((p) => p[0] === s)?.[1] ?? s}`, 'Empty file, 25 min. Rebuild the core classes and the main method from memory. Spaced repetition: this is what makes it stick.', [lp(s)]);

const hldPart1 = ([s, n]: [string, string]) => t('HLD', 35, `${n}: part 1 (requirements → diagram)`, 'In my-design.md: requirements, estimates, API, data model, high-level diagram. Don\'t open the hints.', [hp(s), hpMine(s)]);
const hldPart2 = ([s, n]: [string, string]) => t('HLD', 35, `${n}: part 2 (deep dives + compare)`, 'Write 2–3 deep dives and the trade-offs. Then open every hint, compare, and fill in the Review section.', [hp(s), hpMine(s)]);
const hldFull = ([s, n]: [string, string]) => t('HLD', 75, `${n}: full design`, '45 min on a timer in my-design.md, talking out loud as if to an interviewer (do it as a mock if someone is free). Then 30 min comparing with the hints and filling in the Review.', [hp(s), hpMine(s), FRAMEWORK_HLD]);
const hldRedo = (s: string, min = 35) => t('HLD', min, `Redo from memory: ${CASE_STUDIES.find((c) => c[0] === s)?.[1] ?? s}`, 'Blank page, 25 min: diagram + the top 3 deep dives. Then check against your old Review notes in my-design.md.', [hp(s), hpMine(s)]);
const advOutline = (name: string) => t('HLD', 35, `Advanced: ${name} (outline)`, 'Copy the template to hld/case-studies/advanced/<name>.md. 30 min: requirements, diagram, top 2 deep dives. Use the mapping table in advanced-37.md.', [ADV, TEMPLATE]);
const advFull = (name: string) => t('HLD', 75, `Advanced: ${name} (full round)`, 'Copy the template to hld/case-studies/advanced/<name>.md and run it like a real 45-min round, out loud. Then 30 min on what you missed.', [ADV, TEMPLATE, FRAMEWORK_HLD]);
const refresh = (a: Concept, b: Concept, min = 35) => t('HLD', min, `Refresh: ${a.id} + ${b.id}`, 'Self-test only. Answer every question on both READMEs from memory, replay the visuals, then re-read only what you got wrong.', [readme(a), visual(a), readme(b), visual(b)]);
const lldRefresh = (a: Concept, b: Concept) => t('LLD', 25, `Refresh: ${a.id} + ${b.id}`, 'Write both patterns from memory (10 min each), then diff against demo.ts.', [demo(a), demo(b)]);
const debrief = (track: 'LLD' | 'HLD') => t(track, track === 'LLD' ? 25 : 35, 'Debrief fix', 'Fix the weakest topic from this week\'s real interviews (see ~/career-agent/debriefs/). No interview this week? Redo the self-test of your lowest-scored concept.', []);
const lab = (x: Concept, l: string) => t('HLD', 60, `Lab: ${x.id} ${l.replace('lab-', '')}`, 'Implement starter.ts until `npx vitest run ' + `${conceptDir(x)}/${l}` + '` passes. Then compare with reference.ts.', [`${conceptDir(x)}/${l}/README.md`, readme(x)]);
const handsOn = (x: Concept) => t('HLD', 60, `Hands-on: ${x.id} ${x.title}`, 'Pick one folder in hands-on/, run it with Docker or Node, and watch the behaviour the README describes. Write 3 lines on what you saw.', [`${conceptDir(x)}/hands-on/README.md`, readme(x)]);
const mockHld = () => t('MOCK', 60, 'Mock HLD round', 'Ask a friend, or use Pramp / interviewing.io peers. Pick a case study you haven\'t done in 2 weeks. 45 min + feedback. Write a debrief.', [FRAMEWORK_HLD]);
const mockLld = () => t('MOCK', 90, 'Mock machine-coding round', 'Someone else (your brother, a friend, Pramp) picks any finished LLD problem and plays the interviewer. 90 min, full round. Write a debrief.', [FRAMEWORK_LLD]);
const review = (todo: string, links: string[] = []) => t('REV', 45, 'Weekly review', `${todo} Then run /daily week.`, links);

// ---------- build the weeks ----------
const lldQueue = CONCEPTS.filter((x) => x.id.startsWith('L'));
const hldQueue = CONCEPTS.filter((x) => x.id.startsWith('H'));
const problems = [...LLD_PROBLEMS];
const cases = [...CASE_STUDIES];
const advanced = [...ADVANCED];
const covered: Concept[] = []; // in the order they were learned
const conceptWeek = new Map<string, number>();
const labQueue: { needs: string; task: () => Task }[] = CONCEPTS.flatMap((x) => [
  ...(x.labs ?? []).map((l) => ({ needs: x.id, task: () => lab(x, l) })),
  ...(x.handsOn ? [{ needs: x.id, task: () => handsOn(x) }] : []),
]);
let sprintI = 0;
let hldRedoI = 0;
let refreshI = 0;

const take = <T>(q: T[]): T | undefined => q.shift();
const learn = (x: Concept, w: number) => { covered.push(x); conceptWeek.set(x.id, w); return conceptTask(x); };
const nextLld = (w: number): Task => { const x = take(lldQueue); return x ? learn(x, w) : lldSprint(LLD_HOT[sprintI++ % LLD_HOT.length]); };
const nextHldConcept = (w: number): Task | undefined => { const x = take(hldQueue); return x ? learn(x, w) : undefined; };
const nextRefresh = (track: 'LLD' | 'HLD', min?: number): Task => {
  const pool = covered.filter((x) => x.id[0] === track[0]);
  const a = pool[refreshI++ % pool.length], b = pool[refreshI++ % pool.length];
  return track === 'LLD' ? lldRefresh(a, b) : refresh(a, b, min);
};
// Phase 1 Saturdays without a lab: explain this week's HLD concepts from their visuals.
const explainDrill = (week: Concept[]): Task =>
  t('HLD', 60, 'Explain-it drill', 'For each HLD concept from this week: replay the visual and explain it out loud, 5 min each, as if teaching your brother. Then redo the self-tests you missed.', week.filter((x) => x.id.startsWith('H')).flatMap((x) => [visual(x), readme(x)]));
const nextLab = (): Task | undefined => {
  const i = labQueue.findIndex((l) => conceptWeek.has(l.needs));
  return i === -1 ? undefined : labQueue.splice(i, 1)[0].task();
};
const nextHldRedo = (min?: number) => hldRedo(HLD_HOT[hldRedoI++ % HLD_HOT.length], min);
const nextHotCase = (): [string, string] => {
  const id = HLD_HOT[hldRedoI++ % HLD_HOT.length];
  return CASE_STUDIES.find((c) => c[0] === id)!;
};

const THEMES: Record<number, string> = {
  11: 'Interview loop starts: the last building blocks', 12: 'Data pipelines and analytics', 13: 'Real-time collaboration',
  14: 'Storage-heavy systems', 15: 'Fintech week (Razorpay / Juspay / PhonePe prep)', 16: 'Schedulers and platforms',
  17: 'Senior-level problems', 18: 'Hot keys and incidents', 19: 'Offers start: keep sharp', 20: 'Negotiation weeks',
  21: 'Final rounds', 22: 'Final rounds', 23: 'Close offers', 24: 'Close offers', 25: 'Notice period: stay sharp', 26: 'Last week',
};
const GOALS: Record<Week['phase'], string> = {
  1: 'Learn one LLD and one HLD concept a day: visual, notes, code, self-test. Finish a timed LLD every Saturday and a full HLD every Sunday.',
  2: 'Finish the concepts and do 2 HLD designs + 1 LLD problem every week. Explain every concept from its visual, out loud.',
  3: 'Interviews are running. Hard designs, advanced problems, and fix what each interview exposed.',
  4: 'Stay sharp with short redo sprints while you close offers. Never let the knowledge go cold.',
};
const GATES: Record<number, string[]> = {
  3: [
    'Explain OOP pillars, SOLID and 8 patterns from memory with a TS example each',
    'Draw a request from browser to DB and back, naming every hop (DNS, LB, gateway, cache, DB)',
    'Pick a cache pattern and a database for a requirement and justify both',
    'Finished 3 timed LLD problems and 3 full HLD designs',
  ],
  10: [
    'All 73 concept self-tests at 80%+ (redo the weak ones first)',
    'Can whiteboard any of these in 45 min: URL shortener, chat, news feed, payment system, BookMyShow, Uber',
    'Can finish Parking Lot or BookMyShow with tests in 90 min',
    '2 mock rounds done with written debriefs',
  ],
  18: [
    'All 28 case studies designed at least once, the 12 hot ones twice',
    'All 24 LLD problems passing tests at least once',
    '6+ real interviews done with debriefs; weak list is shrinking',
  ],
};

export const WEEKS: Week[] = [];
for (let w = 1; w <= WEEK_COUNT; w++) {
  const phase = phaseOf(w);
  const days: Day[] = [];
  const thisWeekProblem = take(problems);
  const firstConcept = covered.length;

  // ---- Mon–Fri ----
  const pair = phase >= 2 ? take(cases) : undefined;
  for (let d = 0; d < 5; d++) {
    let lld: Task;
    let hld: Task;
    if (phase === 1) {
      lld = nextLld(w);
      hld = nextHldConcept(w)!;
    } else {
      // LLD: concepts (or sprints) Mon–Wed, this week's problem Thu–Fri. Phase 3+: Wed is the debrief fix.
      if (d < 3) lld = phase >= 3 && d === 2 ? debrief('LLD') : lldQueue.length || phase === 2 ? nextLld(w) : d === 0 ? nextRefresh('LLD') : nextLld(w);
      else if (thisWeekProblem) lld = d === 3 ? lldDesign(thisWeekProblem) : lldBuild(thisWeekProblem);
      else lld = lldSprint(LLD_HOT[sprintI++ % LLD_HOT.length]);
      // HLD: concepts Mon–Wed while any remain; then advanced outlines and refreshes. Thu–Fri: a case study in two parts.
      if (d < 3) {
        const c = nextHldConcept(w);
        if (c) hld = c;
        else if (phase === 3 && d === 2) hld = debrief('HLD');
        else if (d === 1 || (phase === 3 && d === 0)) hld = advanced.length ? advOutline(take(advanced)!) : nextHldRedo();
        else hld = nextRefresh('HLD');
      } else if (pair) hld = d === 3 ? hldPart1(pair) : hldPart2(pair);
      else hld = nextHldRedo();
    }
    days.push({ tasks: [lld, hld] });
  }

  // ---- Saturday: timed machine-coding + a lab ----
  const satLld = thisWeekProblem ? (phase === 1 ? lldTimed(thisWeekProblem) : lldFinishTimed(thisWeekProblem)) : mockLld();
  const satHld = nextLab() ?? (phase === 3 ? mockHld() : phase === 4 ? nextHldRedo(60) : explainDrill(covered.slice(firstConcept)));
  const extraLab = phase >= 2 ? nextLab() : undefined;
  days.push({ tasks: [satLld, satHld], ...(extraLab ? { stretch: { ...extraLab, minutes: 45 } } : {}) });

  // ---- Sunday: full design + weekly review ----
  const sunCase = take(cases);
  const sunHld = sunCase ? hldFull(sunCase) : phase >= 4 && w % 2 === 0 ? mockHld() : advanced.length ? advFull(take(advanced)!) : hldFull(nextHotCase());
  const thisWeek = covered.slice(firstConcept);
  const spaced = covered.filter((x) => conceptWeek.get(x.id) === w - 3);
  const reviewTodo = thisWeek.length
    ? `Self-test every concept from this week (${thisWeek.map((x) => x.id).join(', ')})${spaced.length ? ` and the spaced review from 3 weeks ago (${spaced.map((x) => x.id).join(', ')})` : ''}. Replay any visual you couldn't explain. Write 5 flashcards for what you got wrong.`
    : 'Score yourself 1–5 on each concept module. Redo the self-test of the two lowest, and update your weak list in plan/notes.md.';
  days.push({ tasks: [sunHld, review(reviewTodo, [...thisWeek, ...spaced].slice(0, 12).map(readme))] });

  const modules = MODULES.filter((m) => thisWeek.some((x) => x.module === m.dir)).map((m) => m.title.split(':')[0]);
  const theme = THEMES[w] ?? (modules.length ? modules.join(' · ') : 'Problems and spaced review');
  WEEKS.push({ phase, theme, goal: GOALS[phase], days, ...(GATES[w] ? { gate: GATES[w] } : {}) });
}

// Sanity checks: everything must get scheduled.
const leftover = [...lldQueue, ...hldQueue].map((x) => x.id);
if (leftover.length) throw new Error(`Concepts not scheduled: ${leftover.join(', ')}`);
if (problems.length) throw new Error(`LLD problems not scheduled: ${problems.map((p) => p[0]).join(', ')}`);
if (cases.length) throw new Error(`Case studies not scheduled: ${cases.map((p) => p[0]).join(', ')}`);
if (labQueue.length) throw new Error(`Labs not scheduled: ${labQueue.map((l) => l.needs).join(', ')}`);
