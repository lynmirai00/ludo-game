# ZITADEL login integration

## What ZITADEL does in this project
ZITADEL handles sign-up, login, password reset and two-factor authentication.
The game never stores passwords. It only receives a JWT **access token** from ZITADEL
and uses the token's `sub` claim as the player's unique ID.

## Login flow (Authorization Code + PKCE)
1. The player clicks "Log in" → `oidc-client-ts` calls `signinRedirect()` → the browser goes to the ZITADEL login page.
2. After login, ZITADEL redirects back to `http://localhost:3000/?code=...`.
3. The page calls `signinRedirectCallback()` to exchange the `code` for tokens, then removes `?code=` from the URL with `history.replaceState`.
4. Every request to a protected API sends `Authorization: Bearer <access_token>`.
5. The server verifies the token (see below). Valid → handle the request. Invalid → `401`.
6. On a `401` the browser clears the session (`removeUser()`) and shows the login button again.
7. "Log out" calls `signoutRedirect()`; ZITADEL redirects back to `http://localhost:3000/`.

## Browser configuration
The page must NOT hardcode config. It calls `GET /api/config` to get `{ zitadelUrl, clientId }`.
```js
new oidc.UserManager({
  authority: cfg.zitadelUrl,
  client_id: cfg.clientId,
  redirect_uri: location.origin + '/',
  post_logout_redirect_uri: location.origin + '/',
  response_type: 'code',
  scope: 'openid profile email',
});
```
If ZITADEL is unreachable, the game must still be playable and show the translated message
`auth.unreachable` ("Can't reach the login server. Your results won't be saved.").

Pass the current UI language to ZITADEL so its login page matches:
```js
userManager.signinRedirect({ extraQueryParams: { ui_locales: currentLang } }); // 'en' | 'vi' | 'ja'
```
See `docs/04-i18n.md` for what happens if ZITADEL doesn't support a language.

Display name, in order of preference: `profile.name` → `profile.preferred_username` → `profile.email`.

## Server-side token verification (`src/auth.js`)
Use `jose`:
```js
const JWKS = createRemoteJWKSet(new URL(`${ZITADEL_URL}/oauth/v2/keys`));
await jwtVerify(token, JWKS, { issuer: ZITADEL_URL, audience: CLIENT_ID });
```
- `issuer` must match `ZITADEL_URL` exactly (no trailing slash).
- `audience` must contain `CLIENT_ID`.
- On success set `req.user = { id: payload.sub }`.
- Also write an `optionalAuth` middleware for public routes that still want to know who is asking.
- Write `requireRole('admin')` for the permissions phase (see the end of this file).

## Environment variables (`.env.example`)
```
ZITADEL_URL=http://localhost:8080
CLIENT_ID=
PORT=3000
DB_FILE=./data/game.db
```
The server must exit immediately with a clear error message if `CLIENT_ID` is missing.

## API
| Method | Path | Auth required | Description |
|---|---|---|---|
| GET | /api/config | No | `{ zitadelUrl, clientId }` |
| GET | /api/leaderboard | No | Top 10 by wins; ties broken by fewer games played |
| GET | /api/me | Yes | `{ id, name, wins, games, locale }` |
| PUT | /api/me/locale | Yes | `{ locale }`, saves the player's language (phase 3) |
| POST | /api/games | Yes | Record one game result (phase 3) |
| DELETE | /api/leaderboard | Yes, admin role | Clear the leaderboard (phase 5) |

Errors are returned as `{ "error": { "code": "SOME_CODE" } }` with stable codes such as `UNAUTHORIZED`, `FORBIDDEN`, `INVALID_RESULT`, `INVALID_LOCALE`, `ILLEGAL_MOVE`, `NOT_FOUND`. The browser maps each code to a translated message (`errors.<CODE>`).

## Database (SQLite)
- `players(id TEXT PRIMARY KEY  -- = sub, name TEXT, locale TEXT  -- 'en' | 'vi' | 'ja', created_at)`
- `games(id INTEGER PRIMARY KEY, player_id TEXT, result TEXT CHECK(result IN ('win','lose')), opponents INTEGER, finished_at)`
The leaderboard is a GROUP BY query over `games`.

## ZITADEL setup (done by the user in the Console; Claude Code only documents it in the README)
1. `docker compose up -d`, open http://localhost:8080/ui/console, log in with `zitadel-admin@zitadel.localhost` / `Password1!`.
2. Create a Project named "Ludo".
3. Create an Application of type **User Agent**, auth method **PKCE**.
4. Redirect URI and Post Logout URI: `http://localhost:3000/`.
5. Enable **Development Mode** (required because we use http, not https).
6. Token Settings: set **Auth Token Type** to **JWT** (required, because the server verifies the JWT signature itself).
7. Copy the Client ID into `.env`.

## docker-compose.yml for ZITADEL
```yaml
services:
  zitadel:
    image: ghcr.io/zitadel/zitadel:latest
    restart: always
    command: start-from-init --masterkey "MasterkeyNeedsToHave32Characters" --tlsMode disabled
    environment:
      ZITADEL_EXTERNALDOMAIN: localhost
      ZITADEL_EXTERNALPORT: 8080
      ZITADEL_EXTERNALSECURE: "false"
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
      - "8080:8080"
    depends_on:
      db:
        condition: service_healthy
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
Note: ZITADEL configuration can change between versions. If the container fails to start, compare against the official docs at https://zitadel.com/docs (self-hosting with Docker Compose).

## Permissions (phase 5)
- In the Console: Project → Roles, create the role key `admin`. Grant it to an account under Authorizations.
- In the Project, enable "Assert Roles on Authentication" so roles are included in the token.
- Roles appear in the claim `urn:zitadel:iam:org:project:roles` (an object whose keys are role names).
- `requireRole('admin')` checks this claim and returns `403` if the role is missing.
- The UI shows the "Clear leaderboard" button only to admins, but the server is the one that enforces it.

## Auth tests (`test/api.test.js`)
Never call a real ZITADEL in tests. Generate a key pair with `jose.generateKeyPair`, sign fake tokens,
and let `auth.js` accept the key set as a parameter (dependency injection) so it can be tested:
- No token → 401.
- Wrong signature, wrong issuer, wrong audience, expired token → 401.
- Valid token → 200, and data is tied to the correct `sub`.
- A token without the admin role calling DELETE /api/leaderboard → 403.
