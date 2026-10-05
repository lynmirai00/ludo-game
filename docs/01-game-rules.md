# Game rules and data model

The game follows the Vietnamese rules of "Cờ cá ngựa" (horse race chess). They differ from international Ludo:
pieces block the way, a piece leaves its base on a 1 or a 6, and the home column is climbed step by step.
In the code and docs a piece is called a **token**; in Vietnamese UI text it is a "ngựa" (horse).

## Rules
1. **Players:** 2 to 4 players, 4 tokens each, colors Red, Green, Yellow, Blue. Bases: Red bottom-left,
   Green bottom-right, Yellow top-right, Blue top-left. Turn order follows the direction of movement
   (counterclockwise on screen): Red → Green → Yellow → Blue. The human always plays Red. Seats by number of players:
   2 players = Red, Yellow (opposite corners); 3 players = Red, Green, Yellow; 4 players = all four.
2. **Rolling:** each turn the player rolls one die (1 to 6).
3. **Leaving the base:** a token leaves the base only on a roll of **1 or 6**. It is placed on its color's start cell
   (it does not move further on that roll). It cannot leave if a token of its own color is on the start cell.
   If an opponent's token is on the start cell, the new token captures it.
4. **Moving:** a token on the track moves **counterclockwise** (as the arrows on the board show) exactly the number rolled. Only one token moves per roll.
   If any legal move exists, the player must make one; if none exists, nothing moves.
5. **Blocking:** a token may not pass over any token, of any color, on the cells between its start and its landing
   cell. It may not land on a cell occupied by a token of its own color. As a result a track cell never holds
   more than one token.
6. **Capture:** landing exactly on a cell occupied by an opponent's token sends that token back to its base.
   There are **no safe cells**: a token can be captured anywhere on the track, including on a start cell.
   A capture does not give an extra roll.
7. **Extra roll:** rolling a **1 or a 6** gives the same player another roll, whether or not a token could move.
   Any other roll passes the turn to the next player.
8. **Home entrance:** after a full lap a token must stop **exactly** on its home entrance, the last track cell
   before its home column (progress 55). A roll that would carry it past the entrance does not move that token.
9. **Home column:** the home column has **6 steps**, numbered 1 to 6.
   - From the home entrance, a roll of N moves the token straight to step N, if steps 1 to N are all free.
   - From step S, the token can only move to step S + 1, and only with a roll of exactly S + 1, if that step is free.
     Example: a token on step 3 needs a 4 to climb to step 4.
   - A token on step 6 never moves again. Tokens in a home column cannot be captured.
10. **Finishing:** a player finishes when all 4 tokens stand on steps 3, 4, 5 and 6. Finished players are skipped
    from then on, even if their last roll was a 1 or a 6. The first player to finish places 1st, the next 2nd, and so on.
11. **End of the game:** play continues until only one player has not finished; that player takes the last place
    and the game is over. The human's result is known as soon as their own place is decided (they finish, or they
    are the last one left). The bots then keep playing for the remaining places; the human can press "New game"
    instead of watching.

## Token position model
Each token is stored as one integer, `progress`, relative to its own color:

| progress | Meaning |
|---|---|
| -1 | In base |
| 0 to 55 | On the shared track. 0 is that color's start cell, 55 is its home entrance (the cell just before the start cell) |
| 56 to 61 | In the home column: step = progress − 55 (step 1 to step 6) |

Position on the shared track (index 0..55 into `PATH`):
`trackIndex = (START[color] + progress) % 56`

Two tokens of different colors are on the same cell when they have the same `trackIndex` (only for progress 0..55).
Blocking checks look at the track cells strictly between the start and the landing cell, for tokens of every color.

## Board: 15 x 15 grid, coordinates are [row, col], zero-based
The layout follows the traditional Vietnamese board (reference picture provided by the user):
each arm is 3 cells wide; the outer two lanes are the track, the middle lane is a home column; the four cells next
to the center ([6,6], [6,8], [8,6], [8,8]) are track cells too, and the center is the single cell [7,7].

Shared track, 56 cells, 14 per color, starting at Red's start cell, going counterclockwise on screen:
```ts
const PATH = [
  // Red: start [8,0] → right along row 8 → down column 6 → bottom middle
  [8,0],[8,1],[8,2],[8,3],[8,4],[8,5],[8,6],[9,6],[10,6],[11,6],[12,6],[13,6],[14,6],[14,7],
  // Green: start [14,8] → up column 8 → right along row 8 → right middle
  [14,8],[13,8],[12,8],[11,8],[10,8],[9,8],[8,8],[8,9],[8,10],[8,11],[8,12],[8,13],[8,14],[7,14],
  // Yellow: start [6,14] → left along row 6 → up column 8 → top middle
  [6,14],[6,13],[6,12],[6,11],[6,10],[6,9],[6,8],[5,8],[4,8],[3,8],[2,8],[1,8],[0,8],[0,7],
  // Blue: start [0,6] → down column 6 → left along row 6 → left middle
  [0,6],[1,6],[2,6],[3,6],[4,6],[5,6],[6,6],[6,5],[6,4],[6,3],[6,2],[6,1],[6,0],[7,0],
];
```
There are no safe (star) cells. Each color's home entrance is the last cell of the previous color's 14 cells
(Red [7,0], Green [14,7], Yellow [7,14], Blue [0,7]), right next to the first step of its home column.

