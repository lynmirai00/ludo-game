# Progress

Last updated: 2026-10-05, at a planned pause. **Read this first when resuming work.**

## Status at a glance
Phases 1–6 of `docs/03-plan.md` are done; the game is live. Only the optional Phase 7 is left.

| Phase | Status |
|---|---|
| 1. Project skeleton and i18n (Next.js 16, TypeScript, Vitest) | ✅ Done |
| 2. Game rules and play-vs-bot UI | ✅ Done |
| — Vietnamese "Cờ cá ngựa" rules, ranking, 2/3/4 players, traditional board layout, "Fast bots" | ✅ Done |
| 3. ZITADEL login, saved results, two leaderboards, "My games" | ✅ Done, real login tried |
| 4. Anti-cheat (server-side matches), replay, resume after reload | ✅ Done, end-to-end tested |
| 5. Admin role ("Reset leaderboards") | ✅ Done, tried with a real admin and a normal account |
| 6. Deploy to Vercel + security checklist | ✅ Done, live and checked |
| 7. Online multiplayer (optional) | ⏸️ Not started; **needs a decision first** (see "Next step") |

Checks at the pause: `npm test` **124/124** (5 files), `npm run typecheck` and `npm run build` clean, `npm audit` clean,
all dependencies on their latest patch. Last commit before this note: `991c02e`; everything is pushed to `origin/main`.

## Live environment (production)
| Part | Where | Notes |
|---|---|---|
| App | https://ludo-ludo-game.vercel.app | Vercel (Hobby), project `ludo-game`, function region **hnd1 (Tokyo)**, Node from `engines` (22+) |
| Database | Turso | `ludo` (Production) and `ludo-preview` (Preview), both in Tokyo |
| Login | ZITADEL Cloud `https://ludo-7py3bu.us1.zitadel.cloud` | Project `Ludo`, app `ludo-web` (User Agent, PKCE, JWT, roles in access token), role `admin`, hosted Login V2 |
| Email | Brevo SMTP, set as ZITADEL's SMTP provider | `smtp-relay.brevo.com:465`, TLS, verified sender; free plan 300 emails/day |
| Firewall | Vercel Firewall | Rate limit on `/api`: verified, the 61st request within a minute gets 429 |

Vercel environment variables: `ZITADEL_URL`, `CLIENT_ID` (Production + Preview), `DATABASE_URL` and
`DATABASE_AUTH_TOKEN` (different values for Production and Preview; tokens marked Sensitive). **No secret is stored in
the repo or in this file**: the Turso tokens and the Brevo SMTP key live only in Vercel / ZITADEL and with the user.
The user's own account on the live site has the `admin` role.

Checked on the live site: security headers and nonce CSP, no CSP violations while playing and logging in, API 401
without a token, no CORS headers, `/api/games` gone (404), only the exact redirect URI accepted, Turso reachable.
The user tried: registration with an emailed code, a saved game, the admin button.

