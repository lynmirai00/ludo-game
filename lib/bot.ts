// Bot move selection. Uses lib/game.ts to simulate each move, so it never
// re-implements the rules. Pure: no DOM, no timers, no randomness.
import { GOAL, LAST_TRACK, SAFE, applyMove, legalMoves, trackIndex, type GameState, type TokenIndex } from './game';

/**
 * Score for moving `tokenIndex` with the current dice (higher is better):
 * reach goal > capture > leave base > enter home column > land on a safe cell,
 * plus the new progress so that, all else equal, the token furthest ahead moves.
 */
export function scoreMove(state: GameState, tokenIndex: TokenIndex): number {
  const player = state.turn;
  const from = state.tokens[player][tokenIndex];
  const next = applyMove(state, tokenIndex);
  const to = next.tokens[player][tokenIndex];
  const newEvents = next.events.slice(state.events.length);

  let score = to;
  if (to === GOAL) score += 1000;
  if (newEvents.some((e) => e.type === 'capture')) score += 800;
  if (newEvents.some((e) => e.type === 'enter')) score += 500;
  if (from <= LAST_TRACK && to > LAST_TRACK && to < GOAL) score += 300;
  const landing = trackIndex(player, to);
  if (landing !== null && SAFE.has(landing)) score += 100;
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