Per-color data:

| Color | Hex | START | Arrow | Base (6x6 area) | 4 token slots in base | Home column, steps 1 → 6 |
|---|---|---|---|---|---|---|
| Red | #d64545 | 0 ([8,0]) | → | bottom-left, rows 9–14, cols 0–5 | [11,2] [11,3] [12,2] [12,3] | [7,1] → [7,6] |
| Green | #2e9d5b | 14 ([14,8]) | ↑ | bottom-right, rows 9–14, cols 9–14 | [11,11] [11,12] [12,11] [12,12] | [13,7] → [8,7] |
| Yellow | #e0ad1f | 28 ([6,14]) | ← | top-right, rows 0–5, cols 9–14 | [2,11] [2,12] [3,11] [3,12] | [7,13] → [7,8] |
| Blue | #2f74c0 | 42 ([0,6]) | ↓ | top-left, rows 0–5, cols 0–5 | [2,2] [2,3] [3,2] [3,3] | [1,7] → [6,7] |

Drawing (like the reference picture):
- Track cells are circles in the color of the segment they belong to (14 per color); each start cell shows a white
  arrow in the direction of movement.
- Home column cells are squares in a light tint of their color, showing the step number 1–6; step 6 touches the center.
- The center [7,7] is split into four triangles, each in the color of the home column that points at it.
- Bases are light squares with a thick border in their color, with the 4 token slots inside.

## Suggested `lib/game.ts` API
```ts
createGame({ players: [0, 2] })     // returns the initial state
legalMoves(state, diceValue)         // token indices the current player can move
applyRoll(state, diceValue)          // records the roll; if no move exists, the turn continues (1/6) or passes
applyMove(state, tokenIndex)         // moves a token: blocking, capture, extra roll, finishing, game over
cellOf(color, progress, tokenIndex)  // [row, col] for rendering
```
The state contains at least: `players`, `tokens` (4 colors x 4 tokens), `turn`, `dice`, `phase` (`roll` | `move` | `over`),
`ranking` (colors in finishing order; the last place is added when the game ends), and `events`
(a list of events for the game log; see `docs/04-i18n.md`). Events:
`rolled { player, value }`, `noMove { player }`, `enter { player, token }`,
`capture { player, victimColor, victimToken }`, `step { player, token, step }` (a token reached a home step),
`extraTurn { player }`, `finish { player, place }`.
Export TypeScript types for the state and for each event type (a discriminated union on `type`).
The "Fastest wins" leaderboard needs the human's roll count: count that player's `rolled` events (a helper in
`lib/game.ts`, e.g. `rollCount(state, color)`, with a test).

## Bot (`lib/bot.ts`)
Pick the move with the highest score:
climb or enter the home column (+1000, plus the step reached) > capture (+800) > leave base (+500)
> stop on the home entrance (+300), plus the new progress value.
Bots act after a 0.7–0.9 second delay so the human can follow along.
A "Fast bots" toggle (off by default, kept across new games) shortens the delay to about 0.12 s,
for example to watch the bots play for the remaining places.

## Minimum tests for the game rules
- Leaving the base: only on a 1 or a 6; the token lands on progress 0 and does not move further;
  not allowed when an own token is on the start cell; captures an opponent standing on the start cell.
- A token moves exactly the number rolled; it cannot pass over any token (own or opponent's) and cannot land on its own.
- A capture sends the opponent token to -1 and does not give an extra roll; captures also work on start cells.
- A 1 or a 6 gives another roll, even when no token could move; any other roll passes the turn.
- A token must stop exactly on the home entrance (55); a roll that passes it does not move that token.
- From the entrance a roll of N goes to step N only if steps 1..N are free; from step S only a roll of S + 1 climbs,
  and only if step S + 1 is free; step 6 never moves.
- All 4 tokens on steps 3–6 finishes the player with the next place; finished players are skipped.
- The game ends when one unfinished player is left; it gets the last place and `phase = 'over'`.
- Works with 2, 3 and 4 players.
- Simulate 100 bot-only games (2, 3 and 4 players) with random dice: every game ends with a full ranking, none gets stuck.
- For every color, progress 0 is the arrow cell next to its base and progress 55 is the cell right before step 1 of its home column.
- The track is 56 distinct cells, each next to the previous one (no diagonal steps).
