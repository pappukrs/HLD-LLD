# 07 · Tic-Tac-Toe

> Asked at: Flipkart, Swiggy, Atlassian, Uber, Microsoft. A common first problem, and the base for "now make it N × N" follow-ups.
> Time box: **45 min** (10 min design, 25 min code, 10 min tests and extensions)
> Patterns you should reach for: **Strategy** (the win check), plus clean validation and a small state machine for the game status

## Problem statement (as the interviewer says it)

"Design Tic-Tac-Toe for two players on an N × N board. Players take turns. A player wins with a full row, column or diagonal.
The game ends in a draw when the board is full. Checking for a win after each move must be O(1), not O(N²)."

## Step 1: clarify (ask these out loud)

Ask these before writing any code. The assumed answers below are what the tests expect.

| Question | Assumed answer |
|---|---|
| Board size? | `size` (default 3). Must be an integer ≥ 3 |
| Who starts? | `X` by default. `first: 'O'` is allowed |
| What wins? | A full row, column, main diagonal or anti-diagonal (all N cells) |
| Last move fills the board and makes a line? | It is a win, not a draw |
| Taken cell, or outside the board? | Throw. The turn does not change |
| Move after the game ended? | Throw |
| Undo, AI player, "K in a row" on a big board? | Out of scope. Mention them as extensions |

## Step 2: public API (what the tests call)

```ts
const game = new TicTacToe({
  size: 3,
  first: 'X',
  winChecker: (n) => new LineCounterWinChecker(n),   // optional, this is the default
});

game.move(0, 0);         // → 'IN_PROGRESS' | 'X_WON' | 'O_WON' | 'DRAW'
game.status;             // same as the last move's result
game.currentPlayer;      // → 'X' | 'O'
game.cell(0, 0);         // → 'X' | 'O' | null
game.board();            // → a copy of the grid

interface WinChecker { recordMove(row: number, col: number, player: Player): boolean }
```

## Step 3: entities (try them yourself first)

<details>
<summary>Reveal a good entity list</summary>

- `TicTacToe`: owns the grid, the turn, the move count and the status. Validates moves
- `WinChecker` (interface, Strategy): told about each legal move, says if it wins
- `LineCounterWinChecker`: arrays `rows[n]`, `cols[n]` and two numbers `diag`, `anti`. X adds +1, O adds −1. A win is when a counter reaches +n or −n
- `Player`, `Cell`, `GameStatus`: small union types

Why does the ±1 trick work? A line that has both X and O can never reach ±n, because each O cancels an X. Only a line owned by one player reaches ±n. Each move updates at most 4 counters: O(1) time, O(n) memory.

The naive check scans the row, the column and both diagonals of the last move: O(n). Scanning the whole board is O(n²). Say both, then write the counter version.

Do you need `Player` classes? Not for this scope. Two string symbols are enough. Add a `Player { name, symbol }` class only if the interviewer adds names, scores or more than two players.

</details>

## Step 4: implement

- Write your code in `starter.ts`. Keep the exported names.
- Run `npx vitest run lld/problems/07-tic-tac-toe` until it's green.
- Don't open `reference.ts` until your tests pass, or until you've spent 45 minutes.

## Step 5: extensions interviewers ask after you finish

1. **Undo.** Store moves on a stack (Command pattern). Undo pops the move, clears the cell, and subtracts the same ±1 from the counters. Status goes back to `IN_PROGRESS`.
2. **More than two players.** The ±1 trick breaks. Keep a count per player per line: `rows[player][r]`. Still O(1) per move.
3. **K in a row on a big board (Gomoku).** Counters per full line no longer work. After each move, walk in 4 directions from the new cell and count same-symbol cells: O(k) per move. This is another `WinChecker`.
4. **Computer player.** A `MoveStrategy` interface: random, or minimax for 3 × 3.
5. **Online game.** Two players on different devices: the server owns the game state and validates every move. Use WebSockets to push moves. Reject a move if it is not that player's turn.

## Self-check before you call it done

- [ ] The win check does not scan the board. It is O(1) per move.
- [ ] An illegal move changes nothing: same board, same turn.
- [ ] The board you return is a copy.
- [ ] Win is checked before draw.
- [ ] A new win rule plugs in through `WinChecker` with no change to `TicTacToe`.

## Concepts used

- [Strategy](../../concepts/patterns/p10-strategy.md) · [Command (for undo)](../../concepts/patterns/p13-command.md) · [Machine-coding framework](../../concepts/04-lld-interview-framework.md)
- Visual: [Strategy + Factory](../../../visuals/v23-strategy-factory.html)
