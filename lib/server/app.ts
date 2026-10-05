import 'server-only';
import { randomInt, randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { createClient } from '@libsql/client';
import { createAuth, zitadelKeySet, zitadelProfile } from './auth';
import { loadConfig } from './config';
import { createDb } from './db';
import { createHandlers, type Handlers } from './handlers';

let handlers: Handlers | null = null;

/** The real API wiring (ZITADEL + libSQL), built once per server instance. Route files call this. */
export function api(): Handlers {
  if (handlers) return handlers;
  const config = loadConfig();
  if (!config.clientId) throw new Error('CLIENT_ID is not set');

  // A local SQLite file needs its folder; Turso URLs (libsql://) do not.
  if (config.databaseUrl.startsWith('file:')) {
    mkdirSync(path.dirname(path.resolve(config.databaseUrl.slice('file:'.length))), { recursive: true });
  }

  handlers = createHandlers({
    auth: createAuth({ issuer: config.zitadelUrl, audience: config.clientId, keySet: zitadelKeySet(config.zitadelUrl) }),
    db: createDb(createClient({ url: config.databaseUrl, authToken: config.databaseAuthToken ?? undefined })),
    fetchProfile: zitadelProfile(config.zitadelUrl),
    now: () => new Date(),
    rollDie: () => randomInt(1, 7),
    newId: () => randomUUID(),
  });
  return handlers;
}
