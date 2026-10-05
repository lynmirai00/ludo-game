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
| Phase 3: ZITADEL login and saved results | 🟡 Real login confirmed by the user (2026-10-05); **saving a result while logged in not yet tried** |
| Phase 4: anti-cheat | ⏭️ Next after Phase 3 is confirmed |
| Phases 5–7 | Not started |

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
