import { describe, test } from 'vitest';
import assert from 'node:assert/strict';
import {
  BASE,
  GOAL,
  GOAL_CELLS,
  HOME_COLUMNS,
  LAST_TRACK,
  PATH,
  SAFE,
  START,
  applyMove,
  applyRoll,
  cellOf,
  createGame,
  legalMoves,
  trackIndex,
  type Color,
  type GameEvent,
  type GameState,
  type TokenRow,
} from '@/lib/game';
import { chooseMove } from '@/lib/bot';

const RED: Color = 0;
const GREEN: Color = 1;
const YELLOW: Color = 2;
const BLUE: Color = 3;
const ALL_COLORS: Color[] = [RED, GREEN, YELLOW, BLUE];

type Setup = { players?: Color[]; turn?: Color; tokens?: Partial<Record<Color, TokenRow>> };

// Builds a game where it is `turn`'s move, with the given token progress values.
function stateWith({ players = [RED, YELLOW], turn = RED, tokens = {} }: Setup = {}): GameState {
  const state = createGame({ players });
  const all = state.tokens.map((row, color) => tokens[color as Color] ?? row) as GameState['tokens'];
  return { ...state, turn, tokens: all };
}

// Progress value that puts `color`'s token on shared track cell `index`.
function progressAt(color: Color, index: number): number {
  return (index - START[color] + 52) % 52;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

function newEvents(before: GameState, after: GameState): GameEvent[] {
  return after.events.slice(before.events.length);
}

// Small seeded PRNG so the simulation is reproducible.
function mulberry32(seed: number) {
  return function next() {
    seed = (seed + 0x6d2b79f5) | 0;
    let x = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

describe('board data', () => {
  test('the shared track has 52 distinct cells inside the 15x15 grid', () => {
    assert.equal(PATH.length, 52);
    assert.equal(new Set(PATH.map(([r, c]) => `${r},${c}`)).size, 52);
    for (const [r, c] of PATH) assert.ok(r >= 0 && r < 15 && c >= 0 && c < 15);
  });

  test('consecutive track cells are adjacent, and the track is a closed loop', () => {
    for (let i = 0; i < 52; i++) {
      const [r1, c1] = PATH[i]!;
      const [r2, c2] = PATH[(i + 1) % 52]!;
      const dist = Math.abs(r1 - r2) + Math.abs(c1 - c2);
      // Corner turns into the arms are diagonal steps (e.g. [6,5] → [5,6]).
      assert.ok(dist === 1 || (dist === 2 && r1 !== r2 && c1 !== c2), `step ${i}`);
    }
  });

  test('all four start cells are safe', () => {
    for (const start of START) assert.ok(SAFE.has(start));
  });
});

describe('createGame()', () => {
  test('starts with every token in base and the first player to roll', () => {
    const state = createGame({ players: [RED, YELLOW] });
    assert.deepEqual(state.players, [RED, YELLOW]);
    assert.equal(state.tokens.length, 4);
    for (const row of state.tokens) assert.deepEqual(row, [BASE, BASE, BASE, BASE]);
    assert.equal(state.turn, RED);
    assert.equal(state.phase, 'roll');
    assert.equal(state.dice, null);
    assert.equal(state.winner, null);
    assert.deepEqual(state.events, []);
  });

  test('puts players in clockwise order', () => {
    assert.deepEqual(createGame({ players: [BLUE, RED, YELLOW, GREEN] }).players, [RED, GREEN, YELLOW, BLUE]);
  });

  test('rejects invalid player lists', () => {
    assert.throws(() => createGame({ players: [RED] }));
    assert.throws(() => createGame({ players: [RED, RED] }));
    assert.throws(() => createGame({ players: [RED, 4] }));
    assert.throws(() => createGame({ players: [RED, GREEN, YELLOW, BLUE, RED] }));
  });
});

describe('leaving the base', () => {
  test('without a 6 no token can leave the base', () => {
    const state = createGame({ players: [RED, YELLOW] });
    for (let dice = 1; dice <= 5; dice++) assert.deepEqual(legalMoves(state, dice), []);
  });

  test('a 6 lets any token in base leave', () => {
    assert.deepEqual(legalMoves(createGame({ players: [RED, YELLOW] }), 6), [0, 1, 2, 3]);
  });

  test('a token leaving the base is placed at progress 0, on its start cell', () => {
    for (const color of [RED, GREEN, YELLOW, BLUE]) {
      let state = createGame({ players: [RED, GREEN, YELLOW, BLUE] });
      state = { ...state, turn: color };
      state = applyRoll(state, 6);
      const before = state;
      state = applyMove(state, 2);
      assert.equal(state.tokens[color][2], 0);
      assert.equal(trackIndex(color, 0), START[color]);
      assert.deepEqual(newEvents(before, state)[0], { type: 'enter', player: color, token: 2 });
    }
  });
});

describe('moving', () => {
  test('a token on the track moves forward exactly the number rolled', () => {
    let state = stateWith({ tokens: { [RED]: [10, BASE, BASE, BASE] } });
    state = applyMove(applyRoll(state, 4), 0);
    assert.equal(state.tokens[RED][0], 14);
  });

  test('a roll is recorded as an event', () => {
    const state = applyRoll(stateWith({ tokens: { [RED]: [10, BASE, BASE, BASE] } }), 3);
    assert.equal(state.dice, 3);
    assert.equal(state.phase, 'move');
    assert.deepEqual(state.events.at(-1), { type: 'rolled', player: RED, value: 3 });
  });

  test('the input state is never mutated', () => {
    const start = deepFreeze(stateWith({ tokens: { [RED]: [10, BASE, BASE, BASE] } }));
    const rolled = deepFreeze(applyRoll(start, 6));
    assert.doesNotThrow(() => applyMove(rolled, 0));
    assert.equal(start.tokens[RED][0], 10);
    assert.equal(rolled.tokens[RED][0], 10);
  });

  test('an illegal move throws ILLEGAL_MOVE', () => {
    const state = applyRoll(stateWith({ tokens: { [RED]: [10, BASE, BASE, BASE] } }), 3);
    assert.throws(() => applyMove(state, 1), { code: 'ILLEGAL_MOVE' }); // token 1 is in base, no 6
    assert.throws(() => applyMove(state, 7), { code: 'ILLEGAL_MOVE' });
  });

  test('rolling or moving in the wrong phase throws', () => {
    const state = stateWith({ tokens: { [RED]: [10, BASE, BASE, BASE] } });
    assert.throws(() => applyMove(state, 0), { code: 'ILLEGAL_MOVE' }); // has not rolled
    assert.throws(() => applyRoll(applyRoll(state, 3), 3), { code: 'ILLEGAL_MOVE' }); // must move first
  });

  test('dice values outside 1..6 are rejected', () => {
    const state = createGame({ players: [RED, YELLOW] });
    // Values a client could send; the cast is the point of the test.
    for (const dice of [0, 7, 2.5, '3', null] as unknown as number[]) {
      assert.throws(() => applyRoll(state, dice), RangeError);
    }
  });
});

describe('capture', () => {
  test('landing on an opponent sends that token back to base and gives an extra turn', () => {
    let state = stateWith({
      tokens: { [RED]: [5, BASE, BASE, BASE], [YELLOW]: [progressAt(YELLOW, 7), BASE, BASE, BASE] },
    });
    state = applyRoll(state, 2);
    const before = state;
    state = applyMove(state, 0);
    assert.equal(state.tokens[RED][0], 7);
    assert.equal(state.tokens[YELLOW][0], BASE);
    assert.equal(state.turn, RED);
    assert.equal(state.phase, 'roll');
    assert.deepEqual(newEvents(before, state), [
      { type: 'capture', player: RED, victimColor: YELLOW, victimToken: 0 },
      { type: 'extraTurn', player: RED },
    ]);
  });

  test('every opponent token on the cell is captured', () => {
    const at7 = progressAt(YELLOW, 7);
    let state = stateWith({ tokens: { [RED]: [5, BASE, BASE, BASE], [YELLOW]: [at7, at7, 20, BASE] } });
    state = applyMove(applyRoll(state, 2), 0);
    assert.deepEqual(state.tokens[YELLOW], [BASE, BASE, 20, BASE]);
  });

  test('no capture on a star cell', () => {
    assert.ok(SAFE.has(8));
    let state = stateWith({
      tokens: { [RED]: [6, BASE, BASE, BASE], [YELLOW]: [progressAt(YELLOW, 8), BASE, BASE, BASE] },
    });
    state = applyMove(applyRoll(state, 2), 0);
    assert.equal(state.tokens[RED][0], 8);
    assert.equal(state.tokens[YELLOW][0], progressAt(YELLOW, 8));
    assert.equal(state.turn, YELLOW); // no capture, no 6 → turn passes
  });

  test("no capture on another color's start cell", () => {
    const greenStart = START[GREEN];
    let state = stateWith({
      players: [RED, GREEN],
      tokens: { [RED]: [greenStart - 3, BASE, BASE, BASE], [GREEN]: [0, BASE, BASE, BASE] },
    });
    state = applyMove(applyRoll(state, 3), 0);
    assert.equal(trackIndex(RED, state.tokens[RED][0]), greenStart);
    assert.equal(state.tokens[GREEN][0], 0);
  });

  test('your own tokens can share a cell', () => {
    let state = stateWith({ tokens: { [RED]: [5, 7, BASE, BASE] } });
    state = applyMove(applyRoll(state, 2), 0);
    assert.deepEqual(state.tokens[RED].slice(0, 2), [7, 7]);
  });

  test('tokens in the home column cannot be captured', () => {
    // Red at 51 (home column) is not on the shared track at all.
    let state = stateWith({
      turn: YELLOW,
      tokens: { [RED]: [51, BASE, BASE, BASE], [YELLOW]: [progressAt(YELLOW, 49), BASE, BASE, BASE] },
    });
    state = applyMove(applyRoll(state, 3), 0);
    assert.equal(state.tokens[RED][0], 51);
  });
});

describe('turns', () => {
  test('a 6 keeps the same player', () => {
    let state = stateWith({ tokens: { [RED]: [10, BASE, BASE, BASE] } });
    const before = applyRoll(state, 6);
    state = applyMove(before, 0);
    assert.equal(state.turn, RED);
    assert.equal(state.phase, 'roll');
    assert.deepEqual(newEvents(before, state).at(-1), { type: 'extraTurn', player: RED });
  });

  test('a normal move passes the turn clockwise', () => {
    let state = stateWith({ players: [RED, GREEN, YELLOW, BLUE], tokens: { [RED]: [10, BASE, BASE, BASE] } });
    state = applyMove(applyRoll(state, 3), 0);
    assert.equal(state.turn, GREEN);
    assert.equal(state.phase, 'roll');
  });

  test('in a 2-player game Red and Yellow alternate', () => {
    let state = stateWith({ tokens: { [RED]: [10, BASE, BASE, BASE], [YELLOW]: [10, BASE, BASE, BASE] } });
    state = applyMove(applyRoll(state, 3), 0);
    assert.equal(state.turn, YELLOW);
    state = applyMove(applyRoll(state, 3), 0);
    assert.equal(state.turn, RED);
  });

  test('with no legal move the turn passes automatically', () => {
    const before = createGame({ players: [RED, YELLOW] });
    const state = applyRoll(before, 3);
    assert.equal(state.turn, YELLOW);
    assert.equal(state.phase, 'roll');
    assert.deepEqual(newEvents(before, state), [
      { type: 'rolled', player: RED, value: 3 },
      { type: 'noMove', player: RED },
    ]);
  });

  test('a 6 with no legal move also passes the turn (extra turns need a move)', () => {
    const state = applyRoll(stateWith({ tokens: { [RED]: [55, GOAL, GOAL, GOAL] } }), 6);
    assert.equal(state.turn, YELLOW);
  });

  test('the last player wraps around to the first', () => {
    let state = stateWith({ players: [RED, GREEN, YELLOW, BLUE], turn: BLUE });
    state = applyRoll(state, 2);
    assert.equal(state.turn, RED);
  });
});

describe('home column and goal', () => {
  test('after progress 50 a token turns into its home column', () => {
    let state = stateWith({ tokens: { [RED]: [48, BASE, BASE, BASE] } });
    state = applyMove(applyRoll(state, 4), 0);
    assert.equal(state.tokens[RED][0], 52);
    assert.deepEqual(cellOf(RED, 52, 0), HOME_COLUMNS[RED][1]);
  });

  test('a token cannot overshoot the goal', () => {
    const state = stateWith({ tokens: { [RED]: [54, BASE, BASE, BASE] } });
    assert.deepEqual(legalMoves(state, 3), []);
    assert.deepEqual(legalMoves(state, 6), [1, 2, 3]); // only tokens in base can use the 6
  });

  test('an exact roll reaches the goal (56)', () => {
    let state = stateWith({ tokens: { [RED]: [54, BASE, BASE, BASE] } });
    const before = applyRoll(state, 2);
    state = applyMove(before, 0);
    assert.equal(state.tokens[RED][0], GOAL);
    assert.deepEqual(newEvents(before, state)[0], { type: 'goal', player: RED, token: 0 });
  });

  test('a token in the goal can never move again', () => {
    const state = stateWith({ tokens: { [RED]: [GOAL, BASE, BASE, BASE] } });
    assert.ok(!legalMoves(state, 6).includes(0));
  });

  test('4 tokens in the goal ends the game with a winner', () => {
    let state = stateWith({ tokens: { [RED]: [GOAL, GOAL, GOAL, 55] } });
    const before = applyRoll(state, 1);
    state = applyMove(before, 3);
    assert.equal(state.phase, 'over');
    assert.equal(state.winner, RED);
    assert.deepEqual(newEvents(before, state).at(-1), { type: 'win', player: RED });
  });

  test('the game ends immediately, even on a 6, and nothing more can happen', () => {
    let state = stateWith({ tokens: { [RED]: [GOAL, GOAL, GOAL, 50] } });
    state = applyMove(applyRoll(state, 6), 3);
    assert.equal(state.phase, 'over');
    assert.ok(!state.events.some((e) => e.type === 'extraTurn'));
    assert.throws(() => applyRoll(state, 3), { code: 'ILLEGAL_MOVE' });
  });
});

describe('cellOf()', () => {
  test('tokens in base sit in their own slot', () => {
    assert.deepEqual(cellOf(RED, BASE, 0), [2, 2]);
    assert.deepEqual(cellOf(GREEN, BASE, 3), [3, 12]);
    assert.deepEqual(cellOf(YELLOW, BASE, 1), [11, 12]);
    assert.deepEqual(cellOf(BLUE, BASE, 2), [12, 2]);
  });

  test('progress 0 is the start cell', () => {
    for (const color of [RED, GREEN, YELLOW, BLUE]) assert.deepEqual(cellOf(color, 0, 0), PATH[START[color]]);
  });

  test('for every color, progress 50 is the cell right before its home column', () => {
    const expected = { [RED]: [7, 0], [GREEN]: [0, 7], [YELLOW]: [7, 14], [BLUE]: [14, 7] };
    for (const color of [RED, GREEN, YELLOW, BLUE]) {
      const last = cellOf(color, LAST_TRACK, 0);
      const firstHome = cellOf(color, LAST_TRACK + 1, 0);
      assert.deepEqual(last, expected[color]);
      assert.deepEqual(firstHome, HOME_COLUMNS[color][0]);
      assert.equal(Math.abs(last[0] - firstHome[0]) + Math.abs(last[1] - firstHome[1]), 1);
    }
  });

  test('the home column leads to the goal cell', () => {
    for (const color of [RED, GREEN, YELLOW, BLUE]) {
      assert.deepEqual(cellOf(color, 55, 0), HOME_COLUMNS[color][4]);
      assert.deepEqual(cellOf(color, GOAL, 0), GOAL_CELLS[color]);
    }
  });
});

describe('simulation', () => {
  test('100 bot-only games with random dice all end, none gets stuck', () => {
    const random = mulberry32(12345);
    const rollDie = () => 1 + Math.floor(random() * 6);
    for (let game = 0; game < 100; game++) {
      const players: Color[] = game % 2 === 0 ? ALL_COLORS : [RED, YELLOW];
      let state = createGame({ players });
      let steps = 0;
      while (state.phase !== 'over') {
        state = state.phase === 'roll' ? applyRoll(state, rollDie()) : applyMove(state, chooseMove(state));
        assert.ok(++steps < 20000, `game ${game} is stuck`);
      }
      assert.ok(state.winner !== null && players.includes(state.winner));
      assert.deepEqual(state.tokens[state.winner], [GOAL, GOAL, GOAL, GOAL]);
    }
  });
});
