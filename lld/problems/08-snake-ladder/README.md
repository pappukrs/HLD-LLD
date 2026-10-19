# 08 · Snake and Ladder

> Asked at: Flipkart, Swiggy, PhonePe, Amazon, and many startups. A short design problem where clean structure and testability matter more than algorithms.
> Time box: **60 min** (10 min design, 35 min code, 15 min tests and extensions)
> Patterns you should reach for: **Builder** (board setup), **Strategy** (dice)

## Problem statement (as the interviewer says it)

"Design Snake and Ladder. The board has 100 cells. There are snakes and ladders at fixed places. Two or more players take turns rolling a dice.
Landing on a ladder's bottom takes you up. Landing on a snake's head takes you down. The first player to reach cell 100 wins.
Make it testable: I want to run a whole game in a unit test and know the result."

## Step 1: clarify (ask these out loud)

Ask these before writing any code. The assumed answers below are what the tests expect.

| Question | Assumed answer |
|---|---|
| Board size? | 100 by default, configurable |
| Where do players start? | Cell 0, off the board. Rolling 1 puts you on cell 1 |
| Do you need an exact roll to finish? | Yes. If the roll goes past the last cell, you stay where you are |
| Extra turn on a 6, or three 6s in a row? | No. Mention them as extensions |
| Chains (ladder top on a snake head)? | Not allowed. The builder rejects a jump that ends where another starts. One jump per move |
| Two jumps from one cell? | Rejected |
| Snake head on the last cell? | Rejected. Nobody could ever win. A ladder can **end** on the last cell |
| How many players? | At least 2, unique names |
| Dice? | Injected. Default: one 6-face dice with `Math.random`. Tests pass a fixed sequence |
| Bad dice value (0, 1.5)? | Throw, nobody moves |
| After someone wins? | `playTurn` throws. Game ends at the first winner |

## Step 2: public API (what the tests call)

```ts
const game = new GameBuilder()
  .boardSize(100)
  .addSnake(99, 10)
  .addLadder(4, 56)
  .addPlayer('Asha')
  .addPlayer('Ravi')
  .withDice(new StandardDice(6, Math.random))   // or any { roll(): number }
  .build();                                      // validates everything here

game.playTurn();      // → { player, roll, from, to, jump: 'SNAKE' | 'LADDER' | null, won }
game.currentPlayer;   // → 'Ravi'
game.position('Asha');
game.winner;          // → string | null
game.play();          // plays to the end, returns the winner's name

interface Dice { roll(): number }
```

## Step 3: entities (try them yourself first)

<details>
<summary>Reveal a good entity list</summary>

- `GameBuilder`: collects the board size, snakes, ladders, players and dice. `build()` validates all of it at once and returns a ready `Game`
- `Game`: positions per player, whose turn it is, the winner. `playTurn()` is one step
- `Dice` (interface, Strategy): `StandardDice(faces, random)`. A test passes a `SequenceDice`
- Jumps: one `Map<startCell, { to, kind }>` for both snakes and ladders. A snake and a ladder differ only in direction, so one lookup handles both
- `TurnResult`: an immutable record of one move. A UI or a log prints it

Why a Builder? The game has many optional parts, and some rules need all parts together (a snake and a ladder on the same cell). `build()` is the one place to check them, so a `Game` is always valid.

Do you need `Cell`, `Snake` and `Ladder` classes? Not here. A map lookup per move is O(1). Separate classes add code without adding behaviour. Say this out loud; it shows judgement.

Why inject the dice? `Math.random` inside `Game` makes every test random. With a `Dice` interface you can test snakes, ladders and the win rule with exact rolls.

</details>

## Step 4: implement

- Write your code in `starter.ts`. Keep the exported names.
- Run `npx vitest run lld/problems/08-snake-ladder` until it's green.
- Don't open `reference.ts` until your tests pass, or until you've spent 60 minutes.

## Step 5: extensions interviewers ask after you finish

1. **Extra turn on a 6, and three 6s in a row cancel the move.** Put turn rules in a `TurnRule` strategy, so `playTurn` does not grow `if` blocks.
2. **Two dice.** A new `Dice` that adds two dice. Nothing else changes. The test file has one.
3. **Random board generation.** Generate snakes and ladders with a seeded random function, and reuse the builder's validation.
4. **Keep playing for 2nd and 3rd place.** Remove the winner from the turn order and continue until one player is left.
5. **Many games at once on a server.** Each game is an object with its own state, keyed by game id. For online play, the server rolls the dice (never the client) and pushes `TurnResult`s to players over WebSockets.
6. **Replay a game.** Store the seed or the list of rolls. With injected dice, the same rolls give the same game.

## Self-check before you call it done

- [ ] There is no `Math.random()` inside `Game`.
- [ ] Every board rule is checked in `build()`. A `Game` cannot exist in a bad state.
- [ ] Snakes and ladders share one lookup. No `if (isSnake) ... else if (isLadder)`.
- [ ] A full game runs in a unit test with a known winner.

## Concepts used

- [Builder](../../2-creational/L11-builder/README.md) · [Strategy](../../4-behavioral/L20-strategy/README.md) · [Machine-coding framework](../../5-machine-coding/L30-machine-coding-framework/README.md)
- Visual: [Strategy + Factory](../../4-behavioral/L20-strategy/visual.html)
