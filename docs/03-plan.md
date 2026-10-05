# Work plan

Work through the phases in order. After each phase: run `npm test`, `npm run typecheck` and `npm run build`,
check the acceptance criteria below, summarize what you did, then STOP and wait for the user to confirm before continuing.

## Phase 1: Project skeleton
- Create a Next.js (App Router) + TypeScript project: `package.json` (scripts: dev, build, start, test, typecheck),
  `tsconfig.json` (strict), `vitest.config.ts`, `.gitignore` (node_modules, .next, .env*, data/; keep `.env.example`),
  `.gitattributes` (LF line endings), `.env.example`, and `docker-compose.yml` as in `docs/02-zitadel.md`.
- `lib/server/config.ts`, `instrumentation.ts`, and the route handler `GET /api/config`.
- Set up i18n as described in `docs/04-i18n.md`: `lib/i18n/index.ts`, `I18nProvider.tsx`, the three locale files,
  the language switcher in the top bar, and `test/i18n.test.ts`.
- `app/page.tsx` shows the translated app title and the language switcher.

Done when: `npm run dev` and `npm run build && npm start` work, http://localhost:3000 shows the page,
`/api/config` returns JSON, and switching language changes the title instantly without a page reload.

## Phase 2: Game rules and play-vs-bot UI
- Write `lib/game.ts` following `docs/01-game-rules.md`, with every test from "Minimum tests for the game rules".
- Draw the 15x15 board with CSS Grid: colored bases, home columns, start cells and star cells.
- A "Roll" button; movable tokens pulse and are clickable.
- Choose the number of bots (1, 2 or 3) and a "New game" button.
- A "Fast bots" toggle that speeds up the bots (see "Bot" in `docs/01-game-rules.md`).
- Show the ranking as players finish; after the human's place is decided the bots keep playing for the remaining places.
- A "Game log" panel with the newest events on top. The game engine emits structured events and the UI translates them (see `docs/04-i18n.md`), so switching language mid-game re-renders the whole log in the new language.
- All text goes through `t()`; add every new key to all three locale files.
- Bot logic in `lib/bot.ts` as described in `docs/01-game-rules.md`.

Done when: a full game can be played in the browser in each of the three languages; `npm test` passes; the board looks right on a 375px-wide screen.

## Phase 3: ZITADEL login and saved results
- `lib/auth-client.ts`, `lib/server/auth.ts`, `lib/server/db.ts`, `lib/server/errors.ts` and the API route handlers from `docs/02-zitadel.md`.
- Top bar: when logged out, show "Log in to save your results" and a "Log in" button; when logged in, show the name, wins/games, and a "Log out" button.
- As soon as the human's place is decided: if logged in, send `{ place, players, rolls }` (`rolls` = the human's own rolls in that game); if not, add "You're not logged in, so this result wasn't saved." to the game log.
- A "My games" panel, only when logged in: the player's 20 most recent results (date and time, number of players,
  place, rolls), newest first, from `GET /api/me/games`; it refreshes after each saved result.
- A "Leaderboard" panel with two tabs: "Most wins" (top 10) and "Fastest wins" (fewest rolls to finish 1st,
  with a tab each for 2, 3 and 4 players). See "Leaderboards" in `docs/02-zitadel.md`.
- Pass `ui_locales` to ZITADEL on login; save the language to the player's profile with `PUT /api/me/locale` and restore it on login (see `docs/04-i18n.md`).
- From this phase on, a missing `CLIENT_ID` stops the server on startup with a clear error.
- Update the README with the local ZITADEL setup steps.

Done when: API tests pass (using fake tokens and an in-memory database); real login against ZITADEL at localhost:8080 works; finishing a game in 1st place updates the leaderboard.

## Phase 4: Anti-cheat (game logic runs on the server)
Right now the browser reports the human's place itself, so it can cheat. Change to:
- The endpoints and rules are in "Matches" in `docs/02-zitadel.md`: `POST /api/matches`, `GET /api/matches/current`,
  `GET /api/matches/:id`, `POST /api/matches/:id/roll` (the server rolls with `crypto.randomInt` and plays the bots),
  `POST /api/matches/:id/move` (`{ token }`, validated with `lib/game.ts`).
