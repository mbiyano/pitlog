# PitLog — Claude entry point

The repository-wide instructions live in `AGENTS.md`. Read it before making changes.

Then read the shared context relevant to the task:

- `.claude/context/PRODUCT.md` — users, language, domain, and invariants.
- `.claude/context/ARCHITECTURE.md` — runtime flows, module boundaries, and data model.
- `.claude/context/ENGINEERING.md` — setup, commands, verification, and known debt.

These files describe the current implementation. When code and context diverge, verify the code, fix the documentation in the same change, and call out the discrepancy.
