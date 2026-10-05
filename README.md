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
- **No email arrives in Mailpit:** run `docker logs ludo-game-zitadel-1` and look for `sending notification failed`.
  `CouldNotSetSender ... not a valid RFC 5321 address` means the provider's **Sender email** is not a plain address
  (check for spaces, or a name in that field). ZITADEL keeps retrying, so the email arrives as soon as it is fixed.
- **"Can't reach the login server":** ZITADEL is not running or not reachable at `ZITADEL_URL`.
  The game still works as a guest.

## Deploying to Vercel
Vercel hosts only the Next.js app. The login server (ZITADEL Cloud) and the database (Turso) live elsewhere;
all three have free plans. Do the steps in this order, because each one needs a value from the previous one.

### 1. Database: Turso
1. Sign up at https://turso.tech and create a database, e.g. `ludo` (pick a region close to your Vercel region).
2. Copy its URL (`libsql://ludo-<you>.turso.io`) and create a **database token** with read and write access.
3. Create a second database, e.g. `ludo-preview`, with its own token, for Vercel preview deployments.
   Preview builds must never write to the production data.

The tables are created automatically on the first request.

### 2. Login: ZITADEL Cloud
1. Sign up at https://zitadel.com and create an instance. Its URL looks like `https://ludo-xxxxxx.zitadel.cloud`.
2. In its Console, repeat the local setup with production values:
   - Project `Ludo`; role `admin`; in the project's **General** settings turn on
     **Return user roles during authentication** (leave "Only authorized users can authenticate" off).
   - Application `ludo-web`: **User Agent**, **PKCE**, Redirect URI and Post Logout URI exactly
     `https://<your-app>.vercel.app/` (no wildcards, no preview URLs), **Development Mode off**.
   - The application's **Token Settings**: Auth Token Type **JWT**, and **Add user roles to the access token** on.
   - **Role Assignments**: give your own account the `admin` role.
3. Login settings (instance or organization): keep **email verification** on for self-registration.
   If fake accounts appear, turn on a captcha or turn self-registration off.
4. **Emails:** a new ZITADEL Cloud instance has **no SMTP provider**, so it sends no verification codes until you
   add one (Default Settings → **SMTP Provider**). For example **Brevo** (free: 300 emails a day):
   - In Brevo, add and verify a **sender** address (Settings → Senders, domains, IPs → Senders), and create an
     **SMTP key** (Settings → SMTP & API → SMTP). The key is a secret.
   - In ZITADEL, pick the **Brevo** preset: host `smtp-relay.brevo.com:465` with TLS on (the preset may still say
     `smtp-relay.sendinblue.com`, Brevo's old name), user = the Brevo SMTP login (`...@smtp-brevo.com`),
     password = the SMTP key, sender = the verified address, sender name `Ludo`. Save, **Activate**, send a test.
5. Copy the application's **Client ID**.

### 3. App: Vercel
1. Sign up at https://vercel.com and **import** the GitHub repository. Vercel detects Next.js; keep the defaults.
   Use Node.js 22 or newer (Project Settings → General).
2. **Environment variables** (Project Settings → Environment Variables):

   | Name | Production | Preview |
   |---|---|---|
   | `ZITADEL_URL` | `https://ludo-xxxxxx.zitadel.cloud` (no trailing slash) | same |
   | `CLIENT_ID` | the Client ID from step 2 | same |
   | `DATABASE_URL` | `libsql://ludo-...turso.io` | `libsql://ludo-preview-...turso.io` |
   | `DATABASE_AUTH_TOKEN` | the `ludo` token, marked **Sensitive** | the `ludo-preview` token, **Sensitive** |

   On Vercel the server refuses to start with a local SQLite `DATABASE_URL` or an `http://` ZITADEL URL.
   Login only works on the production URL (the one registered in ZITADEL); previews can be played as a guest.
3. **Firewall** (Project → Firewall): add a rate-limit rule for paths starting with `/api`
   (for example 60 requests per minute per IP), if your plan offers it.
4. Deploy, then open `https://<your-app>.vercel.app/`.

### 4. Check before sharing the link
- Play as a guest; log in; finish a game and see it in "My games" and the leaderboards.
- Log in with an account without the `admin` role: no "Reset leaderboards" button.
- The response headers of the page include `Content-Security-Policy`, `X-Frame-Options: DENY` and
  `X-Content-Type-Options: nosniff` (browser devtools → Network).
- The full list is the "Security checklist" in Phase 6 of [`docs/03-plan.md`](docs/03-plan.md).

## Project layout
See "Target folder structure" in [`CLAUDE.md`](CLAUDE.md). In short: pure game rules in `lib/game.ts`,
React components in `components/`, API route handlers in `app/api/`, server-only code in `lib/server/`,
translations in `lib/i18n/locales/`.
