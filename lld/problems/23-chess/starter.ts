// 23 · Chess: your implementation goes here.
// Keep the exported names and signatures; the tests import them.
// Run: npx vitest run lld/problems/23-chess

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
    throw new Error('TODO');
  }
}

/** Knight, king: jump to fixed offsets. Pieces in between do not matter. */
export class LeapingRule implements MoveRule {
  constructor(private readonly offsets: readonly [number, number][]) {}

  targets(board: BoardView, from: Pos, piece: Piece): Pos[] {
    throw new Error('TODO');
  }
}

/** One step forward (two from the start rank) into empty squares; captures one step diagonally. */
export class PawnRule implements MoveRule {
  targets(board: BoardView, from: Pos, piece: Piece): Pos[] {
    throw new Error('TODO');
  }
}

/** Combine rules, for custom pieces (for example queen + knight). */
export class CombinedRule implements MoveRule {
  constructor(...rules: MoveRule[]) {
    // TODO
  }

  targets(board: BoardView, from: Pos, piece: Piece): Pos[] {
    throw new Error('TODO');
  }
}

export class Game {
  constructor(config: GameConfig = {}) {
    // TODO: map piece types to rules (standard + config.rules), place pieces
    // (default: standard start position), set the side to move, compute the status
  }

  turn(): Color {
    throw new Error('TODO');
  }

  status(): GameStatus {
    throw new Error('TODO');
  }

  /** The side that delivered checkmate, or null. */
  winner(): Color | null {
    throw new Error('TODO');
  }

  pieceAt(square: Square): Piece | null {
    throw new Error('TODO');
  }

  isInCheck(color: Color): boolean {
    throw new Error('TODO');
  }

  /** Legal target squares for the piece on `square`, sorted. Empty if it is not that side's turn. */
  legalMoves(square: Square): Square[] {
    throw new Error('TODO');
  }

  /** Validates, moves, promotes (default QUEEN), switches turn, updates the status. */
  move(from: Square, to: Square, promotion: PieceType = 'QUEEN'): MoveResult {
    throw new Error('TODO');
  }
}
