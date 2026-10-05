import 'server-only';
import { isGameResult, isLocale } from '@/lib/api';
import { displayName } from '@/lib/display-name';
import type { Auth, AuthUser, FetchProfile } from './auth';
import type { Db } from './db';
import { ApiError, toErrorResponse } from './errors';

export type Deps = {
  auth: Auth;
  db: Db;
  fetchProfile: FetchProfile;
  now: () => Date;
};

type Handler = (request: Request) => Promise<Response>;

// Every handler answers with JSON; any error becomes { error: { code } }.
function handle(run: (request: Request) => Promise<Response>): Handler {
  return (request) => run(request).catch(toErrorResponse);
}

async function readJson(request: Request, invalidCode: string): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ApiError(400, invalidCode);
  }
}

/** The API, built from injectable dependencies so tests can use fake tokens and an in-memory database. */
export function createHandlers({ auth, db, fetchProfile, now }: Deps) {
  // The name always comes from ZITADEL (userinfo with the player's own token), never from the request.
  async function refreshPlayer(user: AuthUser) {
    const profile = await fetchProfile(user.token);
    await db.upsertPlayer({ id: user.id, name: displayName(profile, user.id) }, now());
  }

  async function ensurePlayer(user: AuthUser) {
    if (!(await db.hasPlayer(user.id))) await refreshPlayer(user);
  }

  return {
    /** GET /api/me: also creates the player on first login and refreshes their name on every call. */
    getMe: handle(async (request) => {
      const user = await auth.requireUser(request);
      await refreshPlayer(user);
      const me = await db.getMe(user.id);
      if (!me) throw new ApiError(404, 'NOT_FOUND');
      return Response.json(me);
    }),

    /** PUT /api/me/locale { locale } */
    putLocale: handle(async (request) => {
      const user = await auth.requireUser(request);
      const body = await readJson(request, 'INVALID_LOCALE');
      const locale = body && typeof body === 'object' ? (body as Record<string, unknown>).locale : undefined;
      if (!isLocale(locale)) throw new ApiError(400, 'INVALID_LOCALE');
      await ensurePlayer(user);
      await db.setLocale(user.id, locale);
      return Response.json({ locale });
    }),

    /** POST /api/games { place, players, rolls } */
    postGame: handle(async (request) => {
      const user = await auth.requireUser(request);
      const body = await readJson(request, 'INVALID_RESULT');
      if (!isGameResult(body)) throw new ApiError(400, 'INVALID_RESULT');
      await ensurePlayer(user);
      const { place, players, rolls } = body;
      await db.addGame(user.id, { place, players, rolls }, now());
      return Response.json({ saved: true }, { status: 201 });
    }),

    /** GET /api/me/games: the player's own recent results. */
    getMyGames: handle(async (request) => {
      const user = await auth.requireUser(request);
      return Response.json(await db.listGames(user.id));
    }),

    /** GET /api/leaderboard: public. */
    getLeaderboard: handle(async () => Response.json(await db.leaderboards())),
  };
}

export type Handlers = ReturnType<typeof createHandlers>;
