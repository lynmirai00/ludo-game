// Pure Ludo rules, shared by the browser and the server. See docs/01-game-rules.md.
// No DOM, no React, no randomness, no text: every function takes a state and returns a
// new one, and the game log is a list of structured events that the UI translates.

export const COLORS = ['red', 'green', 'yellow', 'blue'] as const;
export type ColorName = (typeof COLORS)[number];
/** Index into COLORS: 0 red, 1 green, 2 yellow, 3 blue. */
export type Color = 0 | 1 | 2 | 3;
export type TokenIndex = 0 | 1 | 2 | 3;
/** [row, col] on the 15x15 grid, zero-based. */
export type Cell = readonly [number, number];

// Token progress, relative to the token's own color.
export const BASE = -1;
export const LAST_TRACK = 50; // last cell on the shared track before the home column
export const GOAL = 56;
const TRACK_LENGTH = 52;

// Shared track, starting at Red's start cell, clockwise.
export const PATH: readonly Cell[] = [
  [6, 1], [6, 2], [6, 3], [6, 4], [6, 5], [5, 6], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6], [0, 7], [0, 8],
  [1, 8], [2, 8], [3, 8], [4, 8], [5, 8], [6, 9], [6, 10], [6, 11], [6, 12], [6, 13], [6, 14], [7, 14], [8, 14],
  [8, 13], [8, 12], [8, 11], [8, 10], [8, 9], [9, 8], [10, 8], [11, 8], [12, 8], [13, 8], [14, 8], [14, 7], [14, 6],
  [13, 6], [12, 6], [11, 6], [10, 6], [9, 6], [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0], [7, 0], [6, 0],
];

// Star cells (indices into PATH), including all four start cells. No captures here.
export const SAFE: ReadonlySet<number> = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

type PerColor<T> = readonly [T, T, T, T];

export const START: PerColor<number> = [0, 13, 26, 39];

export const BASE_SLOTS: PerColor<PerColor<Cell>> = [
  [[2, 2], [2, 3], [3, 2], [3, 3]],
  [[2, 11], [2, 12], [3, 11], [3, 12]],
  [[11, 11], [11, 12], [12, 11], [12, 12]],
  [[11, 2], [11, 3], [12, 2], [12, 3]],
];

export const HOME_COLUMNS: PerColor<readonly Cell[]> = [
  [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5]],
  [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]],
  [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9]],
  [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7]],
];

export const GOAL_CELLS: PerColor<Cell> = [[7, 6], [6, 7], [7, 8], [8, 7]];

export type TokenRow = [number, number, number, number];

export type GameEvent =
  | { type: 'rolled'; player: Color; value: number }
  | { type: 'noMove'; player: Color }
  | { type: 'enter'; player: Color; token: TokenIndex }
  | { type: 'capture'; player: Color; victimColor: Color; victimToken: TokenIndex }
  | { type: 'goal'; player: Color; token: TokenIndex }
  | { type: 'extraTurn'; player: Color }
  | { type: 'win'; player: Color };

export type Phase = 'roll' | 'move' | 'over';

/** Rule variants; all are off by default (none implemented yet). */
export type GameOptions = Record<string, never>;

export type GameState = {
  /** Colors in play, in clockwise turn order. */
  players: Color[];
  /** Progress of every token, for all 4 colors (unused colors stay in base). */
  tokens: [TokenRow, TokenRow, TokenRow, TokenRow];
  turn: Color;
  /** The last rolled value; the one to move with while phase is 'move'. */
  dice: number | null;
  phase: Phase;
  winner: Color | null;
  events: GameEvent[];
  options: GameOptions;
};

export class IllegalMoveError extends Error {
  readonly code = 'ILLEGAL_MOVE';
}

const TOKEN_INDICES: readonly TokenIndex[] = [0, 1, 2, 3];

function isColor(value: unknown): value is Color {
  return value === 0 || value === 1 || value === 2 || value === 3;
}

function isTokenIndex(value: unknown): value is TokenIndex {
  return value === 0 || value === 1 || value === 2 || value === 3;
}

function cellAt(cells: readonly Cell[], index: number): Cell {
  const cell = cells[index];
  if (!cell) throw new RangeError(`no cell at index ${index}`);
  return cell;
}

/** Index into PATH for a token on the shared track (progress 0..50), otherwise null. */
export function trackIndex(color: Color, progress: number): number | null {
  if (progress < 0 || progress > LAST_TRACK) return null;
  return (START[color] + progress) % TRACK_LENGTH;
}

