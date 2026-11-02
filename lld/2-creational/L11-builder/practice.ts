// L11 · Builder: Day 15 practice, a rewrite of the core idea on a new domain.
// Run: npx tsx lld/2-creational/L11-builder/practice.ts
// Different domains from demo.ts on purpose: a Snake and Ladder board (self-test Q3)
// and an HTTP request with a step builder (self-test Q5).

export {};

class ValidationError extends Error { override name = 'ValidationError'; }

// ---------- 1. Fluent builder with validation in build() ----------
interface Board {
  readonly size: number;
  readonly jumps: ReadonlyMap<number, number>; // from -> to (down = snake, up = ladder)
}

class BoardBuilder {
  private readonly snakes: [number, number][] = [];
  private readonly ladders: [number, number][] = [];

  constructor(private readonly size: number) {}

  snake(head: number, tail: number) { this.snakes.push([head, tail]); return this; }
  ladder(bottom: number, top: number) { this.ladders.push([bottom, top]); return this; }

  // All rules checked once, here, because some are cross-field (a cell used by both a snake and a ladder).
  build(): Board {
    if (this.size < 4) throw new ValidationError('board needs at least 4 cells');
    const inside = (c: number) => c >= 1 && c <= this.size;
    const jumps = new Map<number, number>();
    const add = (from: number, to: number, kind: string) => {
      if (!inside(from) || !inside(to)) throw new ValidationError(`${kind} ${from}->${to} is off the board`);
      if (jumps.has(from)) throw new ValidationError(`cell ${from} already has a jump`);
      if (from === this.size) throw new ValidationError(`${kind} cannot start on the last cell`);
      jumps.set(from, to);
    };
    for (const [h, t] of this.snakes) {
      if (t >= h) throw new ValidationError(`snake ${h}->${t} must go down`);
      add(h, t, 'snake');
    }
    for (const [b, t] of this.ladders) {
      if (t <= b) throw new ValidationError(`ladder ${b}->${t} must go up`);
      add(b, t, 'ladder');
    }
    // A fresh Map per build(), so calling the builder again never changes a board already built.
    return Object.freeze({ size: this.size, jumps });
  }
}

// ---------- 2. Step builder: required fields become compile errors ----------
type Method = 'GET' | 'POST';
interface HttpRequest {
  readonly method: Method;
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body?: string;
  readonly timeoutMs: number;
}

interface NeedsMethod { method(m: Method): NeedsUrl }
interface NeedsUrl { url(u: string): Optional }
interface Optional {
  header(k: string, v: string): Optional;
  body(b: string): Optional;
  timeout(ms: number): Optional;
  build(): HttpRequest;
}

class RequestBuilder implements NeedsMethod, NeedsUrl, Optional {
  private m?: Method;
  private u?: string;
  private h: Record<string, string> = {};
  private b?: string;
  private t = 5_000;

  private constructor() {}
  static start(): NeedsMethod { return new RequestBuilder(); }

  method(m: Method) { this.m = m; return this; }
  url(u: string) { this.u = u; return this; }
  header(k: string, v: string) { this.h[k.toLowerCase()] = v; return this; }
  body(b: string) { this.b = b; return this; }
  timeout(ms: number) { this.t = ms; return this; }

  build(): HttpRequest {
    if (this.m === 'GET' && this.b !== undefined) throw new ValidationError('GET cannot have a body');
    if (this.t <= 0 || this.t > 60_000) throw new ValidationError('timeout must be 1..60000 ms');
    if (!/^https?:\/\//.test(this.u!)) throw new ValidationError('url must start with http(s)://');
    return Object.freeze({
      method: this.m!, url: this.u!, headers: Object.freeze({ ...this.h }), body: this.b, timeoutMs: this.t,
    });
  }
}

// ---------- checks ----------
let pass = 0;
const ok = (cond: boolean, name: string) => {
  if (!cond) throw new Error(`FAILED: ${name}`);
  pass++;
  console.log(`  ok  ${name}`);
};
const throws = (fn: () => unknown, msg: string, name: string) => {
  try { fn(); } catch (e) { return ok(e instanceof ValidationError && e.message.includes(msg), name); }
  throw new Error(`FAILED (did not throw): ${name}`);
};

console.log('\n=== BoardBuilder ===');
const board = new BoardBuilder(100).snake(99, 7).snake(62, 19).ladder(3, 38).ladder(28, 84).build();
ok(board.jumps.get(99) === 7 && board.jumps.get(3) === 38, 'snakes and ladders are placed');
ok(Object.isFrozen(board), 'built board is frozen');
throws(() => new BoardBuilder(100).snake(7, 99).build(), 'must go down', 'snake going up is rejected');
throws(() => new BoardBuilder(100).ladder(38, 3).build(), 'must go up', 'ladder going down is rejected');
throws(() => new BoardBuilder(100).snake(40, 2).ladder(40, 90).build(), 'already has a jump', 'one cell, two jumps is rejected (cross-field rule)');
throws(() => new BoardBuilder(100).snake(100, 1).build(), 'last cell', 'snake on the last cell is rejected');

const reusable = new BoardBuilder(30).ladder(2, 20);
const first = reusable.build();
reusable.snake(25, 5);
const second = reusable.build();
ok(first.jumps.size === 1 && second.jumps.size === 2, 'reusing the builder does not change an earlier board');

console.log('\n=== RequestBuilder (step builder) ===');
const req = RequestBuilder.start().method('POST').url('https://api.example.com/pay')
  .header('Idempotency-Key', 'abc-1').body('{"amount":5000}').timeout(3_000).build();
ok(req.headers['idempotency-key'] === 'abc-1' && req.timeoutMs === 3_000, 'optional fields set');
ok(RequestBuilder.start().method('GET').url('http://x.io').build().timeoutMs === 5_000, 'default timeout is kept');
throws(() => RequestBuilder.start().method('GET').url('https://x.io').body('x').build(), 'GET cannot', 'GET with body is rejected');
throws(() => RequestBuilder.start().method('GET').url('ftp://x.io').build(), 'url must', 'bad url is rejected');
// Compile-time checks (uncomment to see the errors):
// RequestBuilder.start().build();                 // error: build() does not exist on NeedsMethod
// RequestBuilder.start().method('GET').build();   // error: build() does not exist on NeedsUrl

console.log(`\n${pass} checks passed`);
