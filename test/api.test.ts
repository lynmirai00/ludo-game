import { createClient } from '@libsql/client';
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair, type JWK } from 'jose';
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { GET as getConfig } from '@/app/api/config/route';
import { DELETE as deleteUnknown, GET as getUnknown } from '@/app/api/[...path]/route';
import { SEATS, type ActionsResponse, type GameRecord, type GameResult, type Leaderboards, type MatchView, type Me } from '@/lib/api';
import { chooseMove } from '@/lib/bot';
import { replay, rollCount, type GameState } from '@/lib/game';
import { displayName } from '@/lib/display-name';
import { createAuth, requireRole } from '@/lib/server/auth';
import { loadConfig, validateConfig } from '@/lib/server/config';
import { createDb, type Db } from '@/lib/server/db';
import { ApiError, toErrorResponse } from '@/lib/server/errors';
import { createHandlers, type Handlers } from '@/lib/server/handlers';

const ISSUER = 'http://zitadel.test';
const CLIENT_ID = 'test-client';
const ROLES_CLAIM = 'urn:zitadel:iam:org:project:roles';

type KeyPair = Awaited<ReturnType<typeof generateKeyPair>>;
let goodKey: KeyPair;
let otherKey: KeyPair;
let publicJwk: JWK;

beforeAll(async () => {
  goodKey = await generateKeyPair('RS256');
  otherKey = await generateKeyPair('RS256');
  publicJwk = { ...(await exportJWK(goodKey.publicKey)), kid: 'test-key', alg: 'RS256' };
});

type TokenOptions = {
  sub?: string;
  issuer?: string;
  audience?: string | string[];
  expiresIn?: string | number;
  key?: KeyPair;
  claims?: Record<string, unknown>;
};

async function token({
  sub = 'user-1',
  issuer = ISSUER,
  audience = [CLIENT_ID, 'project-id'],
  expiresIn = '1h',
  key = goodKey,
  claims = {},
}: TokenOptions = {}): Promise<string> {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
    .setSubject(sub)
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(key.privateKey);
}

// Fake ZITADEL userinfo: profiles by subject.
const profiles: Record<string, { name?: string; preferred_username?: string; email?: string }> = {};

let api: Handlers;
let db: Db;
let clock: number;
/** Dice the server will roll next; when empty, a seeded random sequence is used. */
let scriptedDice: number[];
let seed: number;
let ids: number;

function seededDie(): number {
  seed = (seed + 0x6d2b79f5) | 0;
  let x = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
  return 1 + Math.floor((((x ^ (x >>> 14)) >>> 0) / 4294967296) * 6);
}

const subOf = (accessToken: string) => JSON.parse(atob(accessToken.split('.')[1]!)).sub as string;

function buildApi(database: Db): Handlers {
  return createHandlers({
    auth: createAuth({ issuer: ISSUER, audience: CLIENT_ID, keySet: createLocalJWKSet({ keys: [publicJwk] }) }),
    db: database,
    fetchProfile: async (accessToken) => profiles[subOf(accessToken)] ?? {},
    // Every call is one second later, so "who got there first" is well defined.
    now: () => new Date((clock += 1000)),
    rollDie: () => scriptedDice.shift() ?? seededDie(),
    newId: () => `match-${++ids}`,
  });
}

