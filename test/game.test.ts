import { describe, expect, test } from 'vitest';
import {
  BASE,
  HOME_COLUMNS,
  LAST_TRACK,
  PATH,
  START,
  TOP_STEP,
  applyMove,
  applyRoll,
  cellOf,
  createGame,
  legalMoves,
  trackIndex,
  type Cell,
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

/** Progress value for home column step 1..6. */
const step = (n: number) => LAST_TRACK + n;

type Setup = { players?: Color[]; turn?: Color; tokens?: Partial<Record<Color, TokenRow>>; ranking?: Color[] };

// Builds a game where it is `turn`'s move, with the given token progress values.
function stateWith({ players = [RED, YELLOW], turn = RED, tokens = {}, ranking = [] }: Setup = {}): GameState {
  const state = createGame({ players });
  const all = state.tokens.map((row, color) => tokens[color as Color] ?? row) as GameState['tokens'];
  return { ...state, turn, tokens: all, ranking };
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

function adjacent([r1, c1]: Cell, [r2, c2]: Cell): boolean {
  return Math.abs(r1 - r2) + Math.abs(c1 - c2) === 1;
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
    expect(PATH).toHaveLength(52);
    expect(new Set(PATH.map(([r, c]) => `${r},${c}`)).size).toBe(52);
    for (const [r, c] of PATH) expect(r >= 0 && r < 15 && c >= 0 && c < 15).toBe(true);
  });

  test('consecutive track cells are adjacent, and the track is a closed loop', () => {
    for (let i = 0; i < 52; i++) {
      const [r1, c1] = PATH[i]!;
      const [r2, c2] = PATH[(i + 1) % 52]!;
      const dist = Math.abs(r1 - r2) + Math.abs(c1 - c2);
      // Corner turns into the arms are diagonal steps (e.g. [6,5] → [5,6]).
      expect(dist === 1 || (dist === 2 && r1 !== r2 && c1 !== c2), `step ${i}`).toBe(true);
    }
  });

  test('each home column has 6 adjacent steps, the 6th at the edge of the center', () => {
    const sixth: Cell[] = [[7, 6], [6, 7], [7, 8], [8, 7]];
    for (const color of ALL_COLORS) {
      const column = HOME_COLUMNS[color];
      expect(column).toHaveLength(TOP_STEP);
      for (let i = 1; i < column.length; i++) expect(adjacent(column[i - 1]!, column[i]!)).toBe(true);
      expect(column[5]).toEqual(sixth[color]);
    }
  });
});

describe('createGame()', () => {
  test('starts with every token in base, an empty ranking and the first player to roll', () => {
    const state = createGame({ players: [RED, YELLOW] });
    expect(state.players).toEqual([RED, YELLOW]);
    for (const row of state.tokens) expect(row).toEqual([BASE, BASE, BASE, BASE]);
    expect(state.turn).toBe(RED);
    expect(state.phase).toBe('roll');
    expect(state.dice).toBeNull();
    expect(state.ranking).toEqual([]);
    expect(state.events).toEqual([]);
  });

  test('puts players in clockwise order, with 2, 3 or 4 players', () => {
    expect(createGame({ players: [BLUE, RED, YELLOW, GREEN] }).players).toEqual([RED, GREEN, YELLOW, BLUE]);
    expect(createGame({ players: [YELLOW, RED, GREEN] }).players).toEqual([RED, GREEN, YELLOW]);
  });

  test('rejects invalid player lists', () => {
    expect(() => createGame({ players: [RED] })).toThrow(RangeError);
    expect(() => createGame({ players: [RED, RED] })).toThrow(RangeError);
    expect(() => createGame({ players: [RED, 4] })).toThrow(RangeError);
    expect(() => createGame({ players: [RED, GREEN, YELLOW, BLUE, RED] })).toThrow(RangeError);
  });
});

