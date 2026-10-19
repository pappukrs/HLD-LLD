# 23 · Chess

> Asked at: Atlassian, Amazon, Microsoft, Flipkart, Uber. A classic test of class design and Open/Closed.
> Time box: **90 min** (15 min design, 60 min code, 15 min tests and extensions)
> Patterns you should reach for: **Strategy** (a move rule per piece), **Factory** (piece type → rule), simulate-and-check for legality

## Problem statement (as the interviewer says it)

"Design a two-player chess game. Players take turns. Each piece moves by its own rules.
A move that leaves your own king in check is illegal. Tell us when a player is in check, and when the game ends by checkmate or stalemate."

## Step 1: clarify (ask these out loud)

Ask these before writing any code. The assumed answers below are what the tests expect.

| Question | Assumed answer |
|---|---|
| How are squares named? | Algebraic: `'a1'` … `'h8'`. White starts on ranks 1–2 |
| Who moves first? | White. A custom setup can say who moves |
| Custom positions? | Yes: `pieces: [{ square, color, type }]`. Tests use small positions |
| Which rules? | Normal moves and captures for all six pieces, pawn double step from the start rank, promotion |
| Promotion? | On the last rank. Default QUEEN. Allowed: QUEEN, ROOK, BISHOP, KNIGHT |
| Check? | A move that leaves your own king attacked is illegal, including moves of pinned pieces |
| Game end? | No legal move: CHECKMATE if in check, else STALEMATE. Then every move throws |
| Illegal input? | Wrong turn, empty square, illegal target, bad square name → throw. The board does not change |
| Castling, en passant? | Not required. They are extensions (see Step 5) |
| Draw by repetition, 50-move rule, clocks, PGN? | Out of scope. Mention them as extensions |

## Step 2: public API (what the tests call)

```ts
const game = new Game();                       // standard start, white to move
const custom = new Game({
  pieces: [{ square: 'e1', color: 'WHITE', type: 'KING' }, { square: 'e8', color: 'BLACK', type: 'KING' }],
  toMove: 'WHITE',
  rules: { AMAZON: new CombinedRule(new SlidingRule(ORTHOGONAL), new LeapingRule(KNIGHT_JUMPS)) }, // optional
});

game.legalMoves('e2');            // → ['e3', 'e4'] (sorted)
const r = game.move('e2', 'e4');  // → MoveResult { from, to, piece, captured, promotion, check, checkmate }
game.move('b7', 'b8', 'KNIGHT');  // promotion choice
game.pieceAt('e4');               // → { color, type } | null
game.turn();                      // → 'WHITE' | 'BLACK'
game.isInCheck('BLACK');          // → boolean
game.status();                    // → 'ACTIVE' | 'CHECKMATE' | 'STALEMATE'
game.winner();                    // → Color | null
```

`MoveRule`, `SlidingRule`, `LeapingRule`, `PawnRule`, `CombinedRule` and the direction constants are exported so you can build new pieces. The rest is **your design**.

## Step 3: entities (try them yourself first)

<details>
<summary>Reveal a good entity list</summary>

- `Game`: the facade. Owns the board, the side to move, the status and the rule table
- `Board`: an 8×8 grid of `Piece | null`. `at`, `set`, `clone`, `pieces()`
- `Piece`: a plain value `{ color, type }`. It has no behaviour; the rule table gives it behaviour
- `MoveRule` (interface, the Strategy): `targets(board, from, piece)` returns **pseudo-legal** squares (it ignores check)
  - `SlidingRule(directions)`: rook, bishop, queen
  - `LeapingRule(offsets)`: knight, king
  - `PawnRule`: forward into empty squares, diagonal only to capture
  - `CombinedRule(...rules)`: custom pieces
- Rule table (a simple Factory): `Record<PieceType, MoveRule>`. A new piece = a new entry
- Legality: for each pseudo-legal target, apply the move on a **cloned** board and check that your own king is not attacked
- "Is the king attacked?" = can any enemy rule reach the king's square? One function serves check detection, pins and "the king may not step into attack"

Many people make `Piece` an abstract class with `King extends Piece`. That works too. The rule table is easier to extend: a new piece needs no new class hierarchy.

</details>

## Step 4: implement

- Write your code in `starter.ts`. Keep the exported names.
- Run `npx vitest run lld/problems/23-chess` until it's green.
- Don't open `reference.ts` until your tests pass, or until you've spent 90 minutes.

## Step 5: extensions interviewers ask after you finish

1. **Castling.** Needs state outside the board: has the king or this rook moved? The squares between must be empty, and the king may not be in check, pass through an attacked square, or land on one. Store `hasMoved` per piece or "castling rights" in the game.
2. **En passant.** Needs the last move. If the last move was a pawn double step next to your pawn, you may capture it on the square it skipped, on this move only. The captured pawn is not on the target square: your move code must handle "capture elsewhere".
3. **Undo a move.** Keep a move history of Command objects (from, to, captured piece, promotion, old castling rights). Undo reverses the last one.
4. **Speed.** Cloning the board for each candidate move is fine for an interview. Engines make and unmake moves on one board, and use bitboards.
5. **Draws.** Threefold repetition (hash each position), the 50-move rule (a counter reset by pawn moves and captures), insufficient material.
6. **Players and clocks.** A `Player` interface (human, bot) and a `Clock` per side. The bot is another Strategy.

## Self-check before you call it done

- [ ] No `switch (piece.type)` in `Game`. Each piece's rule is a Strategy found in a table.
- [ ] One "is this square attacked by colour X" function, used for check, pins and king safety.
- [ ] Legality uses a cloned board or make/unmake. The real board never holds an illegal position.
- [ ] A rejected move leaves the board and the turn unchanged.
- [ ] Adding a new piece type needs no change inside `Game`.

## Concepts used

- [Strategy pattern](../../4-behavioral/L20-strategy/README.md) · [Factory](../../2-creational/L09-factory-method/README.md) · [Command (for undo)](../../4-behavioral/L23-command/README.md) · [SOLID](../../1-foundations/L04-solid-srp-ocp/README.md)
- Related problem: [Tic-Tac-Toe](../07-tic-tac-toe) (the same board + turn + status shape, but smaller)
- Visual: [Strategy + Factory](../../4-behavioral/L20-strategy/visual.html)
