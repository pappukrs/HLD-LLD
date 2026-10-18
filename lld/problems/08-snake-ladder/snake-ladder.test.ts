import * as starter from './starter';
import * as reference from './reference';
import type { Dice } from './reference';

// `npm test` checks your starter.ts; `npm run test:ref` checks the reference.
const { GameBuilder, StandardDice } = (process.env.REF ? reference : starter) as typeof reference;

// Deterministic dice: returns the given values in order, then repeats the last one.
class SequenceDice implements Dice {
  private i = 0;
  constructor(private readonly values: number[]) {}
  roll(): number {
    return this.values[Math.min(this.i++, this.values.length - 1)];
  }
}

function builder(rolls: number[], size = 20) {
  return new GameBuilder().boardSize(size).addPlayer('Asha').addPlayer('Ravi').withDice(new SequenceDice(rolls));
}

describe('08 · Snake and Ladder', () => {
  describe('moves', () => {
    it('starts everyone at 0 and takes turns in order', () => {
      const game = builder([3, 4]).build();
      expect(game.position('Asha')).toBe(0);
      expect(game.currentPlayer).toBe('Asha');
      expect(game.playTurn()).toEqual({ player: 'Asha', roll: 3, from: 0, to: 3, jump: null, won: false });
      expect(game.playTurn()).toMatchObject({ player: 'Ravi', to: 4 });
      expect(game.currentPlayer).toBe('Asha');
    });

    it('climbs a ladder', () => {
      const game = builder([2]).addLadder(2, 15).build();
      expect(game.playTurn()).toMatchObject({ from: 0, to: 15, jump: 'LADDER' });
      expect(game.position('Asha')).toBe(15);
    });

    it('slides down a snake', () => {
      const game = builder([5, 1, 6]).addSnake(11, 4).build();
      game.playTurn(); // Asha 5
      game.playTurn(); // Ravi 1
      expect(game.playTurn()).toMatchObject({ player: 'Asha', from: 5, to: 4, jump: 'SNAKE' });
    });

    it('stays in place when the roll goes past the last cell', () => {
      const game = builder([6, 1, 6, 1, 6, 1, 5]).build(); // Asha reaches 18, then rolls 5
      for (let i = 0; i < 6; i++) game.playTurn();
      expect(game.position('Asha')).toBe(18);
      expect(game.playTurn()).toMatchObject({ from: 18, to: 18, won: false });
    });

    it('wins on an exact landing and rejects turns after that', () => {
      const game = builder([6, 1, 6, 1, 6, 1, 2]).build();
      for (let i = 0; i < 6; i++) game.playTurn();
      expect(game.playTurn()).toMatchObject({ player: 'Asha', to: 20, won: true });
      expect(game.winner).toBe('Asha');
      expect(() => game.playTurn()).toThrow();
    });

    it('can win by a ladder that ends on the last cell', () => {
      const game = builder([4]).addLadder(4, 20).build();
      expect(game.playTurn()).toMatchObject({ to: 20, jump: 'LADDER', won: true });
    });
  });

  describe('builder validation', () => {
    it('rejects a snake that goes up or starts on the last cell', () => {
      expect(() => builder([1]).addSnake(3, 9).build()).toThrow();
      expect(() => builder([1]).addSnake(20, 2).build()).toThrow();
    });

    it('rejects a ladder that goes down or leaves the board', () => {
      expect(() => builder([1]).addLadder(9, 3).build()).toThrow();
      expect(() => builder([1]).addLadder(5, 25).build()).toThrow();
    });

    it('rejects two jumps from one cell, and a jump that ends on another start', () => {
      expect(() => builder([1]).addSnake(10, 2).addLadder(10, 15).build()).toThrow();
      expect(() => builder([1]).addLadder(3, 10).addSnake(10, 2).build()).toThrow();
    });

    it('needs at least two players with unique names', () => {
      expect(() => new GameBuilder().addPlayer('Solo').build()).toThrow();
      expect(() => new GameBuilder().addPlayer('A').addPlayer('A').build()).toThrow();
    });
  });

  describe('dice', () => {
    it('maps the injected random number to 1..faces', () => {
      const values = [0, 0.5, 0.999];
      let i = 0;
      const dice = new StandardDice(6, () => values[i++]);
      expect([dice.roll(), dice.roll(), dice.roll()]).toEqual([1, 4, 6]);
      expect(() => new StandardDice(0)).toThrow();
    });

    it('plays a full game to the end with a seeded dice', () => {
      const game = builder([4, 4]).addLadder(4, 16).build();
      expect(game.play()).toBe('Asha'); // 4 -> ladder 16, Ravi 4 -> 16, Asha 16+4 = 20
    });
  });

  describe('extensibility', () => {
    it('accepts any Dice, for example two dice added together', () => {
      class TwoDice implements Dice {
        constructor(private readonly a: Dice, private readonly b: Dice) {}
        roll() {
          return this.a.roll() + this.b.roll();
        }
      }
      const game = new GameBuilder()
        .addPlayer('Asha')
        .addPlayer('Ravi')
        .withDice(new TwoDice(new SequenceDice([6]), new SequenceDice([5])))
        .build();
      expect(game.playTurn()).toMatchObject({ roll: 11, to: 11 });
    });

    it('rejects a broken dice value instead of moving', () => {
      const game = builder([0]).build();
      expect(() => game.playTurn()).toThrow();
      expect(game.position('Asha')).toBe(0);
    });
  });
});
