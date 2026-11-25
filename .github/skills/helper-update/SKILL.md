---
name: helper-update
description: 'Update helper.md or AGENTS.md when Wiki Paste architecture, settings, modules, or verification commands change.'
---

# Update Documentation (`helper.md` / `AGENTS.md`)

1. Verify current source files, `package.json` scripts, and `tests/*.test.mjs` before editing docs; never document planned or unverified behavior as active.
2. Keep `AGENTS.md` focused on essential commands, Obsidian review constraints, and repo conventions.
3. Keep `helper.md` focused on current settings contract, runtime dispatch order, accurate `src/` + `tests/` file map, and build/distribution workflow.
4. Do not duplicate test case lists or raw source code inside `helper.md`.
