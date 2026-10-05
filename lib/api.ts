// Shapes and limits shared by the API route handlers and the browser. Pure: no server or browser code.

export const LOCALES = ['en', 'vi', 'ja'] as const;
export type Locale = (typeof LOCALES)[number];

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/** GET /api/me */
export type Me = { id: string; name: string; wins: number; games: number; locale: Locale | null };

/** POST /api/games body: the human's result, sent once their place is decided. */
export type GameResult = { place: number; players: number; rolls: number };

/** GET /api/me/games: one of the player's own saved results. */
export type GameRecord = GameResult & { finishedAt: string };

/** How many results GET /api/me/games returns. */
export const HISTORY_SIZE = 20;

/** Upper bound for `rolls`, only to reject nonsense; real games need far fewer. */
export const MAX_ROLLS = 10_000;

export function isGameResult(value: unknown): value is GameResult {
  if (!value || typeof value !== 'object') return false;
  const { place, players, rolls } = value as Record<string, unknown>;
  return (
    Number.isInteger(players) &&
    Number.isInteger(place) &&
    Number.isInteger(rolls) &&
    (players as number) >= 2 &&
    (players as number) <= 4 &&
    (place as number) >= 1 &&
    (place as number) <= (players as number) &&
    (rolls as number) >= 1 &&
    (rolls as number) <= MAX_ROLLS
  );
}

export const PLAYER_COUNTS = [2, 3, 4] as const;
export type PlayerCount = (typeof PLAYER_COUNTS)[number];

/** GET /api/leaderboard */
export type Leaderboards = {
  mostWins: { name: string; wins: number; games: number }[];
  fastestWins: Record<`${PlayerCount}`, { name: string; rolls: number; finishedAt: string }[]>;
};

/** Error body of every API error: a stable code that the browser translates. */
export type ApiErrorBody = { error: { code: string } };
