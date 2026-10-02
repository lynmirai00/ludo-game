import { afterEach, describe, expect, test, vi } from 'vitest';
import { GET as getConfig } from '@/app/api/config/route';
import { DELETE as deleteUnknown, GET as getUnknown } from '@/app/api/[...path]/route';
import { loadConfig } from '@/lib/server/config';
import { ApiError, toErrorResponse } from '@/lib/server/errors';

afterEach(() => {
  vi.unstubAllEnvs();
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
  test('defaults and a missing CLIENT_ID', () => {
    expect(loadConfig({})).toEqual({
      zitadelUrl: 'http://localhost:8080',
      clientId: null,
      databaseUrl: 'file:./data/game.db',
      databaseAuthToken: null,
    });
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
