// Pure rules of Vietnamese "Cờ cá ngựa", shared by the browser and the server.
// See docs/01-game-rules.md. No DOM, no React, no randomness, no text: every function
// takes a state and returns a new one, and the game log is a list of structured
// events that the UI translates.

export const COLORS = ['red', 'green', 'yellow', 'blue'] as const;
export type ColorName = (typeof COLORS)[number];
/** Index into COLORS: 0 red, 1 green, 2 yellow, 3 blue. */
export type Color = 0 | 1 | 2 | 3;
export type TokenIndex = 0 | 1 | 2 | 3;
/** [row, col] on the 15x15 grid, zero-based. */
export type Cell = readonly [number, number];

// Token progress, relative to the token's own color:
// BASE, 0..LAST_TRACK on the shared track, then LAST_TRACK + 1..LAST_TRACK + TOP_STEP in the home column.
export const BASE = -1;
/** The home entrance: the last track cell before the home column. */
export const LAST_TRACK = 50;
export const TOP_STEP = 6;
/** A player has finished when all 4 tokens stand on these steps. */
const FINISH_STEPS = [3, 4, 5, 6];
const TRACK_LENGTH = 52;

// Shared track, starting at Red's start cell, clockwise.
export const PATH: readonly Cell[] = [
  [6, 1], [6, 2], [6, 3], [6, 4], [6, 5], [5, 6], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6], [0, 7], [0, 8],
  [1, 8], [2, 8], [3, 8], [4, 8], [5, 8], [6, 9], [6, 10], [6, 11], [6, 12], [6, 13], [6, 14], [7, 14], [8, 14],
  [8, 13], [8, 12], [8, 11], [8, 10], [8, 9], [9, 8], [10, 8], [11, 8], [12, 8], [13, 8], [14, 8], [14, 7], [14, 6],
  [13, 6], [12, 6], [11, 6], [10, 6], [9, 6], [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0], [7, 0], [6, 0],
];

type PerColor<T> = readonly [T, T, T, T];

export const START: PerColor<number> = [0, 13, 26, 39];

export const BASE_SLOTS: PerColor<PerColor<Cell>> = [
  [[2, 2], [2, 3], [3, 2], [3, 3]],
  [[2, 11], [2, 12], [3, 11], [3, 12]],
  [[11, 11], [11, 12], [12, 11], [12, 12]],
  [[11, 2], [11, 3], [12, 2], [12, 3]],
];

/** Steps 1 to 6 of each home column. */
export const HOME_COLUMNS: PerColor<readonly Cell[]> = [
  [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5], [7, 6]],
  [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7], [6, 7]],
  [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9], [7, 8]],
  [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7], [8, 7]],
];

export type TokenRow = [number, number, number, number];

export type GameEvent =
  | { type: 'rolled'; player: Color; value: number }
  | { type: 'noMove'; player: Color }
  | { type: 'enter'; player: Color; token: TokenIndex }
  | { type: 'capture'; player: Color; victimColor: Color; victimToken: TokenIndex }
  | { type: 'step'; player: Color; token: TokenIndex; step: number }
  | { type: 'extraTurn'; player: Color }
  | { type: 'finish'; player: Color; place: number };

export type Phase = 'roll' | 'move' | 'over';

export type GameState = {
  /** Colors in play, in clockwise turn order. */
  players: Color[];
  /** Progress of every token, for all 4 colors (unused colors stay in base). */
  tokens: [TokenRow, TokenRow, TokenRow, TokenRow];
  turn: Color;
  /** The last rolled value; the one to move with while phase is 'move'. */
  dice: number | null;
  phase: Phase;
  /** Colors in finishing order: ranking[0] placed 1st. Complete once phase is 'over'. */
  ranking: Color[];
  events: GameEvent[];
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

function grantsExtraRoll(dice: number): boolean {
  return dice === 1 || dice === 6;
}

/** Index into PATH for a token on the shared track (progress 0..50), otherwise null. */
export function trackIndex(color: Color, progress: number): number | null {
  if (progress < 0 || progress > LAST_TRACK) return null;
  return (START[color] + progress) % TRACK_LENGTH;
}

/** Home column step (1..6) for a progress value, otherwise null. */
export function homeStep(progress: number): number | null {
  return progress > LAST_TRACK ? progress - LAST_TRACK : null;
}

/** [row, col] where a token should be drawn. */
export function cellOf(color: Color, progress: number, tokenIndex: TokenIndex): Cell {
  if (progress === BASE) return BASE_SLOTS[color][tokenIndex];
  if (progress <= LAST_TRACK) return cellAt(PATH, trackIndex(color, progress)!);
  return cellAt(HOME_COLUMNS[color], progress - LAST_TRACK - 1);
}

/** `players` is a list of 2 to 4 distinct colors; turn order is always clockwise. */
export function createGame({ players }: { players: readonly number[] }): GameState {
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
    ranking: [],
    events: [],
  };
}

/** The token (of any player in the game) on shared track cell `index`, if any. */
function occupantAt(state: GameState, index: number): { color: Color; token: TokenIndex } | null {
  for (const color of state.players) {
    for (const token of TOKEN_INDICES) {
      if (trackIndex(color, state.tokens[color][token]) === index) return { color, token };
    }
  }
  return null;
}

