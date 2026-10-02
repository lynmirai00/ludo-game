# Game rules and data model

## Rules (the project's standard rule set)
1. 2 to 4 players, 4 tokens each, colors: Red, Green, Yellow, Blue.
2. Turn order is clockwise: Red → Green → Yellow → Blue. In a 2-player game only Red and Yellow play (opposite corners).
3. Each turn the player rolls one die (1 to 6).
4. A token can leave the base only on a roll of **6**. It enters on its color's start cell.
5. A token on the track moves forward exactly the number rolled.
6. **Capture:** landing on a cell occupied by an opponent's token sends that token back to its base. Captures are not allowed on **safe cells** (star cells, including all 4 start cells). Tokens of different colors may share a safe cell.
7. **Extra turn:** rolling a 6, or capturing a token, gives the same player another turn.
8. After a full lap (51 cells) a token turns into its **home column** of 5 colored cells, then the goal.
9. Reaching the goal requires an **exact roll**. If the roll would overshoot the goal, that token cannot move.
10. If no token can move, the turn is skipped.
11. The first player to get all 4 tokens to the goal wins, and the game ends immediately.

Variants that may be added later must be options that are OFF by default:
- Leave the base on a 1 or a 6.
- Three 6s in a row forfeits the turn.
- Vietnamese "climbing home" rule: inside the home column, the player must roll the exact number of the next step.

## Token position model
Each token is stored as one integer, `progress`, relative to its own color:

| progress | Meaning |
|---|---|
| -1 | In base |
| 0 to 50 | On the shared track. 0 is that color's start cell |
| 51 to 55 | In the home column (5 colored cells) |
| 56 | Reached the goal |

Position on the shared track (index 0..51 into `PATH`):
`trackIndex = (START[color] + progress) % 52`

Two tokens of different colors are on the same cell when they have the same `trackIndex` (only for progress 0..50).

## Board: 15 x 15 grid, coordinates are [row, col], zero-based
Shared track, 52 cells, starting at Red's start cell, going clockwise:
```js
const PATH = [
  [6,1],[6,2],[6,3],[6,4],[6,5],[5,6],[4,6],[3,6],[2,6],[1,6],[0,6],[0,7],[0,8],
  [1,8],[2,8],[3,8],[4,8],[5,8],[6,9],[6,10],[6,11],[6,12],[6,13],[6,14],[7,14],[8,14],
  [8,13],[8,12],[8,11],[8,10],[8,9],[9,8],[10,8],[11,8],[12,8],[13,8],[14,8],[14,7],[14,6],
  [13,6],[12,6],[11,6],[10,6],[9,6],[8,5],[8,4],[8,3],[8,2],[8,1],[8,0],[7,0],[6,0],
];
const SAFE = new Set([0, 8, 13, 21, 26, 34, 39, 47]); // indices into PATH
```

Per-color data:

| Color | Hex | START | Base (6x6 area) | 4 token slots in base | Home column (5 cells) | Goal cell |
|---|---|---|---|---|---|---|
| Red | #d64545 | 0 | top-left | [2,2] [2,3] [3,2] [3,3] | [7,1]→[7,5] | [7,6] |
| Green | #2e9d5b | 13 | top-right | [2,11] [2,12] [3,11] [3,12] | [1,7]→[5,7] | [6,7] |
| Yellow | #e0ad1f | 26 | bottom-right | [11,11] [11,12] [12,11] [12,12] | [7,13]→[7,9] | [7,8] |
| Blue | #2f74c0 | 39 | bottom-left | [11,2] [11,3] [12,2] [12,3] | [13,7]→[9,7] | [8,7] |

The center area [6..8, 6..8] is the goal zone.

## Suggested `shared/game.js` API
```js
createGame({ players: [0, 2], options })   // returns the initial state
legalMoves(state, diceValue)               // token indices the current player can move
applyRoll(state, diceValue)                // records the roll; auto-skips the turn if no move exists
applyMove(state, tokenIndex)               // moves a token, handles capture, extra turn, win
cellOf(color, progress, tokenIndex)        // [row, col] for rendering
```
The state contains at least: `players`, `tokens` (4 colors x 4 tokens), `turn`, `dice`, `phase` (`roll` | `move` | `over`), `winner`, and `events` (a list of events for the game log, e.g. `{ type: 'capture', by, victim }`).

## Bot
Pick the move with the highest score:
reach goal (+1000) > capture (+800) > leave base (+500) > enter home column (+300) > land on a safe cell (+100), plus the new progress value.
Bots act after a 0.7–0.9 second delay so the human can follow along.

## Minimum tests for the game rules
- No 6 means no token can leave the base.
- A token leaving the base is placed at progress 0.
- A capture sends the opponent token to -1; no capture on safe cells.
- A 6 or a capture keeps the same player's turn.
- A token cannot overshoot the goal; an exact roll reaches the goal (56).
- With no legal move the turn passes automatically.
- 4 tokens in the goal sets `phase = 'over'` and a `winner`.
- Simulate 100 bot-only games with random dice: every game ends, none gets stuck.
- For Green, Yellow and Blue, progress 50 must be the cell right before that color's home column.
