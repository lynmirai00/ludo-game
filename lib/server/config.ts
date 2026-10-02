import 'server-only';

export type ServerConfig = {
  zitadelUrl: string;
  clientId: string | null;
  databaseUrl: string;
  databaseAuthToken: string | null;
};

type Env = Record<string, string | undefined>;

export function loadConfig(env: Env = process.env): ServerConfig {
  return {
    // The token issuer must match exactly, so drop any trailing slash.
    zitadelUrl: (env.ZITADEL_URL || 'http://localhost:8080').replace(/\/+$/, ''),
    clientId: env.CLIENT_ID || null,
    databaseUrl: env.DATABASE_URL || 'file:./data/game.db',
    databaseAuthToken: env.DATABASE_AUTH_TOKEN || null,
  };
}

// Called once on server start (instrumentation.ts).
export function validateConfig(config: ServerConfig = loadConfig()): void {
  if (!config.clientId) {
    // Phase 1: login is not wired up yet, so only warn. Phase 3 turns this into a hard failure.
    console.warn('Warning: CLIENT_ID is not set. Login will not work until it is configured (see .env.example).');
  }
}
