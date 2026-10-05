import { test } from 'vitest';
import assert from 'node:assert/strict';
import { BASE, START, applyRoll, createGame, type Color, type GameState, type TokenRow } from '@/lib/game';
import { chooseMove, scoreMove } from '@/lib/bot';

const RED: Color = 0;
const YELLOW: Color = 2;

function rolled(tokens: Partial<Record<Color, TokenRow>>, dice: number): GameState {
  const state = createGame({ players: [RED, YELLOW] });
  const all = state.tokens.map((row, color) => tokens[color as Color] ?? row) as GameState['tokens'];
  return applyRoll({ ...state, tokens: all }, dice);
}

const progressAt = (color: Color, index: number) => (index - START[color] + 52) % 52;

test('reaching the goal beats a capture', () => {
  // Token 0: 53 → 56 (goal). Token 1: 6 → 9, capturing Yellow (9 is not a star cell).
  const state = rolled({ [RED]: [53, 6, BASE, BASE], [YELLOW]: [progressAt(YELLOW, 9), BASE, BASE, BASE] }, 3);
  assert.equal(chooseMove(state), 0);
  assert.ok(scoreMove(state, 0) > scoreMove(state, 1));
});

test('a capture beats leaving the base', () => {
  const state = rolled({ [RED]: [3, BASE, BASE, BASE], [YELLOW]: [progressAt(YELLOW, 9), BASE, BASE, BASE] }, 6);
  assert.equal(chooseMove(state), 0);
});

test('leaving the base beats entering the home column', () => {
  const state = rolled({ [RED]: [47, BASE, BASE, BASE] }, 6);
  assert.notEqual(chooseMove(state), 0);
});

test('entering the home column beats landing on a safe cell', () => {
  // Token 0: 48 → 51 (home column). Token 1: 5 → 8 (star cell).
  const state = rolled({ [RED]: [48, 5, BASE, BASE] }, 3);
  assert.equal(chooseMove(state), 0);
});

test('a safe cell beats a plain move further ahead', () => {
  // Token 0: 5 → 8 (star). Token 1: 30 → 33 (plain, but more progress).
  const state = rolled({ [RED]: [5, 30, BASE, BASE] }, 3);
  assert.equal(chooseMove(state), 0);
});

test('otherwise the token that ends up furthest ahead wins', () => {
  const state = rolled({ [RED]: [10, 20, BASE, BASE] }, 2);
  assert.equal(chooseMove(state), 1);
});

test('only ever picks a legal move', () => {
  const state = rolled({ [RED]: [10, BASE, BASE, BASE] }, 2);
  assert.equal(chooseMove(state), 0);
});
