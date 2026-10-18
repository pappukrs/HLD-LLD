import * as starter from './starter';
import * as reference from './reference';
import type { PlacedPiece } from './reference';

// `npm test` checks your starter.ts; `npm run test:ref` checks the reference.
const { Game, CombinedRule, SlidingRule, LeapingRule, ORTHOGONAL, DIAGONAL, KNIGHT_JUMPS } = (
  process.env.REF ? reference : starter
) as typeof reference;

const W = (square: string, type: string): PlacedPiece => ({ square, color: 'WHITE', type });
const B = (square: string, type: string): PlacedPiece => ({ square, color: 'BLACK', type });

describe('23 · Chess', () => {
  describe('setup and basic moves', () => {
    it('starts from the standard position with white to move', () => {
      const g = new Game();
      expect(g.pieceAt('e1')).toEqual({ color: 'WHITE', type: 'KING' });
      expect(g.pieceAt('d8')).toEqual({ color: 'BLACK', type: 'QUEEN' });
      expect(g.pieceAt('e4')).toBeNull();
      expect(g.turn()).toBe('WHITE');
      expect(g.status()).toBe('ACTIVE');
    });

    it('moves a pawn one or two squares from the start and switches turn', () => {
      const g = new Game();
      expect(g.legalMoves('e2')).toEqual(['e3', 'e4']);
      g.move('e2', 'e4');
      expect(g.pieceAt('e4')?.type).toBe('PAWN');
      expect(g.turn()).toBe('BLACK');
      expect(g.legalMoves('e4')).toEqual([]); // not white's turn
    });

    it('rejects moves out of turn, from empty squares, illegal targets and bad squares', () => {
      const g = new Game();
      expect(() => g.move('e7', 'e5')).toThrow();
      expect(() => g.move('e4', 'e5')).toThrow();
      expect(() => g.move('e2', 'e5')).toThrow();
      expect(() => g.move('z9', 'e4')).toThrow();
      expect(g.turn()).toBe('WHITE');
    });

    it('lets the knight jump, while blocked rooks have no moves', () => {
      const g = new Game();
      expect(g.legalMoves('b1')).toEqual(['a3', 'c3']);
      expect(g.legalMoves('a1')).toEqual([]);
    });
  });

  describe('move rules (Strategy)', () => {
    it('sliding pieces stop at their own pieces and capture the first enemy', () => {
      const g = new Game({ pieces: [W('a1', 'KING'), W('d4', 'ROOK'), W('d6', 'PAWN'), B('f4', 'KNIGHT'), B('h8', 'KING')] });
      expect(g.legalMoves('d4')).toEqual(['a4', 'b4', 'c4', 'd1', 'd2', 'd3', 'd5', 'e4', 'f4']);
      const r = g.move('d4', 'f4');
      expect(r.captured).toBe('KNIGHT');
    });

    it('pawns capture diagonally and cannot move into a blocked square', () => {
      const g = new Game({ pieces: [W('a1', 'KING'), W('e4', 'PAWN'), B('e5', 'PAWN'), B('d5', 'ROOK'), B('h8', 'KING')] });
      expect(g.legalMoves('e4')).toEqual(['d5']);
    });

    it('promotes a pawn on the last rank, to a queen by default', () => {
      const g = new Game({ pieces: [W('a1', 'KING'), W('b7', 'PAWN'), W('g7', 'PAWN'), B('e5', 'KING')] });
      expect(g.move('b7', 'b8').promotion).toBe('QUEEN');
      expect(g.pieceAt('b8')).toEqual({ color: 'WHITE', type: 'QUEEN' });
      g.move('e5', 'e4');
      expect(() => g.move('g7', 'g8', 'KING')).toThrow();
      g.move('g7', 'g8', 'KNIGHT');
      expect(g.pieceAt('g8')?.type).toBe('KNIGHT');
    });
  });

  describe('check', () => {
    it('reports check after a move', () => {
      const g = new Game({ pieces: [W('a1', 'KING'), W('h1', 'ROOK'), B('e8', 'KING')] });
      const r = g.move('h1', 'h8');
      expect(r.check).toBe(true);
      expect(r.checkmate).toBe(false);
      expect(g.isInCheck('BLACK')).toBe(true);
    });

    it('a pinned piece may only move along the pin, and a king may not step into attack', () => {
      const g = new Game({ pieces: [W('e1', 'KING'), W('e2', 'ROOK'), B('e8', 'ROOK'), B('d7', 'ROOK'), B('h8', 'KING')] });
      expect(g.legalMoves('e2')).toEqual(['e3', 'e4', 'e5', 'e6', 'e7', 'e8']);
      expect(g.legalMoves('e1')).toEqual(['f1', 'f2']); // d-file is covered by the rook on d7
    });

    it('when in check, only moves that end the check are legal', () => {
      const g = new Game({ pieces: [W('e1', 'KING'), W('a2', 'ROOK'), B('e8', 'ROOK'), B('h8', 'KING')] });
      expect(g.isInCheck('WHITE')).toBe(true);
      expect(() => g.move('a2', 'a3')).toThrow();
      expect(g.legalMoves('e1')).toEqual(['d1', 'd2', 'f1', 'f2']);
      expect(() => g.move('a2', 'e2')).not.toThrow(); // block
      expect(g.isInCheck('WHITE')).toBe(false);
    });
  });

  describe('end of game', () => {
    it("detects checkmate (fool's mate) and stops the game", () => {
      const g = new Game();
      g.move('f2', 'f3');
      g.move('e7', 'e5');
      g.move('g2', 'g4');
      const r = g.move('d8', 'h4');
      expect(r.checkmate).toBe(true);
      expect(g.status()).toBe('CHECKMATE');
      expect(g.winner()).toBe('BLACK');
      expect(() => g.move('a2', 'a3')).toThrow();
    });

    it('detects stalemate: no legal move and not in check', () => {
      const g = new Game({ pieces: [W('h1', 'KING'), W('b5', 'QUEEN'), B('a8', 'KING')] });
      const r = g.move('b5', 'b6');
      expect(r.check).toBe(false);
      expect(g.status()).toBe('STALEMATE');
      expect(g.winner()).toBeNull();
    });
  });

  describe('extensibility', () => {
    it('accepts a new piece type with its own MoveRule (Open/Closed)', () => {
      const amazon = new CombinedRule(new SlidingRule([...ORTHOGONAL, ...DIAGONAL]), new LeapingRule(KNIGHT_JUMPS));
      const g = new Game({
        pieces: [W('a1', 'KING'), W('d4', 'AMAZON'), B('h8', 'KING')],
        rules: { AMAZON: amazon },
      });
      expect(g.legalMoves('d4')).toContain('e6'); // knight jump
      expect(g.legalMoves('d4')).toContain('h4'); // rook line
      expect(g.move('d4', 'e6').check).toBe(false); // jump
      g.move('h8', 'h7');
      expect(g.move('e6', 'e4').check).toBe(true); // slides, then checks h7 on the diagonal
      expect(() => new Game({ pieces: [W('a1', 'DRAGON')] })).toThrow(); // no rule registered
    });
  });
});
