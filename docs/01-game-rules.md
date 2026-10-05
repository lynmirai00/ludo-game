# Game rules and data model

The game follows the Vietnamese rules of "Cờ cá ngựa" (horse race chess). They differ from international Ludo:
pieces block the way, a piece leaves its base on a 1 or a 6, and the home column is climbed step by step.
In the code and docs a piece is called a **token**; in Vietnamese UI text it is a "ngựa" (horse).

## Rules
1. **Players:** 2 to 4 players, 4 tokens each, colors Red, Green, Yellow, Blue. Turn order is clockwise:
   Red → Green → Yellow → Blue. The human always plays Red. Seats by number of players:
   2 players = Red, Yellow (opposite corners); 3 players = Red, Green, Yellow; 4 players = all four.
2. **Rolling:** each turn the player rolls one die (1 to 6).
3. **Leaving the base:** a token leaves the base only on a roll of **1 or 6**. It is placed on its color's start cell
   (it does not move further on that roll). It cannot leave if a token of its own color is on the start cell.
   If an opponent's token is on the start cell, the new token captures it.
4. **Moving:** a token on the track moves clockwise exactly the number rolled. Only one token moves per roll.
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
   before its home column (progress 50). A roll that would carry it past the entrance does not move that token.
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
| 0 to 50 | On the shared track. 0 is that color's start cell, 50 is its home entrance |
| 51 to 56 | In the home column: step = progress − 50 (step 1 to step 6) |

Position on the shared track (index 0..51 into `PATH`):
`trackIndex = (START[color] + progress) % 52`

Two tokens of different colors are on the same cell when they have the same `trackIndex` (only for progress 0..50).
Blocking checks look at the track cells strictly between the start and the landing cell, for tokens of every color.

## Board: 15 x 15 grid, coordinates are [row, col], zero-based
Shared track, 52 cells, starting at Red's start cell, going clockwise:
```ts
const PATH = [
  [6,1],[6,2],[6,3],[6,4],[6,5],[5,6],[4,6],[3,6],[2,6],[1,6],[0,6],[0,7],[0,8],
  [1,8],[2,8],[3,8],[4,8],[5,8],[6,9],[6,10],[6,11],[6,12],[6,13],[6,14],[7,14],[8,14],
  [8,13],[8,12],[8,11],[8,10],[8,9],[9,8],[10,8],[11,8],[12,8],[13,8],[14,8],[14,7],[14,6],
  [13,6],[12,6],[11,6],[10,6],[9,6],[8,5],[8,4],[8,3],[8,2],[8,1],[8,0],[7,0],[6,0],
];
```
There are no safe (star) cells.

Per-color data:

| Color | Hex | START | Base (6x6 area) | 4 token slots in base | Home column, steps 1 → 6 |
|---|---|---|---|---|---|
| Red | #d64545 | 0 | top-left | [2,2] [2,3] [3,2] [3,3] | [7,1] → [7,6] |
| Green | #2e9d5b | 13 | top-right | [2,11] [2,12] [3,11] [3,12] | [1,7] → [6,7] |
| Yellow | #e0ad1f | 26 | bottom-right | [11,11] [11,12] [12,11] [12,12] | [7,13] → [7,8] |
| Blue | #2f74c0 | 39 | bottom-left | [11,2] [11,3] [12,2] [12,3] | [13,7] → [8,7] |

Steps 1–5 are the colored cells of each arm; step 6 is the cell at the edge of the center area [6..8, 6..8].
The board shows the step number (1–6) on each home column cell. The start cell of each color is drawn in its color.

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
- A token must stop exactly on the home entrance (50); a roll that passes it does not move that token.
- From the entrance a roll of N goes to step N only if steps 1..N are free; from step S only a roll of S + 1 climbs,
  and only if step S + 1 is free; step 6 never moves.
- All 4 tokens on steps 3–6 finishes the player with the next place; finished players are skipped.
- The game ends when one unfinished player is left; it gets the last place and `phase = 'over'`.
- Works with 2, 3 and 4 players.
- Simulate 100 bot-only games (2, 3 and 4 players) with random dice: every game ends with a full ranking, none gets stuck.
- For every color, progress 50 is the cell right before that color's home column.
