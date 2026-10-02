# How to use these docs with Claude Code

1. Create an empty folder and copy `CLAUDE.md` and the `docs/` folder into it.
2. Open a terminal in that folder and run `claude`.
3. Paste the prompts below one at a time, each after the previous phase is done and you have checked it.

Phase 1:
> Read CLAUDE.md and everything in docs/. Then do Phase 1 from docs/03-plan.md. Before writing code, give me a short summary of your plan.

Phase 2:
> Do Phase 2. Write the tests for shared/game.js first, then write the code until all tests pass.

Phase 3:
> Do Phase 3. My ZITADEL is running at http://localhost:8080 and I created the Application as described in docs/02-zitadel.md. The Client ID is: <paste Client ID>.

Phases 4, 5, 6:
> Do Phase 4. (same for 5 and 6)

Tips:
- When something breaks, paste the exact error message to Claude Code.
- To change a rule, edit docs/01-game-rules.md first, then tell Claude Code: "The rules changed in docs, update the code and tests to match."
- Put any new standing rules for Claude Code in CLAUDE.md.
- To check translations, ask: "Review vi.js and ja.js against en.js. Flag anything missing, unnatural, or too long for its button."
- To add a language later, ask: "Add Korean (ko) following docs/04-i18n.md."
