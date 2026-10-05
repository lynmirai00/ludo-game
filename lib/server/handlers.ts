import 'server-only';
import { HUMAN, SEATS, isLocale, isPlayerCount, type ActionsResponse, type MatchView, type PlayerCount } from '@/lib/api';
import { playBots } from '@/lib/bot';
import { displayName } from '@/lib/display-name';
import { IllegalMoveError, applyAction, replay, rollCount, type Action, type Color, type GameState } from '@/lib/game';
import { requireRole, type Auth, type AuthUser, type FetchProfile } from './auth';
import type { Db, MatchRow } from './db';
import { ApiError, toErrorResponse } from './errors';

export type Deps = {
  auth: Auth;
  db: Db;
  fetchProfile: FetchProfile;
  now: () => Date;
  /** A fair die roll, 1..6 (crypto.randomInt in production; scripted in tests). */
  rollDie: () => number;
  /** A new unguessable match ID. */
  newId: () => string;
};

type Handler = (request: Request) => Promise<Response>;
type MatchHandler = (request: Request, matchId: string) => Promise<Response>;

const HUMAN_COLOR = HUMAN as Color;

// Every handler answers with JSON; any error becomes { error: { code } }.
function handle(run: Handler): Handler {
  return (request) => run(request).catch(toErrorResponse);
}

function handleMatch(run: MatchHandler): MatchHandler {
  return (request, matchId) => run(request, matchId).catch(toErrorResponse);
}

async function readJson(request: Request, invalidCode: string): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await request.json();
    if (body && typeof body === 'object' && !Array.isArray(body)) return body as Record<string, unknown>;
  } catch {
    // fall through to the error below
  }
  throw new ApiError(400, invalidCode);
}

function view(match: MatchRow): MatchView {
  return { id: match.id, players: match.players as PlayerCount, actions: match.actions, status: match.status };
}

