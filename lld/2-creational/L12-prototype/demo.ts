// L12 · Prototype: run with `npx tsx lld/2-creational/L12-prototype/demo.ts`
// Domain: notification templates (registry + clone), copy pitfalls, and a chess-style "try a move on a copy".

export {};

const section = (t: string) => console.log(`\n=== ${t} ===`);

interface Cloneable<T> { clone(): T }
type Channel = 'EMAIL' | 'SMS';

class NotificationTemplate implements Cloneable<NotificationTemplate> {
  constructor(
    public channel: Channel,
    public retry: { max: number; backoffMs: number },
    public tags: string[],
    public createdAt = new Date('2026-01-01T00:00:00Z'),
  ) {}
  clone(): NotificationTemplate {
    // copy exactly the parts a clone may change; strings are immutable and can be shared
    return new NotificationTemplate(this.channel, { ...this.retry }, [...this.tags], new Date(this.createdAt));
  }
  describe() { return `${this.channel} retry=${this.retry.max} tags=[${this.tags.join(',')}]`; }
}

class TemplateRegistry {
  private prototypes = new Map<string, NotificationTemplate>();
  register(name: string, t: NotificationTemplate) { this.prototypes.set(name, t); return this; }
  create(name: string): NotificationTemplate {
    const proto = this.prototypes.get(name);
    if (!proto) throw new Error(`no template ${name}`);
    return proto.clone(); // never hand out the prototype itself
  }
  peek(name: string) { return this.prototypes.get(name)!.describe(); }
}

class Money {
  constructor(readonly amount: number, readonly currency: string) {}
  format() { return `${this.currency} ${(this.amount / 100).toFixed(2)}`; }
}

// ---------- chess-like board: clone, try, discard ----------
type Square = string;
class Board implements Cloneable<Board> {
  constructor(public pieces: Map<Square, string>) {}
  clone() { return new Board(new Map(this.pieces)); }
  move(from: Square, to: Square) {
    const p = this.pieces.get(from);
    if (!p) throw new Error(`no piece on ${from}`);
    this.pieces.delete(from);
    this.pieces.set(to, p);
  }
  // tiny rule: black queen on e8 attacks the white king on e1 if nothing stands on e2..e7
  whiteInCheck(): boolean {
    if (this.pieces.get('e8') !== 'bQ' || this.pieces.get('e1') !== 'wK') return false;
    for (let r = 2; r <= 7; r++) if (this.pieces.has(`e${r}`)) return false;
    return true;
  }
}
function isLegal(board: Board, from: Square, to: Square): boolean {
  const copy = board.clone();
  copy.move(from, to);
  return !copy.whiteInCheck(); // the copy is thrown away either way
}

function main() {
  const template = new NotificationTemplate('EMAIL', { max: 3, backoffMs: 500 }, ['txn']);

  section('1. Spread copy shares nested objects');
  const otp = { ...template };
  otp.retry.max = 1;
  otp.tags.push('otp');
  console.log('otp.retry === template.retry:', otp.retry === template.retry);
  console.log('template is now:', template.describe(), ' <- broken by the copy');

  section('2. clone() + registry: each clone owns its nested parts');
  const registry = new TemplateRegistry().register(
    'transactional',
    new NotificationTemplate('EMAIL', { max: 3, backoffMs: 500 }, ['txn']),
  );
  const otp2 = registry.create('transactional');
  otp2.channel = 'SMS';
  otp2.retry.max = 1;
  otp2.tags.push('otp');
  const receipt = registry.create('transactional');
  receipt.tags.push('receipt');
  console.log('otp2     :', otp2.describe());
  console.log('receipt  :', receipt.describe());
  console.log('prototype:', registry.peek('transactional'), ' <- intact');

  section('3. structuredClone: deep, but drops the class');
  const price = new Money(49900, 'INR');
  const copied = structuredClone(price);
  console.log('copied:', copied, ' instanceof Money:', copied instanceof Money);
  console.log('copied.format:', typeof (copied as Partial<Money>).format, ' (methods gone)');
  try { structuredClone({ fn: () => 1 }); } catch (e) { console.log('functions:', (e as Error).name); }
  const viaJson = JSON.parse(JSON.stringify({ at: new Date(0), m: new Map([['a', 1]]) }));
  console.log('JSON round-trip:', viaJson, ' <- Date became a string, Map became {}');

  section('4. Chess: try a move on a copy');
  const board = new Board(new Map([['e1', 'wK'], ['e2', 'wR'], ['e8', 'bQ']]));
  console.log('Re2-a2 legal?', isLegal(board, 'e2', 'a2'), '(opens the e-file to the queen)');
  console.log('Re2-e5 legal?', isLegal(board, 'e2', 'e5'));
  console.log('real board unchanged:', [...board.pieces.entries()].map(([s, p]) => `${p}@${s}`).join(' '));
}

main();