describe('leaving the base', () => {
  test('only a 1 or a 6 lets a token leave the base', () => {
    const state = createGame({ players: [RED, YELLOW] });
    expect(legalMoves(state, 1)).toEqual([0, 1, 2, 3]);
    expect(legalMoves(state, 6)).toEqual([0, 1, 2, 3]);
    for (const dice of [2, 3, 4, 5]) expect(legalMoves(state, dice)).toEqual([]);
  });

  test('the token is placed on its start cell (progress 0) and does not move further', () => {
    for (const color of ALL_COLORS) {
      for (const dice of [1, 6]) {
        const before = applyRoll(stateWith({ players: ALL_COLORS, turn: color }), dice);
        const after = applyMove(before, 2);
        expect(after.tokens[color][2]).toBe(0);
        expect(trackIndex(color, 0)).toBe(START[color]);
        expect(newEvents(before, after)[0]).toEqual({ type: 'enter', player: color, token: 2 });
      }
    }
  });

  test('not allowed while a token of the same color is on the start cell', () => {
    const state = stateWith({ tokens: { [RED]: [0, BASE, BASE, BASE] } });
    expect(legalMoves(state, 6)).toEqual([0]);
  });

  test("captures an opponent standing on the start cell", () => {
    const before = applyRoll(stateWith({ tokens: { [YELLOW]: [progressAt(YELLOW, START[RED]), BASE, BASE, BASE] } }), 1);
    const after = applyMove(before, 0);
    expect(after.tokens[RED][0]).toBe(0);
    expect(after.tokens[YELLOW][0]).toBe(BASE);
    expect(newEvents(before, after)).toContainEqual({ type: 'capture', player: RED, victimColor: YELLOW, victimToken: 0 });
  });
});

describe('moving and blocking', () => {
  test('a token moves forward exactly the number rolled', () => {
    const state = applyMove(applyRoll(stateWith({ tokens: { [RED]: [10, BASE, BASE, BASE] } }), 4), 0);
    expect(state.tokens[RED][0]).toBe(14);
  });

  test('a roll is recorded as an event, and a legal move must be made before rolling again', () => {
    const state = applyRoll(stateWith({ tokens: { [RED]: [10, BASE, BASE, BASE] } }), 3);
    expect(state.dice).toBe(3);
    expect(state.phase).toBe('move');
    expect(state.events.at(-1)).toEqual({ type: 'rolled', player: RED, value: 3 });
    expect(() => applyRoll(state, 3)).toThrow(expect.objectContaining({ code: 'ILLEGAL_MOVE' }));
  });

  test("cannot pass over an opponent's token", () => {
    const state = stateWith({ tokens: { [RED]: [10, BASE, BASE, BASE], [YELLOW]: [progressAt(YELLOW, 12), BASE, BASE, BASE] } });
    expect(legalMoves(state, 1)).toContain(0); // 11: before the blocker
    expect(legalMoves(state, 2)).toContain(0); // 12: lands on it (capture)
    expect(legalMoves(state, 3)).not.toContain(0); // 13: would pass over it
    expect(legalMoves(state, 5)).not.toContain(0);
  });

  test('cannot pass over or land on its own token', () => {
    const state = stateWith({ tokens: { [RED]: [10, 12, BASE, BASE] } });
    expect(legalMoves(state, 1)).toContain(0);
    expect(legalMoves(state, 2)).not.toContain(0); // lands on own token
    expect(legalMoves(state, 4)).not.toContain(0); // passes over own token
    expect(legalMoves(state, 4)).toContain(1);
  });

  test('the input state is never mutated', () => {
    const start = deepFreeze(stateWith({ tokens: { [RED]: [10, BASE, BASE, BASE] } }));
    const rolled = deepFreeze(applyRoll(start, 6));
    expect(() => applyMove(rolled, 0)).not.toThrow();
    expect(start.tokens[RED][0]).toBe(10);
    expect(rolled.tokens[RED][0]).toBe(10);
  });

  test('an illegal move throws ILLEGAL_MOVE', () => {
    const state = applyRoll(stateWith({ tokens: { [RED]: [10, BASE, BASE, BASE] } }), 3);
    for (const token of [1, 7, -1, 0.5]) {
      expect(() => applyMove(state, token)).toThrow(expect.objectContaining({ code: 'ILLEGAL_MOVE' }));
    }
  });

  test('moving before rolling throws ILLEGAL_MOVE', () => {
    const state = stateWith({ tokens: { [RED]: [10, BASE, BASE, BASE] } });
    expect(() => applyMove(state, 0)).toThrow(expect.objectContaining({ code: 'ILLEGAL_MOVE' }));
  });

  test('dice values outside 1..6 are rejected', () => {
    const state = createGame({ players: [RED, YELLOW] });
    // Values a client could send; the cast is the point of the test.
    for (const dice of [0, 7, 2.5, '3', null] as unknown as number[]) {
      expect(() => applyRoll(state, dice)).toThrow(RangeError);
    }
  });
});