beforeEach(() => {
  for (const sub of Object.keys(profiles)) delete profiles[sub];
  clock = Date.parse('2026-10-05T00:00:00.000Z');
  scriptedDice = [];
  seed = 42;
  ids = 0;
  db = createDb(createClient({ url: ':memory:' }));
  api = buildApi(db);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function request(path: string, { method = 'GET', bearer, body }: { method?: string; bearer?: string; body?: unknown } = {}) {
  const headers = new Headers();
  if (bearer) headers.set('authorization', `Bearer ${bearer}`);
  if (body !== undefined) headers.set('content-type', 'application/json');
  return new Request(`http://localhost:3000${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });
}

async function me(bearer: string): Promise<Me> {
  const res = await api.getMe(request('/api/me', { bearer }));
  expect(res.status).toBe(200);
  return res.json();
}

// Results are only recorded by the server when a match ends (see "matches" below);
// tests of the stats and leaderboards seed them straight into the database.
async function saveGame(bearer: string, result: GameResult) {
  const sub = subOf(bearer);
  await db.upsertPlayer({ id: sub, name: profiles[sub]?.name ?? sub }, new Date((clock += 1000)));
  await db.addGame(sub, result, new Date((clock += 1000)));
}

describe('token verification', () => {
  test('no token → 401 UNAUTHORIZED', async () => {
    const res = await api.getMe(request('/api/me'));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: { code: 'UNAUTHORIZED' } });
  });

  test('malformed token or header → 401', async () => {
    for (const header of ['Bearer not-a-jwt', 'Basic abc', 'Bearer']) {
      const res = await api.getMe(new Request('http://localhost:3000/api/me', { headers: { authorization: header } }));
      expect(res.status, header).toBe(401);
    }
  });

  test('wrong signature, wrong issuer, wrong audience or expired token → 401', async () => {
    const bad = [
      await token({ key: otherKey }),
      await token({ issuer: 'http://evil.test' }),
      await token({ issuer: `${ISSUER}/` }),
      await token({ audience: 'another-client' }),
      await token({ expiresIn: Math.floor(Date.now() / 1000) - 60 }),
    ];
    for (const bearer of bad) {
      const res = await api.getMe(request('/api/me', { bearer }));
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: { code: 'UNAUTHORIZED' } });
    }
  });

  test('valid token → 200 and the player is the token subject', async () => {
    profiles['user-1'] = { name: 'An Nguyen' };
    expect(await me(await token())).toEqual({ id: 'user-1', name: 'An Nguyen', wins: 0, games: 0, locale: null, admin: false });
  });

  test('roles come from the ZITADEL roles claim; requireRole throws 403 without the role', async () => {
    const auth = createAuth({ issuer: ISSUER, audience: CLIENT_ID, keySet: createLocalJWKSet({ keys: [publicJwk] }) });
    const admin = await auth.requireUser(
      request('/', { bearer: await token({ claims: { [ROLES_CLAIM]: { admin: { org1: 'example.com' } } } }) }),
    );
    expect(admin.roles).toEqual(['admin']);
    expect(() => requireRole(admin, 'admin')).not.toThrow();

    const player = await auth.requireUser(request('/', { bearer: await token() }));
    expect(() => requireRole(player, 'admin')).toThrow(expect.objectContaining({ status: 403, code: 'FORBIDDEN' }));
  });

  test('optionalUser treats a missing or invalid token as a guest', async () => {
    const auth = createAuth({ issuer: ISSUER, audience: CLIENT_ID, keySet: createLocalJWKSet({ keys: [publicJwk] }) });
    expect(await auth.optionalUser(request('/'))).toBeNull();
    expect(await auth.optionalUser(request('/', { bearer: await token({ key: otherKey }) }))).toBeNull();
    expect((await auth.optionalUser(request('/', { bearer: await token() })))?.id).toBe('user-1');
  });
});

describe('display names', () => {
  test('use the name, else the username before @, and never an email address', () => {
    expect(displayName({ name: 'An Nguyen', preferred_username: 'an@example.com' }, 'sub-123456')).toBe('An Nguyen');
    expect(displayName({ preferred_username: 'an.nguyen@example.com' }, 'sub-123456')).toBe('an.nguyen');
    expect(displayName({ name: 'an@example.com', preferred_username: 'an' }, 'sub-123456')).toBe('an');
    expect(displayName({ name: '  ' }, 'sub-123456')).toBe('#123456');
    expect(displayName({}, 'sub-123456')).toBe('#123456');
  });

  test('GET /api/me refreshes the name from ZITADEL on every call and never stores the email', async () => {
    const bearer = await token();
    profiles['user-1'] = { preferred_username: 'an@example.com', email: 'an@example.com' };
    expect((await me(bearer)).name).toBe('an');
    profiles['user-1'] = { name: 'An Nguyen', email: 'an@example.com' };
    expect((await me(bearer)).name).toBe('An Nguyen');
  });
});

describe('PUT /api/me/locale', () => {
  test('saves en, vi or ja for the token subject', async () => {
    const bearer = await token();
    for (const locale of ['vi', 'ja', 'en']) {
      const res = await api.putLocale(request('/api/me/locale', { method: 'PUT', bearer, body: { locale } }));
      expect(res.status).toBe(200);
      expect((await me(bearer)).locale).toBe(locale);
    }
  });

  test('anything else → 400 INVALID_LOCALE', async () => {
    const bearer = await token();
    for (const body of [{ locale: 'fr' }, { locale: 'EN' }, {}, 'not json', { locale: null }]) {
      const res = await api.putLocale(request('/api/me/locale', { method: 'PUT', bearer, body }));
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(await res.json()).toEqual({ error: { code: 'INVALID_LOCALE' } });
    }
  });

  test('needs a token', async () => {
    const res = await api.putLocale(request('/api/me/locale', { method: 'PUT', body: { locale: 'vi' } }));
    expect(res.status).toBe(401);
  });
});

describe('results', () => {
  test('the browser cannot post a result: there is no such endpoint any more', () => {
    expect('postGame' in api).toBe(false);
  });

  test('stats count wins (1st places) and games, for the token subject only', async () => {
    const alice = await token({ sub: 'alice' });
    const bob = await token({ sub: 'bob' });
    for (const place of [1, 3, 1, 2]) await saveGame(alice, { place, players: 4, rolls: 60 });
    expect(await me(alice)).toMatchObject({ wins: 2, games: 4 });
    expect(await me(bob)).toMatchObject({ wins: 0, games: 0 });
  });
});

describe('matches', () => {
  async function createMatch(bearer: string, players: unknown = 2) {
    return api.createMatch(request('/api/matches', { method: 'POST', bearer, body: { players } }));
  }
  async function newMatch(bearer: string, players = 2): Promise<MatchView> {
    const res = await createMatch(bearer, players);
    expect(res.status).toBe(201);
    return res.json();
  }
  async function getMatch(bearer: string, id: string) {
    return api.getMatch(request(`/api/matches/${id}`, { bearer }), id);
  }
  async function roll(bearer: string, id: string) {
    return api.roll(request(`/api/matches/${id}/roll`, { method: 'POST', bearer }), id);
  }
  async function move(bearer: string, id: string, body: unknown) {
    return api.move(request(`/api/matches/${id}/move`, { method: 'POST', bearer, body }), id);
  }
  /** The match state, rebuilt the same way the browser does it. */
  async function stateOf(bearer: string, id: string): Promise<{ view: MatchView; state: GameState }> {
    const res = await getMatch(bearer, id);
    expect(res.status).toBe(200);
    const view: MatchView = await res.json();
    return { view, state: replay(SEATS[view.players], view.actions) };
  }

  test('creating a match needs a token and 2, 3 or 4 players', async () => {
    expect((await createMatch('', 2)).status).toBe(401);
    const bearer = await token();
    const invalid = [
      ...[1, 5, '4', null].map((players) => createMatch(bearer, players)),
      api.createMatch(request('/api/matches', { method: 'POST', bearer, body: {} })),
      api.createMatch(request('/api/matches', { method: 'POST', bearer, body: 'not json' })),
    ];
    for (const res of await Promise.all(invalid)) {
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: { code: 'INVALID_REQUEST' } });
    }
    expect(await newMatch(bearer, 3)).toEqual({ id: 'match-1', players: 3, actions: [], status: 'active' });
  });

  test("another player's match is invisible: 404 for viewing, rolling and moving", async () => {
    const alice = await token({ sub: 'alice' });
    const bob = await token({ sub: 'bob' });
    const { id } = await newMatch(alice);
    for (const res of [await getMatch(bob, id), await roll(bob, id), await move(bob, id, { token: 0 })]) {
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: { code: 'NOT_FOUND' } });
    }
    expect((await roll(alice, 'no-such-match')).status).toBe(404);
    expect((await stateOf(alice, id)).view.actions).toEqual([]); // nothing happened to Alice's match
  });

  test('the server rolls; with no legal move the bots play until it is the human\u2019s turn again', async () => {
    const bearer = await token();
    const { id } = await newMatch(bearer, 4);
    scriptedDice = [3]; // the human cannot leave the base on a 3
    const res = await roll(bearer, id);
    expect(res.status).toBe(200);
    const body: ActionsResponse = await res.json();
    expect(body.actions[0]).toEqual({ roll: 3 });
    expect(body.actions.length).toBeGreaterThan(1); // the bots played too
    expect(body.actionCount).toBe(body.actions.length);
    const { view, state } = await stateOf(bearer, id);
    expect(view.actions).toEqual(body.actions);
    expect(state.turn).toBe(0);
    expect(state.phase).toBe('roll');
  });

  test('illegal moves and out-of-turn actions → 400 ILLEGAL_MOVE, and change nothing', async () => {
    const bearer = await token();
    const { id } = await newMatch(bearer);
    for (const body of [{ token: 0 }, {}]) expect((await move(bearer, id, body)).status).toBe(400); // must roll first

    scriptedDice = [6];
    expect((await roll(bearer, id)).status).toBe(200); // a 6: the human must now move
    const second = await roll(bearer, id); // rolling again before moving
    expect(second.status).toBe(400);
    expect(await second.json()).toEqual({ error: { code: 'ILLEGAL_MOVE' } });
    for (const body of [{ token: 7 }, { token: -1 }, { token: 1.5 }, { token: '0' }, {}, 'not json']) {
      const res = await move(bearer, id, body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(await res.json()).toEqual({ error: { code: 'ILLEGAL_MOVE' } });
    }
    expect((await stateOf(bearer, id)).view.actions).toEqual([{ roll: 6 }]);

    const ok = await move(bearer, id, { token: 2 });
    expect(ok.status).toBe(200);
    expect(((await ok.json()) as ActionsResponse).actions[0]).toEqual({ move: 2 });
  });

  test("the human cannot act during a bot's turn, even if a stored match stopped there", async () => {
    const bearer = await token();
    const { id } = await newMatch(bearer, 2);
    // A match left halfway through the bots' turn (e.g. a crash): Red rolled a 3, now it is Yellow's turn.
    expect(await db.saveMatch({ id, expectedCount: 0, actions: [{ roll: 3 }], status: 'active' }, new Date())).toBe(true);
    for (const res of [await roll(bearer, id), await move(bearer, id, { token: 0 })]) {
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: { code: 'ILLEGAL_MOVE' } });
    }
    expect((await stateOf(bearer, id)).view.actions).toEqual([{ roll: 3 }]);
  });

  test('a full game played through the API records exactly one result, computed by the server', async () => {
    const bearer = await token();
    const { id } = await newMatch(bearer, 2);
    for (let step = 0; ; step++) {
      expect(step < 5000, 'the game should end').toBe(true);
      const { view, state } = await stateOf(bearer, id);
      if (view.status === 'finished') {
        const place = state.ranking.indexOf(0) + 1;
        expect(await me(bearer)).toMatchObject({ games: 1, wins: place === 1 ? 1 : 0 });
        const history: GameRecord[] = await (await api.getMyGames(request('/api/me/games', { bearer }))).json();
        expect(history).toHaveLength(1);
        expect(history[0]).toMatchObject({ place, players: 2, rolls: rollCount(state, 0), matchId: id });
        const after = await roll(bearer, id);
        expect(after.status).toBe(409);
        expect(await after.json()).toEqual({ error: { code: 'MATCH_OVER' } });
        break;
      }
      const res = state.phase === 'roll' ? await roll(bearer, id) : await move(bearer, id, { token: chooseMove(state) });
      expect(res.status).toBe(200);
    }
  });

  test('a stale write is refused with 409 CONFLICT', async () => {
    const bearer = await token();
    const { id } = await newMatch(bearer);
    // The database layer: an update based on an old action count changes nothing.
    expect(await db.saveMatch({ id, expectedCount: 0, actions: [{ roll: 3 }], status: 'active' }, new Date())).toBe(true);
    expect(await db.saveMatch({ id, expectedCount: 0, actions: [{ roll: 4 }], status: 'active' }, new Date())).toBe(false);
    expect((await db.getMatch(id))?.actions).toEqual([{ roll: 3 }]);

    // The API: when the save loses the race (a double click, a second tab), the client gets CONFLICT.
    const racing = buildApi({ ...db, saveMatch: async () => false });
    const { id: other } = await newMatch(bearer);
    const res = await racing.roll(request(`/api/matches/${other}/roll`, { method: 'POST', bearer }), other);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: { code: 'CONFLICT' } });
  });

  test('at most 3 active matches: a 4th abandons the oldest; current returns the latest active one', async () => {
    const bearer = await token();
    expect(await (await api.getCurrentMatch(request('/api/matches/current', { bearer }))).json()).toEqual({ match: null });
    const created: MatchView[] = [];
    for (let i = 0; i < 4; i++) created.push(await newMatch(bearer));
    expect((await stateOf(bearer, created[0]!.id)).view.status).toBe('abandoned');
    for (const match of created.slice(1)) expect((await stateOf(bearer, match.id)).view.status).toBe('active');
    const current = await (await api.getCurrentMatch(request('/api/matches/current', { bearer }))).json();
    expect(current.match.id).toBe(created[3]!.id);
    const res = await roll(bearer, created[0]!.id);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: { code: 'MATCH_OVER' } });
  });
});

describe('GET /api/me/games', () => {
  async function myGames(bearer: string): Promise<GameRecord[]> {
    const res = await api.getMyGames(request('/api/me/games', { bearer }));
    expect(res.status).toBe(200);
    return res.json();
  }

  test('needs a valid token', async () => {
    expect((await api.getMyGames(request('/api/me/games'))).status).toBe(401);
    expect((await api.getMyGames(request('/api/me/games', { bearer: await token({ key: otherKey }) }))).status).toBe(401);
  });

  test("returns only the token subject's games, newest first", async () => {
    const alice = await token({ sub: 'alice' });
    const bob = await token({ sub: 'bob' });
    await saveGame(alice, { place: 2, players: 4, rolls: 60 });
    await saveGame(bob, { place: 1, players: 2, rolls: 30 });
    await saveGame(alice, { place: 1, players: 3, rolls: 45 });

    const games = await myGames(alice);
    expect(games.map(({ place, players, rolls }) => ({ place, players, rolls }))).toEqual([
      { place: 1, players: 3, rolls: 45 },
      { place: 2, players: 4, rolls: 60 },
    ]);
    expect(Date.parse(games[0]!.finishedAt)).toBeGreaterThan(Date.parse(games[1]!.finishedAt));
    expect(await myGames(bob)).toHaveLength(1);
    expect(await myGames(await token({ sub: 'nobody' }))).toEqual([]);
  });

  test('returns at most the 20 most recent games', async () => {
    const bearer = await token();
    for (let i = 1; i <= 25; i++) await saveGame(bearer, { place: 1, players: 2, rolls: i });
    const games = await myGames(bearer);
    expect(games).toHaveLength(20);
    expect(games[0]!.rolls).toBe(25);
    expect(games.at(-1)!.rolls).toBe(6);
  });
});

describe('GET /api/leaderboard', () => {
  async function leaderboards(): Promise<Leaderboards> {
    const res = await api.getLeaderboard(request('/api/leaderboard'));
    expect(res.status).toBe(200);
    return res.json();
  }

  async function player(sub: string, name: string, results: [place: number, players: number, rolls: number][]) {
    profiles[sub] = { name };
    const bearer = await token({ sub });
    for (const [place, players, rolls] of results) await saveGame(bearer, { place, players, rolls });
  }

  test('is public and empty at first', async () => {
    expect(await leaderboards()).toEqual({ mostWins: [], fastestWins: { 2: [], 3: [], 4: [] } });
  });

  test('most wins: by 1st places, ties to fewer games, players without a win left out', async () => {
    await player('a', 'Anh', [[1, 4, 50], [1, 4, 50], [2, 4, 50]]);
    await player('b', 'Binh', [[1, 2, 40], [1, 3, 40]]);
    await player('c', 'Chi', [[1, 4, 70], [3, 4, 70], [2, 4, 70], [1, 4, 70]]);
    await player('d', 'Dung', [[2, 4, 50], [4, 4, 50]]);
    expect((await leaderboards()).mostWins).toEqual([
      { name: 'Binh', wins: 2, games: 2 },
      { name: 'Anh', wins: 2, games: 3 },
      { name: 'Chi', wins: 2, games: 4 },
    ]);
  });

  test('fastest wins: per player count, each player once with their best, ties to whoever was first', async () => {
    await player('a', 'Anh', [[1, 4, 60], [1, 4, 45], [1, 2, 30], [2, 4, 10]]); // a 2nd place never counts
    await player('b', 'Binh', [[1, 4, 45], [1, 3, 50]]); // same 45 as Anh, but later
    await player('c', 'Chi', [[1, 4, 80]]);
    const { fastestWins } = await leaderboards();
    expect(fastestWins['4'].map(({ name, rolls }) => [name, rolls])).toEqual([
      ['Anh', 45],
      ['Binh', 45],
      ['Chi', 80],
    ]);
    expect(fastestWins['2'].map(({ name, rolls }) => [name, rolls])).toEqual([['Anh', 30]]);
    expect(fastestWins['3'].map(({ name, rolls }) => [name, rolls])).toEqual([['Binh', 50]]);
    expect(fastestWins['4'][0]!.finishedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  test('shows at most 10 players', async () => {
    for (let i = 0; i < 12; i++) await player(`p${i}`, `P${i}`, [[1, 2, 30 + i]]);
    const { mostWins, fastestWins } = await leaderboards();
    expect(mostWins).toHaveLength(10);
    expect(fastestWins['2'].map((row) => row.name)).toEqual(['P0', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9']);
  });
});

describe('admin: DELETE /api/leaderboard', () => {
  const adminToken = (sub = 'boss') => token({ sub, claims: { [ROLES_CLAIM]: { admin: { org1: 'example.com' } } } });
  const reset = (bearer?: string) => api.resetLeaderboards(request('/api/leaderboard', { method: 'DELETE', bearer }));
  const boards = async (): Promise<Leaderboards> => (await api.getLeaderboard(request('/api/leaderboard'))).json();

  test('GET /api/me tells the browser whether the verified token has the admin role', async () => {
    expect((await me(await adminToken())).admin).toBe(true);
    expect((await me(await token())).admin).toBe(false);
  });

  test('needs a token, and a token without the admin role gets 403 FORBIDDEN', async () => {
    expect((await reset()).status).toBe(401);
    const res = await reset(await token());
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: { code: 'FORBIDDEN' } });
    // Another role is not enough either.
    const other = await token({ claims: { [ROLES_CLAIM]: { moderator: {} } } });
    expect((await reset(other)).status).toBe(403);
  });

  test('an admin resets both leaderboards; players keep their history and stats; later games count again', async () => {
    const player = await token({ sub: 'p1' });
    profiles['p1'] = { name: 'Phuong' };
    await saveGame(player, { place: 1, players: 2, rolls: 30 });
    await saveGame(player, { place: 1, players: 4, rolls: 50 });
    expect((await boards()).mostWins).toHaveLength(1);

    const res = await reset(await adminToken());
    expect(res.status).toBe(200);
    expect((await res.json()).since).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    expect(await boards()).toEqual({ mostWins: [], fastestWins: { 2: [], 3: [], 4: [] } });
    expect(await me(player)).toMatchObject({ wins: 2, games: 2 });
    const history = await (await api.getMyGames(request('/api/me/games', { bearer: player }))).json();
    expect(history).toHaveLength(2);

    await saveGame(player, { place: 1, players: 2, rolls: 44 });
    const after = await boards();
    expect(after.mostWins).toEqual([{ name: 'Phuong', wins: 1, games: 1 }]);
    expect(after.fastestWins['2'].map((row) => row.rolls)).toEqual([44]);
  });
});

describe('GET /api/config', () => {
  test('returns the ZITADEL URL (no trailing slash) and the client ID from the environment', async () => {
    vi.stubEnv('ZITADEL_URL', 'http://zitadel.test/');
    vi.stubEnv('CLIENT_ID', 'test-client');
    const res = getConfig();
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/application\/json/);
    expect(await res.json()).toEqual({ zitadelUrl: 'http://zitadel.test', clientId: 'test-client' });
  });

  test('never exposes database settings', async () => {
    vi.stubEnv('DATABASE_AUTH_TOKEN', 'secret-token');
    const body = await getConfig().text();
    expect(body).not.toContain('secret-token');
    expect(Object.keys(JSON.parse(body)).sort()).toEqual(['clientId', 'zitadelUrl']);
  });
});

describe('unknown /api routes', () => {
  test('return a JSON error code, never text', async () => {
    for (const handler of [getUnknown, deleteUnknown]) {
      const res = handler();
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: { code: 'NOT_FOUND' } });
    }
  });
});

describe('server config', () => {
  test('defaults', () => {
    expect(loadConfig({})).toEqual({
      zitadelUrl: 'http://localhost:8080',
      clientId: null,
      databaseUrl: 'file:./data/game.db',
      databaseAuthToken: null,
    });
  });

  test('a missing CLIENT_ID stops the server on startup with a clear message', () => {
    expect(() => validateConfig(loadConfig({}))).toThrow(/CLIENT_ID is not set/);
    expect(() => validateConfig(loadConfig({ CLIENT_ID: 'abc' }))).not.toThrow();
  });
});

describe('error responses', () => {
  test('ApiError keeps its status and code; anything else is a 500 without details', async () => {
    const known = toErrorResponse(new ApiError(403, 'FORBIDDEN'));
    expect(known.status).toBe(403);
    expect(await known.json()).toEqual({ error: { code: 'FORBIDDEN' } });

    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const unknown = toErrorResponse(new Error('db password is hunter2'));
    expect(unknown.status).toBe(500);
    expect(await unknown.text()).toBe('{"error":{"code":"INTERNAL_ERROR"}}');
    error.mockRestore();
  });
});