- Matches are stored in the database as the list of actions (rolls and moves), never in memory:
  on Vercel each request may run on a different instance. Only the match's owner may see, roll or move.
- The server records the human's place and roll count itself as soon as the place is decided. Remove `POST /api/games`.
- Guest games (not logged in) still run entirely in the browser as before and are not saved.
- Because the actions are stored, a finished game can be **replayed** step by step from "My games"
  (play/pause, previous/next step, a slider).
- An unfinished match **survives a page reload**: on load, a logged-in player gets back their latest unfinished
  match instead of a new game.
- Limit unfinished matches per player (e.g. at most 3; starting a new one abandons the oldest) so nobody can
  fill the database by creating matches in a loop.

Done when: it is impossible to record a win by calling the API directly without actually playing; there are tests for illegal moves, for another player's token trying to act on someone else's match, for a full game played through the API recording exactly one result, and for stale writes (`409 CONFLICT`); a logged-in game survives a reload and can be replayed.

## Phase 5: Admin role
Follow the "Permissions" section in `docs/02-zitadel.md`.

"Reset leaderboards" only resets the two leaderboards (see "Leaderboards" in `docs/02-zitadel.md`); no game data is deleted.

Done when: an account with the admin role sees and can use "Reset leaderboards"; a normal account does not see it
and gets 403 from the API; players keep their history and stats after a reset.

## Phase 6: Deploy to Vercel
Follow "Deployment to Vercel" in `docs/02-zitadel.md`.
- Make sure nothing depends on the local filesystem or in-memory state.
- Document in the README: creating the ZITADEL Cloud application, the Turso database, and the Vercel environment variables.
- `DELETE /api/me` deletes the player and all their games, with a "Delete my data" button and a short note in all
  three languages about what is stored (player ID, display name, language, game results).

Security checklist (all must be done before the deployed app is shared publicly):
(Done in code on 2026-10-05: Phase 4, no emails in names, security headers with a nonce-based CSP in `proxy.ts`,
no CORS headers, `npm audit` clean, `DELETE /api/me`, and a startup check that refuses a local database or an
http ZITADEL on Vercel. The remaining items are settings in ZITADEL Cloud and Vercel; see "Deploying to Vercel" in the README.)
- Phase 4 is done: before it, any logged-in user can post a fake result and top both leaderboards.
- Names: the leaderboards never show an email address (see "Display name" in `docs/02-zitadel.md`).
- ZITADEL Cloud: Development Mode off; Redirect and Post Logout URIs list only the exact production URL (no wildcards,
  no preview URLs); email verification on for self-registration, and captcha or invite-only if fake accounts show up.
- Vercel: secrets (`DATABASE_AUTH_TOKEN`) marked sensitive and never in git; Preview deployments use a separate
  Turso database (or none), never the production one; a rate limit rule in Vercel Firewall for `/api/*`.
- Security headers in `next.config.ts`: Content-Security-Policy (`oidc-client-ts` keeps tokens in
  `sessionStorage`, so an XSS would leak them; allow only this origin and the ZITADEL URL), `frame-ancestors 'none'`,
  `Referrer-Policy: strict-origin-when-cross-origin`, `X-Content-Type-Options: nosniff`.
- No permissive CORS on `/api/*` (the API is same-origin only).
- Dependencies: `npm audit` clean of high/critical issues and Next.js on its latest patch release before deploying.

Done when: the deployed app on Vercel can be played as a guest, login works against the production ZITADEL, results are saved to Turso, and every item of the security checklist is done.

## Phase 7 (optional): Online multiplayer
- Game rooms with a 6-character code, 2 to 4 human players, empty seats filled by bots.
- Vercel serverless functions cannot hold WebSocket connections. Before starting, decide with the user between
  a separate WebSocket server (the `ws` library, hosted outside Vercel) and a managed realtime service.
- The client sends the access token on connect and it is verified like the API.
- The server is the single source of truth for game state.
- If a player is disconnected for 30 seconds, a bot plays for them.
