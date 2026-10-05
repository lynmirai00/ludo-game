// Shapes and limits shared by the API route handlers and the browser. Pure: no server or browser code.
import type { Action } from './game';

export const LOCALES = ['en', 'vi', 'ja'] as const;
export type Locale = (typeof LOCALES)[number];

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/** GET /api/me */
export type Me = {
  id: string;
  name: string;
  wins: number;
  games: number;
  locale: Locale | null;
  /** From the verified token's roles; only tells the UI what to show, the server still checks. */
  admin: boolean;
};

/** A saved result: the human's place, the number of players and the human's own roll count. */
export type GameResult = { place: number; players: number; rolls: number };

/** GET /api/me/games: one of the player's own saved results. `matchId` is null for results saved before phase 4. */
export type GameRecord = GameResult & { finishedAt: string; matchId: string | null };

/** How many results GET /api/me/games returns. */
export const HISTORY_SIZE = 20;

export const PLAYER_COUNTS = [2, 3, 4] as const;
export type PlayerCount = (typeof PLAYER_COUNTS)[number];

export function isPlayerCount(value: unknown): value is PlayerCount {
  return (PLAYER_COUNTS as readonly unknown[]).includes(value);
}

/** Seats by number of players (docs/01-game-rules.md); the human is always Red (0). */
export const SEATS: Record<PlayerCount, number[]> = { 2: [0, 2], 3: [0, 1, 2], 4: [0, 1, 2, 3] };
export const HUMAN = 0;

/** A match as the API returns it: the browser rebuilds the state with replay(SEATS[players], actions). */
export type MatchView = {
  id: string;
  players: PlayerCount;
  actions: Action[];
  status: 'active' | 'finished' | 'abandoned';
};

/** POST /api/matches/:id/roll and /move: only the actions added by this request. */
export type ActionsResponse = { actions: Action[]; actionCount: number };

/** GET /api/leaderboard */
export type Leaderboards = {
  mostWins: { name: string; wins: number; games: number }[];
  fastestWins: Record<`${PlayerCount}`, { name: string; rolls: number; finishedAt: string }[]>;
};

/** Error body of every API error: a stable code that the browser translates. */
export type ApiErrorBody = { error: { code: string } };