## Local development environment
- `docker compose up -d` runs ZITADEL v4.19.4 (http://localhost:8080, only from this machine), its PostgreSQL, and
  **Mailpit** (http://localhost:8025), which catches ZITADEL's emails. Containers have `restart: always`, so they come
  back with Docker; `docker compose stop` stops them (data is kept), `docker compose down -v` wipes ZITADEL.
- Local ZITADEL: project `Ludo`, app `ludo-web`, role `admin` granted to the user's local account; SMTP provider
  = Mailpit (`localhost:1025`, user/password `ludo`, sender `noreply@ludo.localhost`).
- `.env.local` (not in git) holds the local `CLIENT_ID`; the local game DB is `data/game.db` (not in git).
- `npm run dev` or `npm run build && npm start` → http://localhost:3000.
- A local test account `ludo-test@example.test` was used for end-to-end checks. Its game data and mails were deleted;
  the user was asked to delete the account itself in the local ZITADEL Console (needs admin) — check if it is gone.

## How the app works (short)
- **Rules** (`lib/game.ts`, pure): Vietnamese rules from `docs/01-game-rules.md` — leave base on 1 or 6, no passing
  any token, no safe cells, 1/6 = extra roll, exact stop on the home entrance, 6-step home column climbed one step at
  a time, finish on steps 3–6, play on for a full ranking. Board: 56-cell track, bases Blue TL / Yellow TR / Red BL /
  Green BR, movement counterclockwise; progress 0..55 on the track (55 = entrance), 56..61 = steps 1–6.
- **Bots** (`lib/bot.ts`): score moves by simulating them; `playBots` runs bots on the server.
- **Guests** play entirely in the browser; nothing is saved.
- **Logged-in players** play server-side matches stored as actions (`{ roll }` / `{ move }`); the server rolls with
  `crypto.randomInt`, validates moves, plays bots and records the result in the same transaction; optimistic
  concurrency (409), max 3 active matches, resume after reload, replay from "My games".
- **Leaderboards**: most wins and fastest wins (fewest of the human's own rolls, per 2/3/4 players); admins can reset
  them (`settings.leaderboard_since`, nothing deleted). Names never fall back to email addresses.
- **Privacy**: "Delete my data" (`DELETE /api/me`) removes the player's games, matches and profile, then logs out.
- **Security**: nonce CSP in `proxy.ts`, static headers in `next.config.ts`, startup checks in `lib/server/config.ts`
  (CLIENT_ID required; on Vercel no SQLite file and no http ZITADEL).
- **i18n**: en/vi/ja, typed against `en.ts`; ZITADEL has no Vietnamese login page, so `ui_locales: 'vi en'`.

## Next step: Phase 7 (optional) — online multiplayer
Not started. Before writing any code, ask the user to choose how to do realtime, because Vercel serverless
functions cannot hold WebSocket connections:
1. A separate WebSocket server (the `ws` library) hosted outside Vercel (e.g. Fly.io, Render, Railway), verifying
   the same ZITADEL tokens and using the same Turso database and `lib/game.ts`.
2. A managed realtime service (e.g. Ably, Pusher, Liveblocks, Supabase Realtime), with the Next.js API staying the
   source of truth and the service only broadcasting updates.
3. No sockets: short polling of `GET /api/matches/:id` (simplest, fine for a few players, more requests).
The server-side match model from Phase 4 (actions + `replay`) is the base for rooms either way.

## Phone fix (2026-10-05, after the pause note)
The user saw a **blank page on their phone** (desktop fine; phone model/browser not known yet). Cause in our design:
the page had no server-rendered content (the i18n provider rendered nothing until JavaScript detected the language),
so any script failure meant a blank page. Fixed: server-side first render in the right language (`lang` cookie +
Accept-Language), `app/error.tsx` / `app/global-error.tsx` crash screens with the technical message, `<noscript>`
notice, no `findLast` / `Object.hasOwn` / `AbortSignal.timeout` in our code, small polyfills in
`instrumentation-client.ts`, browserslist lowered to Safari 15 / Chrome 90, CSS fallbacks for `color-mix()` and `cqw`.
Checked in Chrome: normal load (no hydration warnings, no CSP violations), built-ins removed to mimic an old browser
(the game still plays), a forced render crash (the error screen shows). **Confirmed by the user on their phone**
(page and board colors). If a phone shows the error screen, ask for its technical message and the phone model and browser.
Follow-up: the page then worked on the phone but the board had **no colors**: its browser lacks CSS `color-mix()`
(Safari < 16.2 / Chrome < 111). Replaced every `color-mix()` with fixed tints per color (`--c-track`, `--c-home`,
`--c-base`, the same values color-mix produced), so the board looks identical on new browsers. Rule: avoid CSS
features newer than the browserslist targets (Safari 15 / Chrome 90) without a fallback.

## New layout (2026-10-05, asked by the user)
Header: title, **Log in** (or the player's name, which opens Account) and a **☰** menu button. The menu is a drawer
from the right: login prompt or player name, the language dropdown, then Leaderboard, My games (logged in),
Account (logged in), How to play (new page, 10 short rules in all three languages), Log out. Each item opens a page
that **covers the game** (the game keeps running underneath and is never lost); pages and the menu are browser
history entries, so the phone's Back button and Escape close them. The main screen is only the game: controls,
board and log ("Số đối thủ" and "Tăng tốc" stay there). Checked in Chrome at 375px as a guest (header, drawer, language
change, Leaderboard and Rules pages, Back and Escape, game state unchanged, no CSP violations).
Not yet seen with a real login: the My games and Account pages in the new layout.

## Small open items
- Not yet seen in a browser: the "The others are still playing for the remaining places." hint (needs the human to
  finish while 2+ bots remain); the logic is simple and the texts exist.
- Delete the local test account in the local ZITADEL Console, if not done yet.

## Decisions already made (keep them)
- Stack: Next.js 16 App Router, TypeScript **6.0.3** (TS 7 has no JS compiler API, which `next build` needs),
  Node **22.12+** (Vitest 5), `@libsql/client`, `jose`, `oidc-client-ts`; `next.config.ts` sets `agentRules: false`.
- `.gitattributes` pins LF line endings (the machine has `core.autocrlf=true`).
- The human always plays Red; seats 2 = Red/Yellow, 3 = Red/Green/Yellow, 4 = all; default 3 bots; bots wait
  0.7–0.9 s ("Fast bots": 0.12 s, kept across new games).
- Results are recorded only by the server (`POST /api/games` was removed in Phase 4).
- "Reset leaderboards" never deletes games; history and personal stats survive a reset.
- Display names: `name`, else the part of `preferred_username` before `@`, else `#` + last 6 chars of `sub`.
- Tests use Vitest's `expect`; rule changes in `lib/game.ts` always come with tests.

## Things learned the hard way
- **ZITADEL v4, local:** without `ZITADEL_DEFAULTINSTANCE_FEATURES_LOGINV2_REQUIRED: "false"` the Console redirects
  to a missing Login V2 page (404); the setting only applies to a new instance. Use `localhost`, not `127.0.0.1` (404).
- **ZITADEL roles:** they reach the access token only with BOTH the project setting "Return user roles during
  authentication" AND the app setting "Add user roles to the access token", followed by a new login.
- **ZITADEL email:** a new instance (local or Cloud) has no SMTP provider and sends nothing. ZITADEL requires an SMTP
  user, and Go only sends credentials over plain SMTP to `localhost` (hence Mailpit in ZITADEL's network namespace).
  "CouldNotSetSender ... RFC 5321" means the sender address field is not a plain address.
- **ZITADEL login languages:** en and ja exist, vi does not.
- **Vercel:** the project URL got a prefix (`ludo-ludo-game`), so the ZITADEL redirect URIs must match it exactly;
  the Node.js setting moved, but `engines.node` already selects the version; don't use the Turso integration offered
  at import (it creates `TURSO_*` variables and maybe new databases).
- **Next.js:** assigning `document.title` is overwritten → `I18nProvider` renders `<title>`; a nonce CSP needs dynamic
  rendering (`await connection()` in `app/page.tsx`); grid-area names from the page layout leak into other grids
  (the replay dialog needed `grid-area: auto`).
- **Fonts:** on Japanese Windows `system-ui` is Yu Gothic UI, which breaks stacked Vietnamese diacritics → `:lang(vi)` rule.
- **Tests:** `server-only` throws in plain Node → Vitest alias to `test/stubs/server-only.ts`; short repeating dice
  patterns can loop forever (bots capturing each other) → use a seeded PRNG; libSQL `:memory:` uses one connection.
- **Browser checks** (headless Chrome over the DevTools protocol; helper scripts were in the session scratchpad, not
  in the repo): set React `<select>` values with the native setter + bubbling `change`; speed up bots with an injected
  `setTimeout` wrapper only while `window.__fast` is true; use a fresh Chrome profile (a reused one picks up an
  extension that logs unrelated "A listener indicated an asynchronous response..." errors); code run through DevTools
  bypasses CSP, so test CSP with an injected `<img onerror>` instead.
- **Tooling:** the Bash tool's heredocs can drop backslashes (`\\` → `\`); write files with regexes via the Write tool.
- **Never commit passwords**, not even for local test accounts (one was caught and amended before pushing).

## Open decisions (ask the user)
- Phase 7: whether to do it, and which realtime option (see "Next step").
