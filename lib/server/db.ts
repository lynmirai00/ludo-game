import 'server-only';
import type { Client, Row } from '@libsql/client';
import { PLAYER_COUNTS, type GameResult, type Leaderboards, type Locale, type Me } from '@/lib/api';

// Schema from docs/02-zitadel.md. Timestamps are ISO 8601 text (SQLite has no date type).
const SCHEMA = `
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS players (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  locale     TEXT CHECK (locale IN ('en', 'vi', 'ja')),
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS games (
  id          INTEGER PRIMARY KEY,
  player_id   TEXT NOT NULL REFERENCES players(id),
  place       INTEGER NOT NULL CHECK (place BETWEEN 1 AND 4),
  players     INTEGER NOT NULL CHECK (players BETWEEN 2 AND 4),
  rolls       INTEGER NOT NULL CHECK (rolls >= 1),
  finished_at TEXT NOT NULL,
  CHECK (place <= players)
);
CREATE INDEX IF NOT EXISTS games_player_id ON games(player_id);
CREATE INDEX IF NOT EXISTS games_fastest ON games(players, place, rolls);
`;

const TOP = 10;

export type Db = {
  /** Creates the player or refreshes their name. */
  upsertPlayer(player: { id: string; name: string }, now: Date): Promise<void>;
  hasPlayer(id: string): Promise<boolean>;
  getMe(id: string): Promise<Me | null>;
  setLocale(id: string, locale: Locale): Promise<void>;
  addGame(playerId: string, result: GameResult, finishedAt: Date): Promise<void>;
  leaderboards(): Promise<Leaderboards>;
};

const num = (row: Row, column: string) => Number(row[column] ?? 0);
const str = (row: Row, column: string) => String(row[column] ?? '');

export function createDb(client: Client): Db {
  let ready: Promise<void> | null = null;
  // Create tables once per server instance, on first use.
  const init = () => (ready ??= client.executeMultiple(SCHEMA));

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

    async addGame(playerId, { place, players, rolls }, finishedAt) {
      await init();
      await client.execute({
        sql: 'INSERT INTO games (player_id, place, players, rolls, finished_at) VALUES (?, ?, ?, ?, ?)',
        args: [playerId, place, players, rolls, finishedAt.toISOString()],
      });
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
  };
}
