# Ludo (Cờ cá ngựa)

A web game of Vietnamese "Cờ cá ngựa" (horse race chess, a Ludo variant) against computer opponents.
The UI is available in English, Vietnamese and Japanese. Players can log in with ZITADEL to save their
results and appear on two leaderboards (most wins, fastest wins); guests can play without saving anything.

Built with Next.js 16 (App Router) and TypeScript, libSQL/SQLite for storage, and ZITADEL (OpenID Connect) for login.
Rules: [`docs/01-game-rules.md`](docs/01-game-rules.md). Architecture and API: [`docs/02-zitadel.md`](docs/02-zitadel.md).

## Requirements
- Node.js 22.12 or newer
- Docker with Docker Compose (for the local ZITADEL)

## Quick start
```sh
npm install
docker compose up -d          # ZITADEL on http://localhost:8080 (first start takes about a minute)
cp .env.example .env.local    # then fill in CLIENT_ID, see below
npm run dev                   # http://localhost:3000
```

| Command | What it does |
|---|---|
| `npm run dev` | Development server with hot reload |
| `npm run build` then `npm start` | Production build and server |
| `npm test` | All tests (Vitest) |
| `npm run typecheck` | TypeScript check |

The server refuses to start without `CLIENT_ID`. A local SQLite file is created at `data/game.db` on first use.

## Setting up the local ZITADEL
`docker-compose.yml` runs ZITADEL v4.19.4 with its built-in login page, reachable only from this machine.

1. Start it: `docker compose up -d`, then wait until http://localhost:8080/ui/console loads.
   Always use `localhost`, not `127.0.0.1`: ZITADEL identifies the instance by host name and answers 404 otherwise.
2. Log in to the Console with `zitadel-admin@zitadel.localhost` / `Password1!`. Change the password when asked
   (and skip the two-factor setup if you like).
3. **Projects → Create New Project**, name it `Ludo`.
4. In the project, **Applications → New**:
   - Name `ludo-web`, type **User Agent**, authentication method **PKCE**.
   - Redirect URI and Post Logout URI: `http://localhost:3000/` (with the trailing slash; press **+** to add each).
   - Turn on **Development Mode** (required because the local setup uses http).
   - Create it and copy the **Client ID**.
5. In the application's **Token Settings**, set **Auth Token Type** to **JWT** and save.
   The server verifies the token signature itself, so it needs JWT access tokens.
6. Put the Client ID in `.env.local`:
   ```
   ZITADEL_URL=http://localhost:8080
   CLIENT_ID=<your client id>
   DATABASE_URL=file:./data/game.db
   DATABASE_AUTH_TOKEN=
   ```
7. Run `npm run dev`, open http://localhost:3000 and press **Log in**. Any ZITADEL account works,
   including the admin account; new accounts can be created with **Register** on the login page.

### Emails (verification codes, password resets)
The local ZITADEL has no real mail server. `docker compose up -d` also starts **Mailpit**, which catches every
email ZITADEL sends; read them at http://localhost:8025. Connect ZITADEL to it once in the Console:

1. **Default Settings** (instance settings) → **SMTP Provider** (in some versions under **Notification Providers**).
2. Add a **Generic SMTP** provider:
   - Host and port: `localhost:1025` (Mailpit shares ZITADEL's network, so for ZITADEL it is on localhost)
   - TLS: off
   - User: `ludo`, password: `ludo` (ZITADEL requires a user; Mailpit accepts any)
   - Sender email: `noreply@ludo.localhost`, sender name: `Ludo`
3. Save, then **Activate** the provider (an inactive provider sends nothing).

If you registered before doing this, press **Resend code** on the verification page; the code then shows up in Mailpit.

### Login page languages
ZITADEL's login page supports English and Japanese but **not Vietnamese**
(see `ui_locales_supported` in http://localhost:8080/.well-known/openid-configuration).
When the game is in Vietnamese it asks ZITADEL for `vi en`, so the login page is shown in English.
Custom login texts cannot add a language ZITADEL does not support.

### Troubleshooting
- **The Console shows `{"code":5,"message":"Not Found"}` at `/ui/v2/login`:** the instance was created without
  `ZITADEL_DEFAULTINSTANCE_FEATURES_LOGINV2_REQUIRED: "false"`. That setting only applies to a new instance:
  run `docker compose down -v` (this deletes all ZITADEL data) and `docker compose up -d`.
- **After logging in, the top bar says the session has expired:** check that the application's Auth Token Type is
  **JWT**, and look at the server log for `Rejected access token: ...`, which names the failing check
  (for example the `aud` claim when `CLIENT_ID` does not match the application).
- **"Can't reach the login server":** ZITADEL is not running or not reachable at `ZITADEL_URL`.
  The game still works as a guest.

## Project layout
See "Target folder structure" in [`CLAUDE.md`](CLAUDE.md). In short: pure game rules in `lib/game.ts`,
React components in `components/`, API route handlers in `app/api/`, server-only code in `lib/server/`,
translations in `lib/i18n/locales/`.
