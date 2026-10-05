import 'server-only';
import type { Client, Row } from '@libsql/client';
import { HISTORY_SIZE, PLAYER_COUNTS, type GameRecord, type GameResult, type Leaderboards, type Locale, type Me } from '@/lib/api';
import type { Action } from '@/lib/game';

// Schema from docs/02-zitadel.md. Timestamps are ISO 8601 text (SQLite has no date type).
const SCHEMA = `
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS players (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  locale     TEXT CHECK (locale IN ('en', 'vi', 'ja')),
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS matches (
  id           TEXT PRIMARY KEY,
  player_id    TEXT NOT NULL REFERENCES players(id),
  players      INTEGER NOT NULL CHECK (players BETWEEN 2 AND 4),
  actions      TEXT NOT NULL,
  action_count INTEGER NOT NULL,
  status       TEXT NOT NULL CHECK (status IN ('active', 'finished', 'abandoned')),
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS matches_player ON matches(player_id, status, updated_at);
CREATE TABLE IF NOT EXISTS games (
  id          INTEGER PRIMARY KEY,
  player_id   TEXT NOT NULL REFERENCES players(id),
  place       INTEGER NOT NULL CHECK (place BETWEEN 1 AND 4),
  players     INTEGER NOT NULL CHECK (players BETWEEN 2 AND 4),
  rolls       INTEGER NOT NULL CHECK (rolls >= 1),
  finished_at TEXT NOT NULL,
  match_id    TEXT REFERENCES matches(id),
  CHECK (place <= players)
);
CREATE INDEX IF NOT EXISTS games_player_id ON games(player_id);
CREATE INDEX IF NOT EXISTS games_fastest ON games(players, place, rolls);
`;

const TOP = 10;
/** At most this many active matches per player; starting another abandons the oldest. */
export const MAX_ACTIVE_MATCHES = 3;

export type MatchStatus = 'active' | 'finished' | 'abandoned';

export type MatchRow = {
  id: string;
  playerId: string;
  players: number;
  actions: Action[];
  actionCount: number;
  status: MatchStatus;
};

export type MatchUpdate = {
  id: string;
  /** action_count read before the update; the write fails if it changed meanwhile. */
  expectedCount: number;
  actions: Action[];
  status: MatchStatus;
  /** The human's result, when their place was decided by this update. */
  result?: GameResult;
};

export type Db = {
  /** Creates the player or refreshes their name. */
  upsertPlayer(player: { id: string; name: string }, now: Date): Promise<void>;
  hasPlayer(id: string): Promise<boolean>;
  getMe(id: string): Promise<Me | null>;
  setLocale(id: string, locale: Locale): Promise<void>;
  /** Inserts a result directly (only used to seed tests; the API records results through saveMatch). */
  addGame(playerId: string, result: GameResult, finishedAt: Date, matchId?: string): Promise<void>;
  /** The player's most recent results, newest first. */
  listGames(playerId: string): Promise<GameRecord[]>;
  leaderboards(): Promise<Leaderboards>;
  /** Starts a match, abandoning the player's oldest active ones beyond MAX_ACTIVE_MATCHES. */
  createMatch(match: { id: string; playerId: string; players: number }, now: Date): Promise<MatchRow>;
  getMatch(id: string): Promise<MatchRow | null>;
  /** The player's most recently played active match. */
  currentMatch(playerId: string): Promise<MatchRow | null>;
  /**
   * Saves new actions (and the human's result, if any) in one transaction.
   * Returns false, changing nothing, if the match was updated since it was read.
   */
  saveMatch(update: MatchUpdate, now: Date): Promise<boolean>;
};

const num = (row: Row, column: string) => Number(row[column] ?? 0);
const str = (row: Row, column: string) => String(row[column] ?? '');

function toMatch(row: Row): MatchRow {
  return {
    id: str(row, 'id'),
    playerId: str(row, 'player_id'),
    players: num(row, 'players'),
    actions: JSON.parse(str(row, 'actions')) as Action[],
    actionCount: num(row, 'action_count'),
    status: str(row, 'status') as MatchStatus,
  };
}

