// Bot move selection. Uses lib/game.ts to simulate each move, so it never
// re-implements the rules. Pure: no DOM, no timers, no randomness.
import {
  LAST_TRACK,
  applyAction,
  applyMove,
  homeStep,
  legalMoves,
  type Action,
  type Color,
  type GameState,
  type TokenIndex,
} from './game';

/**
 * Score for moving `tokenIndex` with the current dice (higher is better):
 * climb or enter the home column > capture > leave base > stop on the home entrance,
 * plus the new progress so that, all else equal, the token furthest ahead moves.
 */
export function scoreMove(state: GameState, tokenIndex: TokenIndex): number {
  const player = state.turn;
  const from = state.tokens[player][tokenIndex];
  const next = applyMove(state, tokenIndex);
  const to = next.tokens[player][tokenIndex];
  const newEvents = next.events.slice(state.events.length);

  let score = to;
  const step = homeStep(to);
  if (step !== null) score += 1000 + step;
  if (newEvents.some((e) => e.type === 'capture')) score += 800;
  if (newEvents.some((e) => e.type === 'enter')) score += 500;
  if (to === LAST_TRACK && from !== LAST_TRACK) score += 300;
  return score;
}

/** Best token for the current player. The state must be in the 'move' phase. */
export function chooseMove(state: GameState): TokenIndex {
  if (state.phase !== 'move' || state.dice === null) throw new Error('chooseMove() needs a state in the move phase');
  let best: TokenIndex | null = null;
  let bestScore = -Infinity;
  for (const tokenIndex of legalMoves(state, state.dice)) {
    const score = scoreMove(state, tokenIndex);
    if (score > bestScore) {
      best = tokenIndex;
      bestScore = score;
    }
  }
  if (best === null) throw new Error('chooseMove() found no legal move');
  return best;
}

/**
 * Plays the bots (every player except `human`) until it is the human's turn to roll, or the
 * game is over. Once the human has finished, that means playing out the remaining places.
 * Used by the server (phase 4); `rollDie` is injected so this stays pure and testable.
 */
export function playBots(
  start: GameState,
  human: Color,
  rollDie: () => number,
): { state: GameState; actions: Action[] } {
  let state = start;
  const actions: Action[] = [];
  // Every game ends (see the simulation tests); the cap only guards against a rules bug.
  for (let step = 0; state.phase !== 'over' && state.turn !== human; step++) {
    if (step > 20_000) throw new Error('playBots: the game does not end');
    const action: Action = state.phase === 'roll' ? { roll: rollDie() } : { move: chooseMove(state) };
    state = applyAction(state, action);
    actions.push(action);
  }
  return { state, actions };
}