describe('capture', () => {
  test('landing on an opponent sends it back to base, without an extra roll', () => {
    const before = applyRoll(
      stateWith({ tokens: { [RED]: [5, BASE, BASE, BASE], [YELLOW]: [progressAt(YELLOW, 8), BASE, BASE, BASE] } }),
      3,
    );
    const after = applyMove(before, 0);
    expect(after.tokens[RED][0]).toBe(8);
    expect(after.tokens[YELLOW][0]).toBe(BASE);
    expect(after.turn).toBe(YELLOW);
    expect(newEvents(before, after)).toEqual([{ type: 'capture', player: RED, victimColor: YELLOW, victimToken: 0 }]);
  });

  test("there are no safe cells: a token on its own start cell can be captured", () => {
    const greenStart = START[GREEN];
    const state = stateWith({
      players: [RED, GREEN],
      tokens: { [RED]: [greenStart - 3, BASE, BASE, BASE], [GREEN]: [0, BASE, BASE, BASE] },
    });
    const after = applyMove(applyRoll(state, 3), 0);
    expect(trackIndex(RED, after.tokens[RED][0])).toBe(greenStart);
    expect(after.tokens[GREEN][0]).toBe(BASE);
  });

  test('tokens in a home column are not on the track and cannot be captured', () => {
    expect(trackIndex(RED, step(1))).toBeNull();
    const state = stateWith({
      turn: YELLOW,
      tokens: { [RED]: [step(1), BASE, BASE, BASE], [YELLOW]: [progressAt(YELLOW, 49), BASE, BASE, BASE] },
    });
    const after = applyMove(applyRoll(state, 2), 0);
    expect(after.tokens[RED][0]).toBe(step(1));
  });
});

describe('turns', () => {
  test('a 1 or a 6 gives another roll', () => {
    for (const dice of [1, 6]) {
      const before = applyRoll(stateWith({ tokens: { [RED]: [10, BASE, BASE, BASE] } }), dice);
      const after = applyMove(before, 0);
      expect(after.turn).toBe(RED);
      expect(after.phase).toBe('roll');
      expect(newEvents(before, after).at(-1)).toEqual({ type: 'extraTurn', player: RED });
    }
  });

  test('a 1 or a 6 gives another roll even when no token can move', () => {
    // Steps 1-3 are taken and the entrance token needs steps 1..6 free for a 6.
    const before = stateWith({ tokens: { [RED]: [step(1), step(2), step(3), LAST_TRACK] } });
    const after = applyRoll(before, 6);
    expect(after.turn).toBe(RED);
    expect(after.phase).toBe('roll');
    expect(newEvents(before, after)).toEqual([
      { type: 'rolled', player: RED, value: 6 },
      { type: 'noMove', player: RED },
      { type: 'extraTurn', player: RED },
    ]);
  });

  test('any other roll with no legal move passes the turn', () => {
    const before = createGame({ players: [RED, YELLOW] });
    const after = applyRoll(before, 3);
    expect(after.turn).toBe(YELLOW);
    expect(newEvents(before, after)).toEqual([
      { type: 'rolled', player: RED, value: 3 },
      { type: 'noMove', player: RED },
    ]);
  });

  test('a normal move passes the turn clockwise, with 2, 3 and 4 players', () => {
    const orders: [Color[], Color[]][] = [
      [[RED, YELLOW], [YELLOW, RED]],
      [[RED, GREEN, YELLOW], [GREEN, YELLOW, RED]],
      [ALL_COLORS, [GREEN, YELLOW, BLUE, RED]],
    ];
    for (const [players, expected] of orders) {
      let state = stateWith({ players });
      const seen: Color[] = [];
      for (let i = 0; i < players.length; i++) {
        state = applyRoll(state, 3); // nobody can leave the base on a 3
        seen.push(state.turn);
      }
      expect(seen).toEqual(expected);
    }
  });
});

