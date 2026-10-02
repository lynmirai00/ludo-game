# Progress

Last updated: 2026-10-02. Read this first when resuming work.

## Where we are
| Phase (`docs/03-plan.md`) | Status |
|---|---|
| Docs switched to Next.js + TypeScript + libSQL + Vercel | ✅ Done (`975475a`) |
| Phase 1: project skeleton and i18n (Next.js) | ✅ Done, on `main` and pushed (`eff9eea`) |
| Phase 2: game rules and play-vs-bot UI (Next.js) | ⏭️ **Next step.** Not started on Next.js; a finished plain-JS version exists on branch `phase-2-game` |
| Phases 3–7 | Not started |

Phase 1 checks at the time: `npm test` 29/29, `npm run typecheck` clean, `npm run build` clean, `npm run dev` works,
language switching verified in headless Chrome at 375px (title, `<html lang>`, `aria-label`, no reload, choice remembered).

## Next step: Phase 2, ported from branch `phase-2-game`
The branch `phase-2-game` (commit `853486d`) holds a complete, tested Phase 2 in plain JavaScript on top of the old
Express skeleton. It is pushed to `origin/phase-2-game` as a backup. Port it instead of rewriting:

| From `phase-2-game` | To |
|---|---|
| `shared/game.js` | `lib/game.ts` (add types: state, and events as a discriminated union on `type`) |
| `public/js/bot.js` | `lib/bot.ts` |
| `test/game.test.js`, `test/bot.test.js` (75 tests incl. Phase 1) | `test/game.test.ts`, `test/bot.test.ts` (Vitest) |
| `public/js/board.js` | `components/Board.tsx` |
| `public/js/main.js` (game flow, bot timer, log, status) | `components/Game.tsx`, `components/GameLog.tsx` |
| Board/controls/log part of `public/styles.css` | `app/globals.css` |
| Phase 2 locale keys: `game.dice`, `game.lastRoll`, `game.board`, `hint.gameOver`, `token.label` | `lib/i18n/locales/{en,vi,ja}.ts` |

Read a file with e.g. `git show phase-2-game:shared/game.js`.
After the port is done and verified, delete the branch (the user wants old branches cleaned up; see "Open decisions").

## Decisions already made (keep them)
- Stack: Next.js 16 App Router, TypeScript **6.0.3** (TS 7 has no JS compiler API, which `next build` needs),
  Node **22.12+** (Vitest 5), Vitest, `@libsql/client` (local file in dev, Turso in production), deployed on Vercel.
- `next.config.ts` sets `agentRules: false` so `next dev` does not append its own block to `CLAUDE.md`.
- `.gitattributes` pins LF line endings (the machine has `core.autocrlf=true`).
- Rules: a 6 with no legal move passes the turn; extra turns need an actual move (also in `docs/01-game-rules.md`).
- Game setup: the human always plays Red. 1 bot = Red vs Yellow; 3 bots = all four colors. Default is 3 bots.
  The opponents choice applies when "New game" is pressed. Bots wait 0.7–0.9 s per step.
- Browser dice: `crypto.getRandomValues` with rejection sampling (unbiased 1..6). `lib/game.ts` never rolls.
- Bot scoring simulates each move with `applyMove` and inspects the new events, so it never duplicates rules.
- `stats.summary` is composed from plural-aware `stats.wins` and `stats.games`.

## Things learned the hard way
- On Japanese Windows `system-ui` is Yu Gothic UI, which breaks stacked Vietnamese diacritics → `:lang(vi)` font rule.
- Assigning `document.title` is overwritten by React/Next head management → `I18nProvider` renders `<title>`.
- `server-only` throws in plain Node → Vitest aliases it to `test/stubs/server-only.ts`.
- Browser checks were done by driving headless Chrome over the DevTools protocol (Node's built-in `WebSocket`).
  For a React `<select>`, set the value with the native `HTMLSelectElement` setter and dispatch a bubbling `change` event.
  To play a full game quickly in such a check, shorten bot delays by wrapping `setTimeout` in an injected script.
- `docker-compose.yml` (ZITADEL `latest`) has not been started yet; check it at the beginning of Phase 3.

## Open decisions (ask the user)
- Delete branch `phase-2-game`: the user asked to delete old branches. The merged ones are gone; this one was kept
  because it is unmerged and needed for the Phase 2 port. Recommended: after the port, delete it locally and on origin (`git push origin --delete phase-2-game`).
