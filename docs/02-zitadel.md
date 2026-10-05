# ZITADEL login integration

## What ZITADEL does in this project
ZITADEL handles sign-up, login, password reset and two-factor authentication.
The game never stores passwords. It only receives a JWT **access token** from ZITADEL
and uses the token's `sub` claim as the player's unique ID.

## Login flow (Authorization Code + PKCE)
1. The player clicks "Log in" → `oidc-client-ts` calls `signinRedirect()` → the browser goes to the ZITADEL login page.
2. After login, ZITADEL redirects back to the app origin (`http://localhost:3000/` locally) with `?code=...`.
3. The page calls `signinRedirectCallback()` to exchange the `code` for tokens, then removes `?code=` from the URL with `history.replaceState`.
4. Every request to a protected API sends `Authorization: Bearer <access_token>`.
5. The server verifies the token (see below). Valid → handle the request. Invalid → `401`.
6. On a `401` the browser clears the session (`removeUser()`) and shows the login button again.
7. "Log out" calls `signoutRedirect()`; ZITADEL redirects back to the app origin.

## Browser configuration (`lib/auth-client.ts`)
`oidc-client-ts` is installed from npm (exact version pinned in `package.json`) and only used in client components.
The page must NOT hardcode config. It calls `GET /api/config` to get `{ zitadelUrl, clientId }`.
```ts
new UserManager({
  authority: cfg.zitadelUrl,
  client_id: cfg.clientId,
  redirect_uri: location.origin + '/',
  post_logout_redirect_uri: location.origin + '/',
  response_type: 'code',
  scope: 'openid profile', // no email: the game never needs it
});
```
If ZITADEL is unreachable, the game must still be playable and show the translated message
`auth.unreachable` ("Can't reach the login server. Your results won't be saved.").

Pass the current UI language to ZITADEL so its login page matches:
```ts
// ZITADEL has no Vietnamese login page; 'vi en' makes it fall back to English (see docs/04-i18n.md).
userManager.signinRedirect({ extraQueryParams: { ui_locales: currentLang === 'vi' ? 'vi en' : currentLang } });
```
See `docs/04-i18n.md` for what happens if ZITADEL doesn't support a language.

Display name (shown in the top bar and **publicly on the leaderboards**), in order of preference:
`name` → the part of `preferred_username` before any `@`. **Never show an email address**, and never use the
`email` claim as a name: a player who never set a name would otherwise have their email published.
The server takes the name from ZITADEL's userinfo endpoint (`GET {ZITADEL_URL}/oidc/v1/userinfo` with the player's
access token), never from the request body. Use the same rule in the browser and on the server.

## Server-side token verification (`lib/server/auth.ts`)
Use `jose`:
```ts
const JWKS = createRemoteJWKSet(new URL(`${ZITADEL_URL}/oauth/v2/keys`));
await jwtVerify(token, JWKS, { issuer: ZITADEL_URL, audience: CLIENT_ID });
```
- `issuer` must match `ZITADEL_URL` exactly (no trailing slash).
- `audience` must contain `CLIENT_ID`.
- Route handlers have no middleware chain, so write helpers instead:
  - `requireUser(request)` returns `{ id: payload.sub, roles }` or throws `ApiError(401, 'UNAUTHORIZED')`.
  - `optionalUser(request)` returns the user or `null`, for public routes that still want to know who is asking.
  - `requireRole(user, 'admin')` throws `ApiError(403, 'FORBIDDEN')` (permissions phase, see the end of this file).
- Build these from a factory, `createAuth({ issuer, audience, keySet })`, so tests can inject a local key set (dependency injection).
- `lib/server/errors.ts` turns an `ApiError` into `{ "error": { "code": "..." } }` with the right status; any other error becomes `500` with code `INTERNAL_ERROR` (never leak details).

## Environment variables (`.env.example`)
```
ZITADEL_URL=http://localhost:8080
CLIENT_ID=
DATABASE_URL=file:./data/game.db
DATABASE_AUTH_TOKEN=
```
- Locally, copy `.env.example` to `.env.local`. On Vercel, set the same variables in the project settings.
- `DATABASE_AUTH_TOKEN` is only needed for Turso; leave it empty for a local file.
- `lib/server/config.ts` reads and validates these. `instrumentation.ts` calls it on server start, so a missing
  `CLIENT_ID` fails immediately with a clear error message (from Phase 3 on; before login exists it only warns).