describe('home entrance and home column', () => {
  test('a token must stop exactly on its home entrance', () => {
    // The other tokens are on the track (not in base) so nothing else affects token 0.
    const state = stateWith({ tokens: { [RED]: [48, 10, 20, 30] } });
    expect(legalMoves(state, 2)).toContain(0); // 50: the entrance
    expect(legalMoves(state, 3)).not.toContain(0); // would pass the entrance
    expect(legalMoves(state, 5)).not.toContain(0);
  });

  test('from the entrance a roll of N goes straight to step N when steps 1..N are free', () => {
    const before = applyRoll(stateWith({ tokens: { [RED]: [LAST_TRACK, BASE, BASE, BASE] } }), 4);
    const after = applyMove(before, 0);
    expect(after.tokens[RED][0]).toBe(step(4));
    expect(newEvents(before, after)).toContainEqual({ type: 'step', player: RED, token: 0, step: 4 });
  });

  test('from the entrance, own tokens on the way or on step N block the move', () => {
    const state = stateWith({ tokens: { [RED]: [LAST_TRACK, step(2), BASE, BASE] } });
    expect(legalMoves(state, 1)).toContain(0);
    expect(legalMoves(state, 2)).not.toContain(0); // step 2 is taken
    expect(legalMoves(state, 4)).not.toContain(0); // would pass step 2
  });

  test('from step S only a roll of S + 1 climbs one step, if it is free', () => {
    const state = stateWith({ tokens: { [RED]: [step(3), BASE, BASE, BASE] } });
    expect(legalMoves(state, 4)).toEqual([0]);
    for (const dice of [1, 2, 3, 5, 6]) expect(legalMoves(state, dice)).not.toContain(0);
    expect(applyMove(applyRoll(state, 4), 0).tokens[RED][0]).toBe(step(4));

    const blocked = stateWith({ tokens: { [RED]: [step(3), step(4), BASE, BASE] } });
    expect(legalMoves(blocked, 4)).not.toContain(0);
  });

  test('a token on step 6 never moves again', () => {
    const state = stateWith({ tokens: { [RED]: [step(6), BASE, BASE, BASE] } });
    for (let dice = 1; dice <= 6; dice++) expect(legalMoves(state, dice)).not.toContain(0);
  });
});

