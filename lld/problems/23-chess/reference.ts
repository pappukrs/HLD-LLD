// 23 · Chess: reference solution.
// Read this only after your own attempt passes (or after 90 minutes).

export type Color = 'WHITE' | 'BLACK';
export type StandardPiece = 'KING' | 'QUEEN' | 'ROOK' | 'BISHOP' | 'KNIGHT' | 'PAWN';
/** Standard pieces, plus any custom piece name you register a rule for. */
export type PieceType = StandardPiece | (string & {});
/** Algebraic notation: 'a1' … 'h8'. */
export type Square = string;

export interface Piece {
  readonly color: Color;
  readonly type: PieceType;
}

/** 0-based. file 0 = 'a', rank 0 = '1'. */
export interface Pos {
  readonly file: number;
  readonly rank: number;
}

export interface BoardView {
  at(pos: Pos): Piece | null;
}

/** Strategy: the squares a piece could reach, ignoring whether its own king ends up in check. */
export interface MoveRule {
  targets(board: BoardView, from: Pos, piece: Piece): Pos[];
}

export interface PlacedPiece extends Piece {
  readonly square: Square;
}

export interface GameConfig {
  pieces?: PlacedPiece[]; // default: the standard starting position
  toMove?: Color;
  rules?: Partial<Record<PieceType, MoveRule>>; // add or replace piece rules
}

export interface MoveResult {
  readonly from: Square;
  readonly to: Square;
  readonly piece: PieceType;
  readonly captured: PieceType | null;
  readonly promotion: PieceType | null;
  readonly check: boolean;
  readonly checkmate: boolean;
}

export type GameStatus = 'ACTIVE' | 'CHECKMATE' | 'STALEMATE';

const inside = (p: Pos) => p.file >= 0 && p.file < 8 && p.rank >= 0 && p.rank < 8;
const other = (c: Color): Color => (c === 'WHITE' ? 'BLACK' : 'WHITE');

export function toPos(square: Square): Pos {
  if (!/^[a-h][1-8]$/.test(square)) throw new Error(`Bad square ${square}`);
  return { file: square.charCodeAt(0) - 97, rank: Number(square[1]) - 1 };
}

export function toSquare(p: Pos): Square {
  return String.fromCharCode(97 + p.file) + (p.rank + 1);
}

export const ORTHOGONAL: readonly [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
export const DIAGONAL: readonly [number, number][] = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
export const KNIGHT_JUMPS: readonly [number, number][] = [
  [1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2],
];

/** Rook, bishop, queen: move along a direction until blocked. Can capture the first enemy piece. */
export class SlidingRule implements MoveRule {
  constructor(private readonly directions: readonly [number, number][]) {}

  targets(board: BoardView, from: Pos, piece: Piece): Pos[] {
    const out: Pos[] = [];
    for (const [df, dr] of this.directions) {
      let p = { file: from.file + df, rank: from.rank + dr };
      while (inside(p)) {
        const occupant = board.at(p);
        if (occupant) {
          if (occupant.color !== piece.color) out.push(p);
          break;
        }
        out.push(p);
        p = { file: p.file + df, rank: p.rank + dr };
      }
    }
    return out;
  }
}

/** Knight, king: jump to fixed offsets. Pieces in between do not matter. */
export class LeapingRule implements MoveRule {
  constructor(private readonly offsets: readonly [number, number][]) {}

  targets(board: BoardView, from: Pos, piece: Piece): Pos[] {
    return this.offsets
      .map(([df, dr]) => ({ file: from.file + df, rank: from.rank + dr }))
      .filter((p) => inside(p) && board.at(p)?.color !== piece.color);
  }
}

export class PawnRule implements MoveRule {
  targets(board: BoardView, from: Pos, piece: Piece): Pos[] {
    const dir = piece.color === 'WHITE' ? 1 : -1;
    const startRank = piece.color === 'WHITE' ? 1 : 6;
    const out: Pos[] = [];

    const one = { file: from.file, rank: from.rank + dir };
    if (inside(one) && !board.at(one)) {
      out.push(one);
      const two = { file: from.file, rank: from.rank + 2 * dir };
      if (from.rank === startRank && !board.at(two)) out.push(two);
    }
    for (const df of [-1, 1]) {
      const diag = { file: from.file + df, rank: from.rank + dir };
      const target = inside(diag) ? board.at(diag) : null;
      if (target && target.color !== piece.color) out.push(diag);
    }
    return out;
  }
}

/** Combine rules, for custom pieces (for example queen + knight). */
export class CombinedRule implements MoveRule {
  private readonly rules: MoveRule[];

  constructor(...rules: MoveRule[]) {
    this.rules = rules;
  }

  targets(board: BoardView, from: Pos, piece: Piece): Pos[] {
    return this.rules.flatMap((r) => r.targets(board, from, piece));
  }
}

// Factory: piece type → rule. Adding a piece is one entry here, not a new `case` in a switch.
const STANDARD_RULES: Record<StandardPiece, MoveRule> = {
  KING: new LeapingRule([...ORTHOGONAL, ...DIAGONAL]),
  QUEEN: new SlidingRule([...ORTHOGONAL, ...DIAGONAL]),
  ROOK: new SlidingRule(ORTHOGONAL),
  BISHOP: new SlidingRule(DIAGONAL),
  KNIGHT: new LeapingRule(KNIGHT_JUMPS),
  PAWN: new PawnRule(),
};

const PROMOTION_CHOICES: ReadonlySet<PieceType> = new Set(['QUEEN', 'ROOK', 'BISHOP', 'KNIGHT']);

function standardSetup(): PlacedPiece[] {
  const back: StandardPiece[] = ['ROOK', 'KNIGHT', 'BISHOP', 'QUEEN', 'KING', 'BISHOP', 'KNIGHT', 'ROOK'];
  const pieces: PlacedPiece[] = [];
  for (let f = 0; f < 8; f++) {
    const file = String.fromCharCode(97 + f);
    pieces.push({ square: `${file}1`, color: 'WHITE', type: back[f] });
    pieces.push({ square: `${file}2`, color: 'WHITE', type: 'PAWN' });
    pieces.push({ square: `${file}7`, color: 'BLACK', type: 'PAWN' });
    pieces.push({ square: `${file}8`, color: 'BLACK', type: back[f] });
  }
  return pieces;
}

class Board implements BoardView {
  private readonly grid: (Piece | null)[][] = Array.from({ length: 8 }, () => Array<Piece | null>(8).fill(null));

  at(p: Pos): Piece | null {
    return this.grid[p.rank][p.file];
  }

  set(p: Pos, piece: Piece | null): void {
    this.grid[p.rank][p.file] = piece;
  }

  clone(): Board {
    const b = new Board();
    for (const { piece, pos } of this.pieces()) b.set(pos, piece);
    return b;
  }

  pieces(): { piece: Piece; pos: Pos }[] {
    const out: { piece: Piece; pos: Pos }[] = [];
    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const piece = this.grid[rank][file];
        if (piece) out.push({ piece, pos: { file, rank } });
      }
    }
    return out;
  }
}

