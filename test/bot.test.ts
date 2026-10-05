import { expect, test } from 'vitest';
import { BASE, LAST_TRACK, START, applyRoll, createGame, replay, type Color, type GameState, type TokenRow } from '@/lib/game';
import { chooseMove, playBots, scoreMove } from '@/lib/bot';

const RED: Color = 0;
const YELLOW: Color = 2;
const step = (n: number) => LAST_TRACK + n;

function rolled(tokens: Partial<Record<Color, TokenRow>>, dice: number): GameState {
  const state = createGame({ players: [RED, YELLOW] });
  const all = state.tokens.map((row, color) => tokens[color as Color] ?? row) as GameState['tokens'];
  return applyRoll({ ...state, tokens: all }, dice);
}

const progressAt = (color: Color, index: number) => (index - START[color] + 56) % 56;

test('climbing the home column beats a capture', () => {
  // Token 0: step 3 → step 4. Token 1: 10 → 14, capturing Yellow.
  const state = rolled({ [RED]: [step(3), 10, BASE, BASE], [YELLOW]: [progressAt(YELLOW, 14), BASE, BASE, BASE] }, 4);
  expect(chooseMove(state)).toBe(0);
  expect(scoreMove(state, 0)).toBeGreaterThan(scoreMove(state, 1));
});

test('a capture beats leaving the base', () => {
  const state = rolled({ [RED]: [3, BASE, BASE, BASE], [YELLOW]: [progressAt(YELLOW, 9), BASE, BASE, BASE] }, 6);
  expect(chooseMove(state)).toBe(0);
});

test('leaving the base beats stopping on the home entrance', () => {
  const state = rolled({ [RED]: [LAST_TRACK - 6, BASE, BASE, BASE] }, 6); // token 0: 49 → 55 (entrance)
  expect(chooseMove(state)).not.toBe(0);
});

test('stopping on the home entrance beats a plain move', () => {
  const state = rolled({ [RED]: [LAST_TRACK - 3, 20, BASE, BASE] }, 3);
  expect(chooseMove(state)).toBe(0);
});

test('otherwise the token that ends up furthest ahead moves', () => {
  const state = rolled({ [RED]: [10, 20, BASE, BASE] }, 2);
  expect(chooseMove(state)).toBe(1);
});

test('only ever picks a legal move', () => {
  // Token 0 is blocked by token 1 (it would pass over it); token 1 can move.
  const state = rolled({ [RED]: [10, 12, BASE, BASE] }, 3);
  expect(chooseMove(state)).toBe(1);
});

// Seeded dice (mulberry32), so bot runs are reproducible. A short repeating pattern is not
// enough: with fixed cycles two bots can capture each other back and forth forever.
function dice(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let x = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return 1 + Math.floor((((x ^ (x >>> 14)) >>> 0) / 4294967296) * 6);
  };
}

test("playBots does nothing when it is already the human's turn", () => {
  const state = createGame({ players: [RED, YELLOW] });
  expect(playBots(state, RED, dice(1))).toEqual({ state, actions: [] });
});

test("playBots plays the bots until it is the human's turn again, and its actions replay exactly", () => {
  const start = applyRoll(createGame({ players: [RED, 1, YELLOW, 3] }), 3); // Red cannot move: Green's turn
  const { state, actions } = playBots(start, RED, dice(2));
  expect(state.turn).toBe(RED);
  expect(state.phase).toBe('roll');
  expect(actions.length).toBeGreaterThan(0);
  expect(replay([RED, 1, YELLOW, 3], [{ roll: 3 }, ...actions])).toEqual(state);
});

test('playBots plays to the end of the game once the human has finished', () => {
  const finished = { ...createGame({ players: [RED, 1, YELLOW] }), ranking: [RED], turn: 1 as Color };
  const { state } = playBots(finished, RED, dice(3));
  expect(state.phase).toBe('over');
  expect(state.ranking).toHaveLength(3);
  expect(state.ranking[0]).toBe(RED);
});