## API (Next.js route handlers under `app/api/`)
| Method | Path | Auth required | Description |
|---|---|---|---|
| GET | /api/config | No | `{ zitadelUrl, clientId }` |
| GET | /api/leaderboard | No | Both leaderboards in one response, see "Leaderboards" below |
| GET | /api/me | Yes | `{ id, name, wins, games, locale }` (wins = 1st places) |
| PUT | /api/me/locale | Yes | `{ locale }`, saves the player's language (phase 3) |
| POST | /api/games | Yes | Record one game result `{ place, players, rolls }` (phase 3); `players` must be 2–4, `place` 1..`players` and `rolls` an integer ≥ 1, otherwise `400 INVALID_RESULT` |
| DELETE | /api/leaderboard | Yes, admin role | Clear the leaderboard (phase 5) |
| DELETE | /api/me | Yes | Delete the player and all their games (privacy; phase 6) |

Errors are returned as `{ "error": { "code": "SOME_CODE" } }` with stable codes such as `UNAUTHORIZED`, `FORBIDDEN`, `INVALID_RESULT`, `INVALID_LOCALE`, `ILLEGAL_MOVE`, `NOT_FOUND`. The browser maps each code to a translated message (`errors.<CODE>`).
API routes read the database, so they must not be statically cached (`export const dynamic = 'force-dynamic'` where needed).

## Database (libSQL / SQLite)
Use `@libsql/client`. The same code and SQL work against a local file (`DATABASE_URL=file:./data/game.db`)
and against Turso in production (`DATABASE_URL=libsql://...` plus `DATABASE_AUTH_TOKEN`).
Create the tables on first use (`CREATE TABLE IF NOT EXISTS`); tests use an in-memory database (`file::memory:`).
Schema (SQLite has no date type: timestamps are TEXT in ISO 8601 UTC, e.g. `2026-10-05T09:30:00.000Z`):
```sql
CREATE TABLE IF NOT EXISTS players (
  id         TEXT PRIMARY KEY,                       -- the token's `sub`
  name       TEXT NOT NULL,                          -- display name from ZITADEL, refreshed on every login
  locale     TEXT CHECK (locale IN ('en', 'vi', 'ja')),  -- NULL until the player picks a language
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS games (
  id          INTEGER PRIMARY KEY,
  player_id   TEXT NOT NULL REFERENCES players(id),
  place       INTEGER NOT NULL CHECK (place BETWEEN 1 AND 4),     -- the human's finishing place
  players     INTEGER NOT NULL CHECK (players BETWEEN 2 AND 4),   -- number of players in that game
  rolls       INTEGER NOT NULL CHECK (rolls >= 1),                -- the human's rolls until their place was decided
  finished_at TEXT NOT NULL,
  CHECK (place <= players)
);
CREATE INDEX IF NOT EXISTS games_player_id ON games(player_id);
CREATE INDEX IF NOT EXISTS games_fastest ON games(players, place, rolls);
```
- Turn on foreign keys for every connection (`PRAGMA foreign_keys = ON`); SQLite leaves them off by default.
- Upsert the player (`INSERT ... ON CONFLICT(id) DO UPDATE SET name = excluded.name`) whenever a verified token
  reaches `GET /api/me`, so a name changed in ZITADEL shows up on the next login.
## Leaderboards
There are two leaderboards, both GROUP BY queries over `games` joined with `players`:
1. **Most wins:** wins = number of games with `place = 1`, ordered by wins (descending), then by games played
   (ascending); top 10.
2. **Fastest wins:** measured in **the human's own rolls** from the start of the game until they finished 1st
   (not wall-clock time, so "Fast bots", thinking time and idle tabs do not matter). Kept **separately for 2, 3 and
   4 players**. Each player appears once, with their best (lowest) `rolls` among their games with `place = 1`;
   ordered by rolls (ascending), ties broken by who reached it first (`finished_at`); top 10 per player count.

`GET /api/leaderboard` returns both:
```json
{
  "mostWins": [{ "name": "An", "wins": 12, "games": 30 }],
  "fastestWins": {
    "2": [{ "name": "An", "rolls": 41, "finishedAt": "2026-10-05T09:30:00.000Z" }],
    "3": [],
    "4": []
  }
}
```
"Clear leaderboard" (phase 5) deletes all rows of `games`, which empties both leaderboards.

## ZITADEL setup for local development (done by the user in the Console; Claude Code only documents it in the README)
1. `docker compose up -d`, open http://localhost:8080/ui/console, log in with `zitadel-admin@zitadel.localhost` / `Password1!`.
2. Create a Project named "Ludo".
3. Create an Application of type **User Agent**, auth method **PKCE**.
4. Redirect URI and Post Logout URI: `http://localhost:3000/`.
5. Enable **Development Mode** (required because we use http, not https).
6. Token Settings: set **Auth Token Type** to **JWT** (required, because the server verifies the JWT signature itself).
7. Copy the Client ID into `.env.local`.

