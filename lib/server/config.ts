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

// Called once on server start (instrumentation.ts): without a Client ID no token can be
// verified, so stop right away with a clear message instead of failing on every request.
export function validateConfig(config: ServerConfig = loadConfig()): void {
  if (!config.clientId) {
    throw new Error(
      'CLIENT_ID is not set. Copy .env.example to .env.local and fill in the Client ID of the ZITADEL application (see docs/02-zitadel.md).',
    );
  }
}
