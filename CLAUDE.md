# Project: Online Ludo with ZITADEL login

## Overview
A web-based Ludo game (known in Vietnam as "Cờ cá ngựa"). The player plays against computer opponents (bots).
The UI is in English by default, and the player can switch between English, Vietnamese and Japanese.
Login is handled by ZITADEL (OpenID Connect). Logged-in players get their results saved
and appear on a leaderboard. Guests can still play, but nothing is saved.
The app is deployed to Vercel.

**When resuming work, read `docs/PROGRESS.md` first** (current status, next step, decisions made), and update it at the end of each phase.

Detailed docs, read these before writing code:
- `docs/01-game-rules.md`: game rules, board data model, cell coordinates
- `docs/02-zitadel.md`: ZITADEL login integration, API protection, database, deployment
- `docs/03-plan.md`: work phases and acceptance criteria
- `docs/04-i18n.md`: multi-language support (English, Vietnamese, Japanese)

## Tech stack
- Node.js 22.12+ (required by Vitest), TypeScript 6 in `strict` mode (not TypeScript 7: it has no JS compiler API, which `next build` needs)
- Next.js 16 (App Router) for both the UI and the API (route handlers under `app/api/`); no separate backend server.
  Next.js 16 has breaking changes compared to older versions: check the bundled guides in `node_modules/next/dist/docs/` before using an API you are unsure about.
- React for the UI; plain CSS (`app/globals.css`, CSS Modules where useful), no UI framework
- `jose` (JWT verification), `@libsql/client` (storage: a local SQLite file in development, Turso in production)
- Browser auth library: `oidc-client-ts` from npm, pinned to an exact version
- Tests: Vitest
- Hosting: Vercel. ZITADEL runs via Docker Compose for local development only (`docker-compose.yml`);
  production uses a ZITADEL instance reachable from the internet (e.g. ZITADEL Cloud)

## Target folder structure
```
.
├── CLAUDE.md
├── docs/
├── docker-compose.yml          # local ZITADEL + PostgreSQL (development only)
├── .env.example                # config template; NEVER commit .env or .env.local
├── package.json
├── tsconfig.json
├── next.config.ts
├── vitest.config.ts
├── instrumentation.ts          # validates server config on startup
├── app/
│   ├── layout.tsx              # <html>, I18nProvider
│   ├── page.tsx                # the game page
│   ├── globals.css
│   └── api/                    # route handlers, see docs/02-zitadel.md
│       ├── config/route.ts
│       ├── me/route.ts
│       ├── me/locale/route.ts
│       ├── games/route.ts
│       └── leaderboard/route.ts
├── components/                 # client components ("use client")
│   ├── AppShell.tsx            # header (login or name, ☰), menu drawer, pages covering the game
│   ├── AuthProvider.tsx        # login state, API calls with the token
│   ├── LanguageSwitcher.tsx
│   ├── Game.tsx                # game flow: rolls, bot turns, game state
│   ├── Board.tsx               # board and token rendering
│   ├── GameLog.tsx
│   ├── Leaderboard.tsx         # page: most wins / fastest wins (+ admin reset)
│   ├── MyGames.tsx             # page: the player's results (+ Replay.tsx)
│   ├── Account.tsx             # page: name, stats, "Your data", log out
│   └── Rules.tsx               # page: how to play
├── lib/
│   ├── game.ts                 # PURE GAME LOGIC (no DOM, no React), shared by client and server
│   ├── bot.ts                  # bot move selection (pure)
│   ├── auth-client.ts          # login/logout via oidc-client-ts (browser only)
│   ├── i18n/
│   │   ├── index.ts            # t(), detectLanguage(), plurals (pure, no React)
│   │   ├── I18nProvider.tsx    # React context and useI18n()
│   │   └── locales/
│   │       ├── en.ts           # English (default, source of truth for keys)
│   │       ├── vi.ts           # Vietnamese
│   │       └── ja.ts           # Japanese
│   └── server/                 # server-only code (starts with `import 'server-only'`)
│       ├── config.ts           # reads and validates environment variables
│       ├── auth.ts             # ZITADEL token verification
│       ├── db.ts               # libSQL: players, games tables
│       └── errors.ts           # ApiError and JSON error responses
└── test/
    ├── game.test.ts
    ├── bot.test.ts
    ├── api.test.ts
    └── i18n.test.ts
```

## Common commands
- `docker compose up -d`: start ZITADEL locally (http://localhost:8080)
- `npm install`
- `npm run dev`: run the game in development (http://localhost:3000)
- `npm run build` then `npm start`: production build and server
- `npm test`: run all tests (Vitest)
- `npm run typecheck`: `tsc --noEmit`

## Coding rules
- All code, comments, docs, commit messages and the README are in English.
- **Never hardcode user-facing text.** Every visible string goes through `t('key')` (from `useI18n()` in components), with translations in `lib/i18n/locales/{en,vi,ja}.ts`. This includes button labels, the game log, color names, error messages, `aria-label`s and the page title. See `docs/04-i18n.md`.
- Vietnamese text must use full diacritics. Japanese text uses natural, polite UI Japanese (です/ます style for messages).
- Game rules live only in `lib/game.ts`, written as pure functions (take a state, return a new state). Never call `Math.random` inside it; take the dice value as a parameter so it is testable. It must not import React, Next.js or anything browser- or server-specific.
- Every change to `lib/game.ts` needs matching tests in `test/game.test.ts`.
- TypeScript `strict` mode. No `any` without a comment explaining why. Shared types (game state, events, API responses) are exported from the module that owns them.
- Mark a component `"use client"` only when it needs state, effects or browser APIs.
- Code in `lib/server/` starts with `import 'server-only'` and is never imported by client components.
- Never put the Client ID, passwords or secrets in code. All config comes from environment variables (`.env.local` locally, Vercel project settings in production). Do not expose server config through `NEXT_PUBLIC_*` variables; the browser gets what it needs from `GET /api/config`.
- The server never returns translated text. API errors return a stable `code` (e.g. `{ "error": { "code": "UNAUTHORIZED" } }`) and the browser translates it.
- Never trust data from the browser: the server always takes the player's identity from the `sub` claim of a verified token, never from the request body.
- Never show an email address publicly (leaderboards, logs); see "Display name" in `docs/02-zitadel.md`.
- Do not store tokens in `localStorage` by hand; let `oidc-client-ts` manage them.
- The server runs on Vercel serverless functions: no state may live in memory between requests. Anything that must survive a request (players, games, matches) goes in the database.
- The UI must work on phones (the board scales to the screen width, down to 375px), in all three languages (translated strings can be longer or shorter than English; layouts must not break).
- After each phase in `docs/03-plan.md`: run `npm test`, `npm run typecheck` and `npm run build`, fix every failure, then report back.
