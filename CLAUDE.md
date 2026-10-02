# Project: Online Ludo with ZITADEL login

## Overview
A web-based Ludo game (known in Vietnam as "Cờ cá ngựa"). The player plays against computer opponents (bots).
The UI is in English by default, and the player can switch between English, Vietnamese and Japanese.
Login is handled by ZITADEL (OpenID Connect). Logged-in players get their results saved
and appear on a leaderboard. Guests can still play, but nothing is saved.

Detailed docs, read these before writing code:
- `docs/01-game-rules.md`: game rules, board data model, cell coordinates
- `docs/02-zitadel.md`: ZITADEL login integration and API protection
- `docs/03-plan.md`: work phases and acceptance criteria
- `docs/04-i18n.md`: multi-language support (English, Vietnamese, Japanese)

## Tech stack
- Node.js 20+, ES modules (`"type": "module"`)
- Backend: Express 4, `jose` (JWT verification), `better-sqlite3` (storage), `dotenv`
- Frontend: plain HTML/CSS/JavaScript (ES modules), no framework, no build step
- Browser auth library: `oidc-client-ts` (UMD build from the jsdelivr CDN, pinned to an exact version)
- Tests: the built-in `node:test` runner, no extra test libraries
- ZITADEL runs via Docker Compose (`docker-compose.yml` in the project root)

## Target folder structure
```
.
├── CLAUDE.md
├── docs/
├── docker-compose.yml        # ZITADEL + PostgreSQL
├── .env.example              # config template; NEVER commit .env
├── package.json
├── src/
│   ├── server.js             # Express setup, route mounting
│   ├── auth.js               # ZITADEL token verification middleware
│   ├── db.js                 # SQLite: players, games tables
│   └── routes/api.js         # /api/* endpoints
├── shared/
│   └── game.js               # PURE GAME LOGIC (no DOM), shared by browser and server
├── public/
│   ├── index.html
│   ├── styles.css
│   └── js/
│       ├── main.js           # page bootstrap
│       ├── board.js          # board and token rendering
│       ├── bot.js            # bot move selection
│       ├── auth.js           # login/logout via oidc-client-ts
│       ├── i18n.js           # t() function, language detection and switching
│       └── locales/
│           ├── en.js         # English (default, source of truth for keys)
│           ├── vi.js         # Vietnamese
│           └── ja.js         # Japanese
└── test/
    ├── game.test.js
    ├── api.test.js
    └── i18n.test.js
```
Express must serve `shared/` statically at `/shared` so the browser can import it.

## Common commands
- `docker compose up -d`: start ZITADEL (http://localhost:8080)
- `npm install`
- `npm start`: run the game (http://localhost:3000)
- `npm run dev`: run with `node --watch`
- `npm test`: run all tests

## Coding rules
- All code, comments, docs, commit messages and the README are in English.
- **Never hardcode user-facing text.** Every visible string goes through `t('key')` from `public/js/i18n.js`, with translations in `public/js/locales/{en,vi,ja}.js`. This includes button labels, the game log, color names, error messages, `aria-label`s and the page `<title>`. See `docs/04-i18n.md`.
- Vietnamese text must use full diacritics. Japanese text uses natural, polite UI Japanese (です/ます style for messages).
- Game rules live only in `shared/game.js`, written as pure functions (take a state, return a new state). Never call `Math.random` inside it; take the dice value as a parameter so it is testable.
- Every change to `shared/game.js` needs matching tests in `test/game.test.js`.
- Never put the Client ID, passwords or secrets in code. All config comes from `.env`.
- The server never returns translated text. API errors return a stable `code` (e.g. `{ "error": { "code": "UNAUTHORIZED" } }`) and the browser translates it.
- Never trust data from the browser: the server always takes the player's identity from the `sub` claim of a verified token, never from the request body.
- Do not store tokens in `localStorage` by hand; let `oidc-client-ts` manage them.
- The UI must work on phones (the board scales to the screen width, down to 375px), in all three languages (translated strings can be longer or shorter than English; layouts must not break).
- After each phase in `docs/03-plan.md`: run `npm test`, fix every failure, then report back.
