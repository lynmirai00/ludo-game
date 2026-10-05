import { expect, test } from 'vitest';
import { BASE, LAST_TRACK, START, applyRoll, createGame, type Color, type GameState, type TokenRow } from '@/lib/game';
import { chooseMove, scoreMove } from '@/lib/bot';

const RED: Color = 0;
const YELLOW: Color = 2;
const step = (n: number) => LAST_TRACK + n;

function rolled(tokens: Partial<Record<Color, TokenRow>>, dice: number): GameState {
  const state = createGame({ players: [RED, YELLOW] });
  const all = state.tokens.map((row, color) => tokens[color as Color] ?? row) as GameState['tokens'];
  return applyRoll({ ...state, tokens: all }, dice);
}

const progressAt = (color: Color, index: number) => (index - START[color] + 52) % 52;

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
  const state = rolled({ [RED]: [44, BASE, BASE, BASE] }, 6); // token 0: 44 → 50
  expect(chooseMove(state)).not.toBe(0);
});

test('stopping on the home entrance beats a plain move', () => {
  const state = rolled({ [RED]: [47, 20, BASE, BASE] }, 3);
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
