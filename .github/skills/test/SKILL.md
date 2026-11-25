---
name: test
description: 'Use when running, adding, or updating automated tests or Obsidian visual verification in Wiki Paste.'
user-invocable: true
---

# Wiki Paste Testing

1. Run unit tests with `npm test` (runs all `tests/*.test.mjs` via `tsx --test`) and static type checking with `npm run typecheck`.
2. For targeted edits during iteration, run the owning test file directly, e.g. `npx tsx --test tests/<module>.test.mjs`, then run full `npm test` before delivery.
3. For runtime UI, Canvas sizing, or live paste/rendering changes, build and distribute (`npm run build && npm run distribute`) and verify in the Candidate Obsidian vault (`E:\GameDevVault`).