## Deployment to Vercel
Vercel only hosts the Next.js app. ZITADEL and the database live elsewhere:
- **ZITADEL**: Vercel cannot run it, and it must be reachable from the internet. Use a ZITADEL Cloud instance
  (or a self-hosted one with https). Create the same Project and Application there, with the Vercel URL
  (e.g. `https://<project>.vercel.app/`) as Redirect URI and Post Logout URI. Development Mode stays **off** (https).
- **Database**: create a Turso database, then set `DATABASE_URL` and `DATABASE_AUTH_TOKEN`.
- Set `ZITADEL_URL` (the instance URL, no trailing slash) and `CLIENT_ID` in the Vercel project settings.
- Serverless functions keep no memory between requests, so all state goes to the database.

## docker-compose.yml for ZITADEL (local development)
```yaml
services:
  zitadel:
    image: ghcr.io/zitadel/zitadel:v4.19.4
    restart: always
    command: start-from-init --masterkey "MasterkeyNeedsToHave32Characters" --tlsMode disabled
    environment:
      ZITADEL_EXTERNALDOMAIN: localhost
      ZITADEL_EXTERNALPORT: 8080
      ZITADEL_EXTERNALSECURE: "false"
      # Use the login UI built into ZITADEL. Since v4, new instances require the separate
      # "Login V2" app by default, which this compose file does not run.
      ZITADEL_DEFAULTINSTANCE_FEATURES_LOGINV2_REQUIRED: "false"
      ZITADEL_DATABASE_POSTGRES_HOST: db
      ZITADEL_DATABASE_POSTGRES_PORT: 5432
      ZITADEL_DATABASE_POSTGRES_DATABASE: zitadel
      ZITADEL_DATABASE_POSTGRES_USER_USERNAME: zitadel
      ZITADEL_DATABASE_POSTGRES_USER_PASSWORD: zitadel
      ZITADEL_DATABASE_POSTGRES_USER_SSL_MODE: disable
      ZITADEL_DATABASE_POSTGRES_ADMIN_USERNAME: postgres
      ZITADEL_DATABASE_POSTGRES_ADMIN_PASSWORD: postgres
      ZITADEL_DATABASE_POSTGRES_ADMIN_SSL_MODE: disable
    ports:
      # Only reachable from this machine, not from the local network.
      - "127.0.0.1:8080:8080"
    depends_on:
      db:
        condition: service_healthy
  # Local mail catcher: ZITADEL sends its emails (verification codes, password resets) here.
  # Read them at http://localhost:8025. Nothing leaves this machine.
  mailpit:
    image: axllent/mailpit:v1.31.4
    restart: always
    ports:
      - "127.0.0.1:8025:8025"
  db:
    image: postgres:17
    restart: always
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    volumes:
      - zitadel-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 30s
      retries: 10
volumes:
  zitadel-data:
```
Notes (checked on 2026-10-05 with v4.19.4):
- The image is pinned; `latest` changed behaviour between major versions.
- Without `ZITADEL_DEFAULTINSTANCE_FEATURES_LOGINV2_REQUIRED: "false"`, the Console redirects to `/ui/v2/login`,
  which answers `{"code":5,"message":"Not Found"}` because the separate Login V2 container is not running.
  The setting only applies when an instance is first created; after changing it, reset with `docker compose down -v`.
- If you upgrade ZITADEL later, compare against the official docs at https://zitadel.com/docs (self-hosting with Docker Compose).

## Permissions (phase 5)
- In the Console: Project → Roles, create the role key `admin`. Grant it to an account under Authorizations.
- In the Project, enable "Assert Roles on Authentication" so roles are included in the token.
- Roles appear in the claim `urn:zitadel:iam:org:project:roles` (an object whose keys are role names).
- `requireRole(user, 'admin')` checks this claim and returns `403` if the role is missing.
- The UI shows the "Clear leaderboard" button only to admins, but the server is the one that enforces it.

## Auth tests (`test/api.test.ts`)
Never call a real ZITADEL in tests. Generate a key pair with `jose.generateKeyPair`, sign fake tokens,
and inject the key set through `createAuth({ ..., keySet })`. Call the route handlers directly with
`new Request(...)` (no running server needed), against an in-memory database:
- No token → 401.
- Wrong signature, wrong issuer, wrong audience, expired token → 401.
- Valid token → 200, and data is tied to the correct `sub`.
- A token without the admin role calling DELETE /api/leaderboard → 403.
