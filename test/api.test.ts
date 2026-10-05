import { createClient } from '@libsql/client';
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair, type JWK } from 'jose';
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { GET as getConfig } from '@/app/api/config/route';
import { DELETE as deleteUnknown, GET as getUnknown } from '@/app/api/[...path]/route';
import type { Leaderboards, Me } from '@/lib/api';
import { displayName } from '@/lib/display-name';
import { createAuth, requireRole } from '@/lib/server/auth';
import { loadConfig, validateConfig } from '@/lib/server/config';
import { createDb } from '@/lib/server/db';
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
let clock: number;

beforeEach(() => {
  for (const sub of Object.keys(profiles)) delete profiles[sub];
  clock = Date.parse('2026-10-05T00:00:00.000Z');
  const auth = createAuth({ issuer: ISSUER, audience: CLIENT_ID, keySet: createLocalJWKSet({ keys: [publicJwk] }) });
  api = createHandlers({
    auth,
    db: createDb(createClient({ url: ':memory:' })),
    fetchProfile: async (accessToken) => {
      const sub = JSON.parse(atob(accessToken.split('.')[1]!)).sub as string;
      return profiles[sub] ?? {};
    },
    // Every call is one second later, so "who got there first" is well defined.
    now: () => new Date((clock += 1000)),
  });
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

async function saveGame(bearer: string, result: unknown) {
  return api.postGame(request('/api/games', { method: 'POST', bearer, body: result }));
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
    expect(await me(await token())).toEqual({ id: 'user-1', name: 'An Nguyen', wins: 0, games: 0, locale: null });
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

describe('POST /api/games', () => {
  test('records the result for the token subject, never for an ID in the body', async () => {
    const alice = await token({ sub: 'alice' });
    const bob = await token({ sub: 'bob' });
    const res = await saveGame(alice, { place: 1, players: 4, rolls: 50, playerId: 'bob', sub: 'bob' });
    expect(res.status).toBe(201);
    expect(await me(alice)).toMatchObject({ wins: 1, games: 1 });
    expect(await me(bob)).toMatchObject({ wins: 0, games: 0 });
  });

  test('counts wins (1st places) and games', async () => {
    const bearer = await token();
    for (const place of [1, 3, 1, 2]) expect((await saveGame(bearer, { place, players: 4, rolls: 60 })).status).toBe(201);
    expect(await me(bearer)).toMatchObject({ wins: 2, games: 4 });
  });

  test('invalid results → 400 INVALID_RESULT', async () => {
    const bearer = await token();
    const invalid = [
      { place: 3, players: 2, rolls: 40 }, // place > players
      { place: 1, players: 5, rolls: 40 },
      { place: 1, players: 1, rolls: 40 },
      { place: 0, players: 4, rolls: 40 },
      { place: 1, players: 4, rolls: 0 },
      { place: 1, players: 4, rolls: 2.5 },
      { place: 1, players: 4, rolls: 1_000_000 },
      { place: '1', players: 4, rolls: 40 },
      { place: 1, players: 4 },
      null,
      'not json',
    ];
    for (const body of invalid) {
      const res = await saveGame(bearer, body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(await res.json()).toEqual({ error: { code: 'INVALID_RESULT' } });
    }
    expect(await me(bearer)).toMatchObject({ games: 0 });
  });

  test('needs a valid token', async () => {
    expect((await saveGame('', { place: 1, players: 2, rolls: 30 })).status).toBe(401);
    expect((await saveGame(await token({ key: otherKey }), { place: 1, players: 2, rolls: 30 })).status).toBe(401);
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
    for (const [place, players, rolls] of results) expect((await saveGame(bearer, { place, players, rolls })).status).toBe(201);
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