describe('finishing and ranking', () => {
  test('4 tokens on steps 3-6 finish the player; in a 2-player game the other takes 2nd and the game ends', () => {
    const before = applyRoll(stateWith({ tokens: { [RED]: [step(2), step(4), step(5), step(6)] } }), 3);
    const after = applyMove(before, 0);
    expect(after.ranking).toEqual([RED, YELLOW]);
    expect(after.phase).toBe('over');
    expect(newEvents(before, after)).toEqual([
      { type: 'step', player: RED, token: 0, step: 3 },
      { type: 'finish', player: RED, place: 1 },
      { type: 'finish', player: YELLOW, place: 2 },
    ]);
    expect(() => applyRoll(after, 3)).toThrow(expect.objectContaining({ code: 'ILLEGAL_MOVE' }));
  });

  test('in a 4-player game play continues and finished players are skipped', () => {
    let state = applyMove(
      applyRoll(stateWith({ players: ALL_COLORS, tokens: { [RED]: [step(2), step(4), step(5), step(6)] } }), 3),
      0,
    );
    expect(state.ranking).toEqual([RED]);
    expect(state.phase).toBe('roll');
    expect(state.turn).toBe(GREEN);
    state = applyRoll(state, 3); // Green: no move
    state = applyRoll(state, 3); // Yellow: no move
    state = applyRoll(state, 3); // Blue: no move
    expect(state.turn).toBe(GREEN); // Red is skipped
  });

  test('the next finisher takes the next place, and the last one left takes the last place', () => {
    const finishing: TokenRow = [step(2), step(4), step(5), step(6)];
    let state = stateWith({ players: [RED, GREEN, YELLOW], turn: YELLOW, ranking: [GREEN], tokens: { [YELLOW]: finishing } });
    const before = applyRoll(state, 3);
    state = applyMove(before, 0);
    expect(state.ranking).toEqual([GREEN, YELLOW, RED]);
    expect(state.phase).toBe('over');
    expect(newEvents(before, state).slice(-2)).toEqual([
      { type: 'finish', player: YELLOW, place: 2 },
      { type: 'finish', player: RED, place: 3 },
    ]);
  });
});

describe('cellOf()', () => {
  test('tokens in base sit in their own slot', () => {
    expect(cellOf(RED, BASE, 0)).toEqual([2, 2]);
    expect(cellOf(GREEN, BASE, 3)).toEqual([3, 12]);
    expect(cellOf(YELLOW, BASE, 1)).toEqual([11, 12]);
    expect(cellOf(BLUE, BASE, 2)).toEqual([12, 2]);
  });

  test('progress 0 is the start cell', () => {
    for (const color of ALL_COLORS) expect(cellOf(color, 0, 0)).toEqual(PATH[START[color]]);
  });

  test('for every color, progress 50 is the cell right before step 1 of its home column', () => {
    const expected: Record<Color, Cell> = { [RED]: [7, 0], [GREEN]: [0, 7], [YELLOW]: [7, 14], [BLUE]: [14, 7] };
    for (const color of ALL_COLORS) {
      expect(cellOf(color, LAST_TRACK, 0)).toEqual(expected[color]);
      expect(cellOf(color, step(1), 0)).toEqual(HOME_COLUMNS[color][0]);
      expect(adjacent(cellOf(color, LAST_TRACK, 0), cellOf(color, step(1), 0))).toBe(true);
    }
  });

  test('steps 1-6 map to the home column cells', () => {
    for (const color of ALL_COLORS) {
      for (let n = 1; n <= 6; n++) expect(cellOf(color, step(n), 0)).toEqual(HOME_COLUMNS[color][n - 1]);
    }
  });
});

describe('simulation', () => {
  test('100 bot-only games with 2, 3 and 4 players all end with a full ranking', () => {
    const random = mulberry32(12345);
    const rollDie = () => 1 + Math.floor(random() * 6);
    const setups: Color[][] = [[RED, YELLOW], [RED, GREEN, YELLOW], ALL_COLORS];
    for (let game = 0; game < 100; game++) {
      const players = setups[game % 3]!;
      let state = createGame({ players });
      let steps = 0;
      while (state.phase !== 'over') {
        state = state.phase === 'roll' ? applyRoll(state, rollDie()) : applyMove(state, chooseMove(state));
        expect(++steps < 50000, `game ${game} is stuck`).toBe(true);
      }
      expect([...state.ranking].sort()).toEqual([...players].sort());
      for (const color of state.ranking.slice(0, -1)) {
        expect([...state.tokens[color]].sort()).toEqual([step(3), step(4), step(5), step(6)]);
      }
    }
  });
});