export function createDb(client: Client): Db {
  let ready: Promise<void> | null = null;

  // Create tables once per server instance, on first use, and upgrade databases created before phase 4.
  async function setUp() {
    await client.executeMultiple(SCHEMA);
    const { rows } = await client.execute('PRAGMA table_info(games)');
    if (!rows.some((row) => row.name === 'match_id')) {
      await client.execute('ALTER TABLE games ADD COLUMN match_id TEXT REFERENCES matches(id)');
    }
  }
  const init = () => (ready ??= setUp());

  return {
    async upsertPlayer({ id, name }, now) {
      await init();
      await client.execute({
        sql: `INSERT INTO players (id, name, locale, created_at) VALUES (?, ?, NULL, ?)
              ON CONFLICT(id) DO UPDATE SET name = excluded.name`,
        args: [id, name, now.toISOString()],
      });
    },

    async hasPlayer(id) {
      await init();
      const { rows } = await client.execute({ sql: 'SELECT 1 FROM players WHERE id = ?', args: [id] });
      return rows.length > 0;
    },

    async getMe(id) {
      await init();
      const { rows } = await client.execute({
        sql: `SELECT p.id, p.name, p.locale,
                     COALESCE(SUM(g.place = 1), 0) AS wins, COUNT(g.id) AS games
              FROM players p LEFT JOIN games g ON g.player_id = p.id
              WHERE p.id = ? GROUP BY p.id`,
        args: [id],
      });
      const row = rows[0];
      if (!row) return null;
      return {
        id: str(row, 'id'),
        name: str(row, 'name'),
        locale: (row.locale as Locale | null) ?? null,
        wins: num(row, 'wins'),
        games: num(row, 'games'),
      };
    },

    async setLocale(id, locale) {
      await init();
      await client.execute({ sql: 'UPDATE players SET locale = ? WHERE id = ?', args: [locale, id] });
    },

    async addGame(playerId, { place, players, rolls }, finishedAt, matchId) {
      await init();
      await client.execute({
        sql: 'INSERT INTO games (player_id, place, players, rolls, finished_at, match_id) VALUES (?, ?, ?, ?, ?, ?)',
        args: [playerId, place, players, rolls, finishedAt.toISOString(), matchId ?? null],
      });
    },

    async listGames(playerId) {
      await init();
      const { rows } = await client.execute({
        sql: `SELECT place, players, rolls, finished_at, match_id FROM games
              WHERE player_id = ? ORDER BY finished_at DESC, id DESC LIMIT ?`,
        args: [playerId, HISTORY_SIZE],
      });
      return rows.map((row) => ({
        place: num(row, 'place'),
        players: num(row, 'players'),
        rolls: num(row, 'rolls'),
        finishedAt: str(row, 'finished_at'),
        matchId: row.match_id === null ? null : str(row, 'match_id'),
      }));
    },

    async leaderboards() {
      await init();
      // Most wins: games finished 1st; ties go to fewer games played.
      const mostWins = await client.execute({
        sql: `SELECT p.name, SUM(g.place = 1) AS wins, COUNT(*) AS games
              FROM games g JOIN players p ON p.id = g.player_id
              GROUP BY g.player_id HAVING wins > 0
              ORDER BY wins DESC, games ASC, p.id ASC LIMIT ?`,
        args: [TOP],
      });

      // Fastest wins, per player count: each player's best (fewest rolls) win; ties go to whoever got there first.
      const fastestWins = {} as Leaderboards['fastestWins'];
      for (const players of PLAYER_COUNTS) {
        const { rows } = await client.execute({
          sql: `SELECT p.name, g.rolls, g.finished_at
                FROM games g JOIN players p ON p.id = g.player_id
                WHERE g.players = ? AND g.place = 1
                  AND g.id = (SELECT b.id FROM games b
                              WHERE b.player_id = g.player_id AND b.players = g.players AND b.place = 1
                              ORDER BY b.rolls ASC, b.finished_at ASC, b.id ASC LIMIT 1)
                ORDER BY g.rolls ASC, g.finished_at ASC LIMIT ?`,
          args: [players, TOP],
        });
        fastestWins[`${players}`] = rows.map((row) => ({
          name: str(row, 'name'),
          rolls: num(row, 'rolls'),
          finishedAt: str(row, 'finished_at'),
        }));
      }

      return {
        mostWins: mostWins.rows.map((row) => ({ name: str(row, 'name'), wins: num(row, 'wins'), games: num(row, 'games') })),
        fastestWins,
      };
    },

    async createMatch({ id, playerId, players }, now) {
      await init();
      const at = now.toISOString();
      const tx = await client.transaction('write');
      try {
        // Keep room for the new one: abandon the oldest active matches beyond the limit.
        await tx.execute({
          sql: `UPDATE matches SET status = 'abandoned', updated_at = ?
                WHERE id IN (SELECT id FROM matches WHERE player_id = ? AND status = 'active'
                             ORDER BY updated_at DESC, created_at DESC LIMIT -1 OFFSET ?)`,
          args: [at, playerId, MAX_ACTIVE_MATCHES - 1],
        });
        await tx.execute({
          sql: `INSERT INTO matches (id, player_id, players, actions, action_count, status, created_at, updated_at)
                VALUES (?, ?, ?, '[]', 0, 'active', ?, ?)`,
          args: [id, playerId, players, at, at],
        });
        await tx.commit();
      } finally {
        tx.close();
      }
      return { id, playerId, players, actions: [], actionCount: 0, status: 'active' };
    },

    async getMatch(id) {
      await init();
      const { rows } = await client.execute({ sql: 'SELECT * FROM matches WHERE id = ?', args: [id] });
      return rows[0] ? toMatch(rows[0]) : null;
    },

    async currentMatch(playerId) {
      await init();
      const { rows } = await client.execute({
        sql: `SELECT * FROM matches WHERE player_id = ? AND status = 'active'
              ORDER BY updated_at DESC, created_at DESC LIMIT 1`,
        args: [playerId],
      });
      return rows[0] ? toMatch(rows[0]) : null;
    },

    async saveMatch({ id, expectedCount, actions, status, result }, now) {
      await init();
      const at = now.toISOString();
      const tx = await client.transaction('write');
      try {
        const updated = await tx.execute({
          sql: `UPDATE matches SET actions = ?, action_count = ?, status = ?, updated_at = ?
                WHERE id = ? AND action_count = ? AND status = 'active'`,
          args: [JSON.stringify(actions), actions.length, status, at, id, expectedCount],
        });
        if (updated.rowsAffected !== 1) {
          await tx.rollback();
          return false;
        }
        if (result) {
          await tx.execute({
            sql: `INSERT INTO games (player_id, place, players, rolls, finished_at, match_id)
                  SELECT player_id, ?, ?, ?, ?, id FROM matches WHERE id = ?`,
            args: [result.place, result.players, result.rolls, at, id],
          });
        }
        await tx.commit();
        return true;
      } finally {
        tx.close();
      }
    },
  };
}