function ownStepTaken(state: GameState, color: Color, step: number): boolean {
  return state.tokens[color].includes(LAST_TRACK + step);
}

/** Where the token would land with this dice value, or null if it cannot move. */
function destination(state: GameState, color: Color, token: TokenIndex, dice: number): number | null {
  const from = state.tokens[color][token];

  // Leave the base on a 1 or a 6, onto the start cell, unless an own token stands there.
  if (from === BASE) {
    if (!grantsExtraRoll(dice)) return null;
    return occupantAt(state, START[color])?.color === color ? null : 0;
  }

  // From the home entrance: straight to step N, if steps 1..N are free.
  if (from === LAST_TRACK) {
    for (let s = 1; s <= dice; s++) if (ownStepTaken(state, color, s)) return null;
    return LAST_TRACK + dice;
  }

  // In the home column: one step up, only with a roll of exactly the next step.
  const step = homeStep(from);
  if (step !== null) {
    if (step >= TOP_STEP || dice !== step + 1 || ownStepTaken(state, color, step + 1)) return null;
    return from + 1;
  }

  // On the track: must stop at the entrance at the latest, never pass over any token,
  // and never land on an own token.
  const to = from + dice;
  if (to > LAST_TRACK) return null;
  for (let p = from + 1; p < to; p++) {
    if (occupantAt(state, trackIndex(color, p)!)) return null;
  }
  return occupantAt(state, trackIndex(color, to)!)?.color === color ? null : to;
}

function isFinished(state: GameState, color: Color): boolean {
  return state.ranking.includes(color);
}

function hasFinishingSteps(row: TokenRow): boolean {
  return FINISH_STEPS.every((step) => row.includes(LAST_TRACK + step));
}

/** The next player clockwise who has not finished yet. */
function nextPlayer(state: GameState): Color {
  const i = state.players.indexOf(state.turn);
  for (let k = 1; k <= state.players.length; k++) {
    const color = state.players[(i + k) % state.players.length]!;
    if (!isFinished(state, color)) return color;
  }
  return state.turn;
}

/** Token indices the current player can move with this dice value. */
export function legalMoves(state: GameState, diceValue: number): TokenIndex[] {
  if (state.phase === 'over') return [];
  return TOKEN_INDICES.filter((token) => destination(state, state.turn, token, diceValue) !== null);
}

/**
 * Records a roll. If no token can move, a 1 or a 6 still gives another roll;
 * any other value passes the turn.
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
  if (grantsExtraRoll(diceValue)) {
    events.push({ type: 'extraTurn', player });
    return { ...state, dice: diceValue, phase: 'roll', events };
  }
  return { ...state, dice: diceValue, phase: 'roll', turn: nextPlayer(state), events };
}

/**
 * Moves one of the current player's tokens with the rolled value: leaving the base,
 * captures, climbing the home column, extra rolls, finishing and the end of the game.
 * `tokenIndex` may come from an untrusted client, so anything that is not a legal move
 * throws ILLEGAL_MOVE.
 */
export function applyMove(state: GameState, tokenIndex: number): GameState {
  if (state.phase !== 'move' || state.dice === null) {
    throw new IllegalMoveError(`cannot move in phase "${state.phase}"`);
  }
  const dice = state.dice;
  const player = state.turn;
  const to = isTokenIndex(tokenIndex) ? destination(state, player, tokenIndex, dice) : null;
  if (!isTokenIndex(tokenIndex) || to === null) throw new IllegalMoveError(`token ${tokenIndex} cannot move`);

  const tokens = state.tokens.map((row) => [...row]) as GameState['tokens'];
  const events = [...state.events];
  const from = tokens[player][tokenIndex];

  // Blocking guarantees at most one token per track cell, so at most one capture.
  const landing = trackIndex(player, to);
  const victim = landing === null ? null : occupantAt(state, landing);
  tokens[player][tokenIndex] = to;

  if (from === BASE) events.push({ type: 'enter', player, token: tokenIndex });
  if (victim && victim.color !== player) {
    tokens[victim.color][victim.token] = BASE;
    events.push({ type: 'capture', player, victimColor: victim.color, victimToken: victim.token });
  }
  const step = homeStep(to);
  if (step !== null) events.push({ type: 'step', player, token: tokenIndex, step });

  const next: GameState = { ...state, tokens, events, phase: 'roll' };

  if (hasFinishingSteps(tokens[player])) {
    const ranking = [...state.ranking, player];
    events.push({ type: 'finish', player, place: ranking.length });
    const left = state.players.filter((color) => !ranking.includes(color));
    if (left.length === 1) {
      const last = left[0]!;
      ranking.push(last);
      events.push({ type: 'finish', player: last, place: ranking.length });
      return { ...next, ranking, phase: 'over' };
    }
    // A finished player never rolls again, even after a 1 or a 6.
    return { ...next, ranking, turn: nextPlayer({ ...next, ranking }) };
  }

  if (grantsExtraRoll(dice)) {
    events.push({ type: 'extraTurn', player });
    return next;
  }
  return { ...next, turn: nextPlayer(next) };
}