/** The API, built from injectable dependencies so tests can use fake tokens, dice and an in-memory database. */
export function createHandlers({ auth, db, fetchProfile, now, rollDie, newId }: Deps) {
  // The name always comes from ZITADEL (userinfo with the player's own token), never from the request.
  async function refreshPlayer(user: AuthUser) {
    const profile = await fetchProfile(user.token);
    await db.upsertPlayer({ id: user.id, name: displayName(profile, user.id) }, now());
  }

  async function ensurePlayer(user: AuthUser) {
    if (!(await db.hasPlayer(user.id))) await refreshPlayer(user);
  }

  /** The match, only if it belongs to the user: others get 404, as if it did not exist. */
  async function ownMatch(user: AuthUser, matchId: string): Promise<MatchRow> {
    const match = await db.getMatch(matchId);
    if (!match || match.playerId !== user.id) throw new ApiError(404, 'NOT_FOUND');
    return match;
  }

  /**
   * Runs one human action on the server, then the bots, and saves everything in one write.
   * The state is always rebuilt from the stored actions; the only thing taken from the browser
   * is which token the human wants to move, and the rules check that.
   */
  async function play(user: AuthUser, matchId: string, humanAction: () => Action): Promise<Response> {
    const match = await ownMatch(user, matchId);
    if (match.status !== 'active') throw new ApiError(409, 'MATCH_OVER');

    const seats = SEATS[match.players as PlayerCount];
    const before = replay(seats, match.actions);
    if (before.phase === 'over' || before.turn !== HUMAN_COLOR) throw new ApiError(400, 'ILLEGAL_MOVE');

    const human = humanAction();
    let state: GameState;
    try {
      state = applyAction(before, human);
    } catch (error) {
      if (error instanceof IllegalMoveError || error instanceof RangeError) throw new ApiError(400, 'ILLEGAL_MOVE');
      throw error;
    }
    const bots = playBots(state, HUMAN_COLOR, rollDie);
    state = bots.state;
    const added = [human, ...bots.actions];

    // Record the human's result in the same write as the match, the moment their place is decided.
    const decidedNow = !before.ranking.includes(HUMAN_COLOR) && state.ranking.includes(HUMAN_COLOR);
    const result = decidedNow
      ? { place: state.ranking.indexOf(HUMAN_COLOR) + 1, players: seats.length, rolls: rollCount(state, HUMAN_COLOR) }
      : undefined;

    const saved = await db.saveMatch(
      {
        id: match.id,
        expectedCount: match.actionCount,
        actions: [...match.actions, ...added],
        status: state.phase === 'over' ? 'finished' : 'active',
        result,
      },
      now(),
    );
    // Someone else (a double click, another tab) changed the match since we read it.
    if (!saved) throw new ApiError(409, 'CONFLICT');

    const body: ActionsResponse = { actions: added, actionCount: match.actionCount + added.length };
    return Response.json(body);
  }

  return {
    /** GET /api/me: also creates the player on first login and refreshes their name on every call. */
    getMe: handle(async (request) => {
      const user = await auth.requireUser(request);
      await refreshPlayer(user);
      const me = await db.getMe(user.id);
      if (!me) throw new ApiError(404, 'NOT_FOUND');
      return Response.json({ ...me, admin: user.roles.includes('admin') });
    }),

    /** DELETE /api/me: privacy; deletes the player's game data (not their ZITADEL account). */
    deleteMe: handle(async (request) => {
      const user = await auth.requireUser(request);
      await db.deletePlayer(user.id);
      return Response.json({ deleted: true });
    }),

    /** PUT /api/me/locale { locale } */
    putLocale: handle(async (request) => {
      const user = await auth.requireUser(request);
      const locale = (await readJson(request, 'INVALID_LOCALE')).locale;
      if (!isLocale(locale)) throw new ApiError(400, 'INVALID_LOCALE');
      await ensurePlayer(user);
      await db.setLocale(user.id, locale);
      return Response.json({ locale });
    }),

    /** GET /api/me/games: the player's own recent results. */
    getMyGames: handle(async (request) => {
      const user = await auth.requireUser(request);
      return Response.json(await db.listGames(user.id));
    }),

    /** POST /api/matches { players } */
    createMatch: handle(async (request) => {
      const user = await auth.requireUser(request);
      const players = (await readJson(request, 'INVALID_REQUEST')).players;
      if (!isPlayerCount(players)) throw new ApiError(400, 'INVALID_REQUEST');
      await ensurePlayer(user);
      const match = await db.createMatch({ id: newId(), playerId: user.id, players }, now());
      return Response.json(view(match), { status: 201 });
    }),

    /** GET /api/matches/current */
    getCurrentMatch: handle(async (request) => {
      const user = await auth.requireUser(request);
      const match = await db.currentMatch(user.id);
      return Response.json({ match: match ? view(match) : null });
    }),

    /** GET /api/matches/:id */
    getMatch: handleMatch(async (request, matchId) => {
      const user = await auth.requireUser(request);
      return Response.json(view(await ownMatch(user, matchId)));
    }),

    /** POST /api/matches/:id/roll: the server rolls for the human. */
    roll: handleMatch(async (request, matchId) => {
      const user = await auth.requireUser(request);
      return play(user, matchId, () => ({ roll: rollDie() }));
    }),

    /** POST /api/matches/:id/move { token } */
    move: handleMatch(async (request, matchId) => {
      const user = await auth.requireUser(request);
      const token = (await readJson(request, 'ILLEGAL_MOVE')).token;
      if (typeof token !== 'number') throw new ApiError(400, 'ILLEGAL_MOVE');
      return play(user, matchId, () => ({ move: token }));
    }),

    /** DELETE /api/leaderboard: admin only; resets both leaderboards without deleting any game. */
    resetLeaderboards: handle(async (request) => {
      const user = await auth.requireUser(request);
      requireRole(user, 'admin');
      return Response.json({ since: await db.resetLeaderboards(now()) });
    }),

    /** GET /api/leaderboard: public. */
    getLeaderboard: handle(async () => Response.json(await db.leaderboards())),
  };
}

export type Handlers = ReturnType<typeof createHandlers>;