/** [row, col] where a token should be drawn. */
export function cellOf(color: Color, progress: number, tokenIndex: TokenIndex): Cell {
  if (progress === BASE) return BASE_SLOTS[color][tokenIndex];
  if (progress <= LAST_TRACK) return cellAt(PATH, trackIndex(color, progress)!);
  if (progress < GOAL) return cellAt(HOME_COLUMNS[color], progress - LAST_TRACK - 1);
  return GOAL_CELLS[color];
}

/**
 * `players` is a list of 2 to 4 distinct colors; turn order is always clockwise.
 * `options` is reserved for rule variants, which are all off by default.
 */
export function createGame({ players, options = {} }: { players: readonly number[]; options?: GameOptions }): GameState {
  const valid =
    Array.isArray(players) &&
    players.length >= 2 &&
    players.length <= 4 &&
    new Set(players).size === players.length &&
    players.every(isColor);
  if (!valid) throw new RangeError('players must be 2 to 4 distinct colors (0..3)');

  const ordered = [...players].sort((a, b) => a - b) as Color[];
  const base = (): TokenRow => [BASE, BASE, BASE, BASE];
  return {
    players: ordered,
    tokens: [base(), base(), base(), base()],
    turn: ordered[0]!,
    dice: null,
    phase: 'roll',
    winner: null,
    events: [],
    options: { ...options },
  };
}

function nextPlayer(state: GameState): Color {
  const i = state.players.indexOf(state.turn);
  return state.players[(i + 1) % state.players.length]!;
}

function canMove(progress: number, dice: number): boolean {
  if (progress === BASE) return dice === 6;
  return progress + dice <= GOAL;
}

/** Token indices the current player can move with this dice value. */
export function legalMoves(state: GameState, diceValue: number): TokenIndex[] {
  if (state.phase === 'over') return [];
  const row = state.tokens[state.turn];
  return TOKEN_INDICES.filter((i) => canMove(row[i], diceValue));
}

/**
 * Records a roll. If no token can move, the turn passes straight away (even on a 6:
 * the extra turn from a 6 is only earned by actually moving).
 */
export function applyRoll(state: GameState, diceValue: number): GameState {
  if (!Number.isInteger(diceValue) || diceValue < 1 || diceValue > 6) {
    throw new RangeError('dice value must be an integer from 1 to 6');
  }
  if (state.phase !== 'roll') throw new IllegalMoveError(`cannot roll in phase "${state.phase}"`);

  const player = state.turn;
  const events: GameEvent[] = [...state.events, { type: 'rolled', player, value: diceValue }];
  if (legalMoves(state, diceValue).length > 0) {
    return { ...state, dice: diceValue, phase: 'move', events };
  }
  events.push({ type: 'noMove', player });
  return { ...state, dice: diceValue, phase: 'roll', turn: nextPlayer(state), events };
}

/**
 * Moves one of the current player's tokens by the rolled value. Handles leaving the
 * base, captures, reaching the goal, extra turns and the win. `tokenIndex` may come
 * from an untrusted client, so anything that is not a legal move throws ILLEGAL_MOVE.
 */
export function applyMove(state: GameState, tokenIndex: number): GameState {
  if (state.phase !== 'move' || state.dice === null) {
    throw new IllegalMoveError(`cannot move in phase "${state.phase}"`);
  }
  const dice = state.dice;
  if (!isTokenIndex(tokenIndex) || !legalMoves(state, dice).includes(tokenIndex)) {
    throw new IllegalMoveError(`token ${tokenIndex} cannot move`);
  }

  const player = state.turn;
  const tokens = state.tokens.map((row) => [...row]) as GameState['tokens'];
  const events = [...state.events];
  const from = tokens[player][tokenIndex];
  const to = from === BASE ? 0 : from + dice;
  tokens[player][tokenIndex] = to;

  if (from === BASE) events.push({ type: 'enter', player, token: tokenIndex });

  let captured = false;
  const landing = trackIndex(player, to);
  if (landing !== null && !SAFE.has(landing)) {
    for (const color of state.players) {
      if (color === player) continue;
      for (const i of TOKEN_INDICES) {
        if (trackIndex(color, tokens[color][i]) === landing) {
          tokens[color][i] = BASE;
          captured = true;
          events.push({ type: 'capture', player, victimColor: color, victimToken: i });
        }
      }
    }
  }

  if (to === GOAL) {
    events.push({ type: 'goal', player, token: tokenIndex });
    if (tokens[player].every((p) => p === GOAL)) {
      events.push({ type: 'win', player });
      return { ...state, tokens, events, phase: 'over', winner: player };
    }
  }

  if (dice === 6 || captured) {
    events.push({ type: 'extraTurn', player });
    return { ...state, tokens, events, phase: 'roll' };
  }
  return { ...state, tokens, events, phase: 'roll', turn: nextPlayer(state) };
}
