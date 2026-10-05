# Progress

Last updated: 2026-10-05 (after the switch to Vietnamese rules). Read this first when resuming work.

## Where we are
| Phase (`docs/03-plan.md`) | Status |
|---|---|
| Docs switched to Next.js + TypeScript + libSQL + Vercel | ✅ Done |
| Phase 1: project skeleton and i18n | ✅ Done |
| Phase 2: game rules and play-vs-bot UI | ✅ Done (ported from an earlier plain-JS version, since deleted) |
| Switch to Vietnamese "Cờ cá ngựa" rules, ranking, 3-player games | ✅ Done (2026-10-05) |
| "Fast bots" toggle | ✅ Done (2026-10-05) |
| Phase 3: ZITADEL login and saved results | ✅ Done: real login and a saved result confirmed (2026-10-05) |
| Phase 4: anti-cheat, replay, resume after reload | ✅ Done (2026-10-05) |
| Phase 5: admin role | ✅ Done: tried by the user with a real admin and a normal account (2026-10-05) |
| Phase 6: deploy to Vercel (with the security checklist) | 🟡 Code part done (2026-10-05); **waiting for the user to create the Turso, ZITADEL Cloud and Vercel accounts** (README "Deploying to Vercel") |
| Phase 7 (optional): online multiplayer | Not started |

Vietnamese rules checks: `npm test` 73/73 (rule tests rewritten for the new rules; 6 rule mutations each caught by a test),
`npm run typecheck` and `npm run build` clean. In headless Chrome at 375px full games were played to a complete ranking:
en with 4 players, vi with 2, ja with 3; switching language mid-game kept the log, tokens and turn identical.
Not yet seen in the browser: the "others are still playing" hint (needs the human to finish while 2+ bots remain).

Earlier Phase 2 checks (international rules): `npm test` 74/74, `npm run typecheck` clean, `npm run build` clean. In headless Chrome at
375px a full game was played to the end in each language (en with 3 bots, vi with 1 bot, ja with 3 bots). Switching
language mid-game re-translated the whole log while the log length, token positions and turn stayed identical. No
horizontal scroll; the board is 343px wide at 375px. Desktop layout (board left, controls and log right) also checked.

## Phase 3 status
Done and verified by me: API (25 tests with fake tokens and an in-memory DB, plus 5 security mutations each caught),
guest mode in 3 languages ("not saved" note in the log), the Log in button redirects to ZITADEL (English login page
for vi), the game still works with ZITADEL stopped, `npm test` 95/95, typecheck and build clean.
Not verifiable without the user's password: a **real login** (JWT token type, the token's `aud` containing
CLIENT_ID, userinfo name, saving a result, language restore). If it fails, the top bar shows the error and the
server log prints `Rejected access token: <reason>`.
Local setup: ZITADEL v4.19.4 via Docker on http://localhost:8080; `.env.local` has the user's CLIENT_ID.

A real game finished while logged in was saved (1 row in `games`, no token rejected), so Phase 3 is complete.

## Phase 5 (done 2026-10-05)
"Reset leaderboards" (admin only) stores `leaderboard_since` in `settings`; nothing is deleted. In ZITADEL v4 the
role reaches the access token only with BOTH project setting "Return user roles during authentication" AND app
setting "Add user roles to the access token", followed by a new login (found while debugging: the token first had
no roles claim). The user's admin account now has the `admin` role; a reset was done once (games kept).

## Phase 4 (done 2026-10-05)
Logged-in games run on the server: a match is stored as its list of actions (`{ roll }` / `{ move }`); the server
rolls (`crypto.randomInt`), validates moves with `lib/game.ts`, plays the bots (`playBots`) and records the
result in the same transaction. `POST /api/games` is gone. Optimistic concurrency on `action_count` (409 CONFLICT),
at most 3 active matches per player, resume after reload (`/api/matches/current`), replay from "My games".
Checks: 112 tests (incl. a full game through the API, ownership, illegal moves, stale writes; 6 anti-cheat mutations,
4 caught directly, 2 unreachable through the API by design, one of those now covered with a crafted stored match),
and an end-to-end run in Chrome with a local test account: full game saved, replay, resume after reload, and
cheat attempts with a real token (fake result 404, illegal move 400, own dice ignored, foreign match 404).
**Local test account:** `ludo-test@example.test` (ZITADEL, local only; the password is not stored in the repo) with a few test games.

## "My games" history (added 2026-10-05)
`GET /api/me/games` returns the player's 20 most recent results (newest first); a "My games" panel shows them when
logged in and reloads after each saved result. API tested (3 tests); the panel itself was not seen yet with a real
login (it is hidden for guests, checked). Replay and resuming an unfinished game are planned for Phase 4.

## Real login check (2026-10-05)
The user logged in with a new account and the admin account. In `data/game.db`: 2 players, no name containing "@",
both with a saved language, **0 games saved** — the "Result saved" path still needs one game finished while logged in
(then: the stats in the top bar go up, the leaderboard shows the player after a 1st place).
Local email: Mailpit catches ZITADEL's emails (http://localhost:8025); the SMTP provider is set up in the Console
with host `localhost:1025`, user/password `ludo`, sender `noreply@ludo.localhost`.

## Board layout (changed 2026-10-05, after Phase 3)
The board now follows the user's reference picture of a traditional Vietnamese board: bases Blue top-left,
Yellow top-right, Red bottom-left, Green bottom-right; tokens move counterclockwise on screen; the track has
56 cells (14 per color, including the 4 cells next to the center); start cells are the edge cells with an arrow;
the center is the single cell [7,7]. Progress model: track 0..55 (55 = home entrance), home steps 56..61.
Drawn with colored track circles, numbered home steps, light bases with thick borders.

## Decisions made on 2026-10-05 (before Phase 3)
- Database schema settled in `docs/02-zitadel.md`: ISO 8601 text timestamps, foreign key, indexes, name refreshed
  on every login, `games.rolls` for the "Fastest wins" leaderboard (human's own rolls, per 2/3/4 players, each
  player's best).
- Display names never use the email address (they are public on the leaderboards); the server reads them from
  ZITADEL's userinfo endpoint.
- Security checklist for public deployment is in Phase 6 of `docs/03-plan.md`; Phase 4 limits unfinished matches.
- ZITADEL's login page has no Vietnamese: send `ui_locales: 'vi en'` for Vietnamese (verified to show English).

## Things learned the hard way
- On Japanese Windows `system-ui` is Yu Gothic UI, which breaks stacked Vietnamese diacritics → `:lang(vi)` font rule.
- Assigning `document.title` is overwritten by React/Next head management → `I18nProvider` renders `<title>`.
- `server-only` throws in plain Node → Vitest aliases it to `test/stubs/server-only.ts`.
- Browser checks drive headless Chrome over the DevTools protocol (Node's built-in `WebSocket`):
  - For a React `<select>`, set the value with the native `HTMLSelectElement` setter and dispatch a bubbling `change` event.
  - To play a full game quickly, inject a `setTimeout` wrapper that shortens delays only while `window.__fast` is true;
    turn it off before comparing snapshots, or bots keep moving between them.
  - Use a fresh Chrome profile: a reused one picked up an extension that logs
    "A listener indicated an asynchronous response..." errors that have nothing to do with the app.
- The Bash tool's heredocs can drop a backslash (`\\` → `\`); write files containing regexes with the Write tool.

## Open decisions (ask the user)
- None right now.
