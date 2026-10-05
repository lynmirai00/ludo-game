# Progress

Last updated: 2026-10-05 (after the switch to Vietnamese rules). Read this first when resuming work.

## Where we are
| Phase (`docs/03-plan.md`) | Status |
|---|---|
| Docs switched to Next.js + TypeScript + libSQL + Vercel | ✅ Done |
| Phase 1: project skeleton and i18n | ✅ Done |
| Phase 2: game rules and play-vs-bot UI | ✅ Done (ported from the plain-JS branch `phase-2-game`) |
| Switch to Vietnamese "Cờ cá ngựa" rules, ranking, 3-player games | ✅ Done (2026-10-05) |
| Phase 3: ZITADEL login and saved results | ⏭️ **Next step** |
| Phases 4–7 | Not started |

Vietnamese rules checks: `npm test` 73/73 (rule tests rewritten for the new rules; 6 rule mutations each caught by a test),
`npm run typecheck` and `npm run build` clean. In headless Chrome at 375px full games were played to a complete ranking:
en with 4 players, vi with 2, ja with 3; switching language mid-game kept the log, tokens and turn identical.
Not yet seen in the browser: the "others are still playing" hint (needs the human to finish while 2+ bots remain).

Earlier Phase 2 checks (international rules): `npm test` 74/74, `npm run typecheck` clean, `npm run build` clean. In headless Chrome at
375px a full game was played to the end in each language (en with 3 bots, vi with 1 bot, ja with 3 bots). Switching
language mid-game re-translated the whole log while the log length, token positions and turn stayed identical. No
horizontal scroll; the board is 343px wide at 375px. Desktop layout (board left, controls and log right) also checked.

## Next step: Phase 3
Before starting, the user needs to:
1. `docker compose up -d` (not run yet; ZITADEL image is `latest`, so check that it starts).
2. Create the Project and Application in the ZITADEL Console as in `docs/02-zitadel.md`, and put `CLIENT_ID` in `.env.local`.
Then: `lib/auth-client.ts`, `lib/server/auth.ts`, `lib/server/db.ts` (libSQL), the API route handlers, the login UI,
saving results, the leaderboard, and `PUT /api/me/locale`. From Phase 3 on, a missing `CLIENT_ID` must stop the server
on startup (`validateConfig()` in `lib/server/config.ts` currently only warns).

## Decisions already made (keep them)
- Stack: Next.js 16 App Router, TypeScript **6.0.3** (TS 7 has no JS compiler API, which `next build` needs),
  Node **22.12+** (Vitest 5), Vitest, `@libsql/client` (local file in dev, Turso in production), deployed on Vercel.
- `next.config.ts` sets `agentRules: false` so `next dev` does not append its own block to `CLAUDE.md`.
- `.gitattributes` pins LF line endings (the machine has `core.autocrlf=true`).
- Rules: Vietnamese "Cờ cá ngựa" only (international Ludo was dropped at the user's request). See `docs/01-game-rules.md`.
  A 1 or a 6 always gives another roll, even without a move. Captures give no extra roll. No safe cells.
- Ranking: play continues after the first finisher; the last player left takes the last place. The human's result
  is known when their place is decided; bots then keep playing and "New game" skips the rest.
  The leaderboard counts 1st places. `games` stores `place` and `players` (see `docs/02-zitadel.md`).
- Game setup: the human always plays Red. 1 bot = Red, Yellow; 2 bots = Red, Green, Yellow; 3 bots = all four. Default is 3 bots.
  The opponents choice applies when "New game" is pressed. Bots wait 0.7–0.9 s per step.
- Browser dice: `crypto.getRandomValues` with rejection sampling (unbiased 1..6). `lib/game.ts` never rolls.
- `lib/game.ts` types: `Color` and `TokenIndex` are `0 | 1 | 2 | 3`, token rows are 4-tuples, events are a
  discriminated union. `applyMove` takes a plain `number` (it may come from an untrusted client in Phase 4) and throws
  `IllegalMoveError` (`code: 'ILLEGAL_MOVE'`) for anything that is not a legal move.
- Bot priorities: climb/enter the home column > capture > leave base > stop on the home entrance > progress.
- Bot scoring simulates each move with `applyMove` and inspects the new events, so it never duplicates rules.
- The bot timer lives in a `useEffect` that depends only on the game state, so a language change never interrupts it.
  Keyboard focus moves (to Roll or the first movable token) only after game steps, never on language changes.
- All tests use Vitest's `expect`.
- `stats.summary` is composed from plural-aware `stats.wins` and `stats.games`.

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
- Delete branch `phase-2-game` (locally and on origin): the port is done, so it is no longer needed.
  The user asked earlier to delete old branches; confirm before deleting.