export class Game {
  private board = new Board();
  private toMove: Color;
  private readonly rules: Partial<Record<PieceType, MoveRule>>;
  private state: GameStatus = 'ACTIVE';

  constructor(config: GameConfig = {}) {
    this.rules = { ...STANDARD_RULES, ...config.rules };
    for (const p of config.pieces ?? standardSetup()) {
      const pos = toPos(p.square);
      if (this.board.at(pos)) throw new Error(`Two pieces on ${p.square}`);
      this.ruleFor(p.type);
      this.board.set(pos, { color: p.color, type: p.type });
    }
    this.toMove = config.toMove ?? 'WHITE';
    this.updateStatus();
  }

  turn(): Color {
    return this.toMove;
  }

  status(): GameStatus {
    return this.state;
  }

  /** The side that delivered checkmate, or null. */
  winner(): Color | null {
    return this.state === 'CHECKMATE' ? other(this.toMove) : null;
  }

  pieceAt(square: Square): Piece | null {
    return this.board.at(toPos(square));
  }

  isInCheck(color: Color): boolean {
    return this.kingAttacked(this.board, color);
  }

  /** Legal target squares for the piece on `square`, sorted. Empty if it is not that side's turn. */
  legalMoves(square: Square): Square[] {
    const from = toPos(square);
    const piece = this.board.at(from);
    if (!piece || piece.color !== this.toMove) return [];
    return this.legalTargets(from, piece).map(toSquare).sort();
  }

  move(from: Square, to: Square, promotion: PieceType = 'QUEEN'): MoveResult {
    if (this.state !== 'ACTIVE') throw new Error(`Game over: ${this.state}`);
    const src = toPos(from);
    const dst = toPos(to);
    const piece = this.board.at(src);
    if (!piece) throw new Error(`No piece on ${from}`);
    if (piece.color !== this.toMove) throw new Error(`It is ${this.toMove}'s turn`);
    if (!this.legalTargets(src, piece).some((p) => p.file === dst.file && p.rank === dst.rank)) {
      throw new Error(`Illegal move ${from}-${to}`);
    }

    const promotes = piece.type === 'PAWN' && (dst.rank === 7 || dst.rank === 0);
    if (promotes && !PROMOTION_CHOICES.has(promotion)) throw new Error(`Cannot promote to ${promotion}`);

    const captured = this.board.at(dst);
    this.board.set(dst, promotes ? { color: piece.color, type: promotion } : piece);
    this.board.set(src, null);
    this.toMove = other(this.toMove);
    this.updateStatus();

    return {
      from,
      to,
      piece: piece.type,
      captured: captured?.type ?? null,
      promotion: promotes ? promotion : null,
      check: this.isInCheck(this.toMove),
      checkmate: this.status() === 'CHECKMATE', // method call: TS narrowed this.state above
    };
  }

  // Pseudo-legal moves from the rule, minus those that leave our own king attacked.
  private legalTargets(from: Pos, piece: Piece): Pos[] {
    return this.ruleFor(piece.type)
      .targets(this.board, from, piece)
      .filter((to) => {
        const next = this.board.clone();
        next.set(to, piece);
        next.set(from, null);
        return !this.kingAttacked(next, piece.color);
      });
  }

  // A king is attacked if any enemy piece's rule can reach its square.
  // Pawns reach diagonals only when an enemy stands there, and the king does stand there.
  private kingAttacked(board: Board, color: Color): boolean {
    const king = board.pieces().find(({ piece }) => piece.type === 'KING' && piece.color === color)?.pos;
    if (!king) return false;
    return board
      .pieces()
      .filter(({ piece }) => piece.color !== color)
      .some(({ piece, pos }) =>
        this.ruleFor(piece.type).targets(board, pos, piece).some((t) => t.file === king.file && t.rank === king.rank),
      );
  }

  private updateStatus(): void {
    const hasMove = this.board
      .pieces()
      .some(({ piece, pos }) => piece.color === this.toMove && this.legalTargets(pos, piece).length > 0);
    if (hasMove) this.state = 'ACTIVE';
    else this.state = this.isInCheck(this.toMove) ? 'CHECKMATE' : 'STALEMATE';
  }

  private ruleFor(type: PieceType): MoveRule {
    const rule = this.rules[type];
    if (!rule) throw new Error(`No move rule for ${type}`);
    return rule;
  }
}
