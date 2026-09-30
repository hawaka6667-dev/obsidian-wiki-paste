---
name: wiki-paste-development-reload
description: 'MANDATORY for Wiki Paste code and metadata changes, and build, package, distribution, reload, release, or publish requests. Use focused source validation for routine edits, but close runtime behavior fixes by building and updating/reloading the affected local vault. GitHub publishing requires an explicit request. 中文触发词包括：改代码、加功能、修 bug、调试、重构、打包、分发、重载、本地 vault、发布、发版。'
user-invocable: true
---

# Wiki Paste: Fast Development and Delivery

## Mandatory trigger

Load this Skill before the first edit whenever a task will change Wiki Paste
plugin code or metadata. This includes adding features, fixing bugs, debugging,
refactoring, updating the plugin, and changing its settings or manifest. Use the
fast path for routine edits. Run delivery steps only when requested or needed to
validate the requested outcome. Users can invoke this workflow directly as
`/wiki-paste-development-reload`.

## Task continuity

- A self-contained side request during an unfinished Wiki Paste task does not
   cancel or replace the pending task. Complete the side request, then resume
   the unfinished task unless the user explicitly pauses, cancels, or redirects
   it. Do not end the turn by reporting only the side request as complete.

## Routine code changes

Use this as the default path for code edits that do not request publishing.
Routine edits still need local runtime closure when the requested outcome is an
Obsidian behavior change; source tests alone do not update the installed bundle.
Source and installed-bundle divergence is a correctness risk: Obsidian can keep
running stale behavior after the source is fixed, causing the bug to persist or
making diagnosis point at the wrong code. Do not report an Obsidian behavior
fix complete until the affected enabled vault has loaded the matching bundle.

1. For every non-documentation plugin code change (feature, bug fix, or refactor),
   increment the patch version by exactly `0.0.1` once per requested change.
   Follow the `version-management` skill: start from the current working-tree
   version and reuse an existing bump for this same change. Do not bump again
   when later building or publishing it. Documentation-only changes do not need
   a bump.
2. Update `package.json`, the root `package-lock.json` version and root package
   entry, and root `manifest.json` together. Verify the declarations agree.
3. Choose validation scope using the Development Workflow section in
   `helper.md`. This workflow adds no broader test requirement for routine
   changes.
4. For a change to `src/` that fixes or adds behavior expected to work in
   Obsidian, run `npm run build` and distribute to the vault where that behavior
   is being tested. For routine local verification, use `Test` (the workspace
   vault) unless the user identifies another target. Verify the target against
   `.publish-config.json` and Obsidian's vault registry through the selected
   distribution script; do not run duplicate manual lookups. Never guess a
   target: use the requested target or the workspace Test target. Do not default
   routine fixes to `Both` or update the main vault unless requested or it is
   the identified test target.
5. Use `.dist/distribute.ps1 -Target <Test|Main|Both>` for this runtime closure.
   Trust the script's built-in target, copy, hash, enabled-state, and reload
   checks and its reported result. Do not repeat them manually with extra CLI
   queries or a second hash comparison. A reported `Reloaded: wiki-paste` means
   runtime closure is complete. If the script reports the plugin is disabled,
   do not enable it; report that runtime behavior remains inactive until the
   user enables/reloads it. Stop and report any failed build or script run.
6. If the request is explicitly source-only, documentation/test-only, or the
   user asks not to touch a vault, skip local runtime closure and state that the
   installed Obsidian bundle was not updated. Report focused validation and any
   important check intentionally omitted.

## Explicit build and local delivery

1. For an explicit build or package request, run `npm test`, `npm run typecheck`,
   and `npm run build`. Verify `.dist/<version>/` contains `main.js` and
   `manifest.json` with the expected plugin ID and version.
2. Distribute or reload for explicit local delivery requests. Use the target
   resolution and safety checks built into the selected script; do not add
   duplicate manual registry, enabled-state, or post-copy hash checks. If the
   user specifies a target, use it. For an unspecified explicit local delivery,
   use `Both`. Routine runtime closure follows step 4 above and defaults only to
   the identified test vault.
3. Use `.dist/distribute.ps1` only for requested targets. Its output reports
   copy/hash results and whether each enabled plugin was reloaded; rely on that
   output instead of repeating those checks. For an explicitly requested
   standalone reload, run `.dist/reload.ps1 -Target <Test|Main|Both>` directly
   and report its result without separate preflight or post-reload checks. Stop
   and report a failed script run instead of claiming delivery is complete.
4. Do not repeat tests, builds, distributions, or reloads if they already
   succeeded for the exact same source and version in the current task.

## Obsidian enable state

- `.dist/distribute.ps1` always copies versioned plugin files and verifies their
   hashes, regardless of enabled state. It must not edit
   `.obsidian/community-plugins.json` or call `plugin:enable` / `plugin:disable`.
- The user controls whether each vault enables the plugin through Obsidian.
   Distribution reloads the plugin only when it is currently enabled; disabled
   vaults remain disabled and skip reload. On first install, restart Obsidian once
   if it has not scanned the plugin folder yet; do not enable the plugin on the
   user's behalf.

## GitHub publish

Only run this section when the user explicitly requests publishing/releasing.
Local build, distribution, and reload do not publish anything to GitHub.

1. Ensure `npm test`, `npm run typecheck`, and `npm run build` succeeded for this
   exact source and version; reuse successful results from the current task.
   Check `gh auth status`, the configured `origin`, current branch/worktree, and
   existing remote tags/releases. Do not overwrite an existing release
   identifier or bump a second time just for GitHub publishing.
2. Review the worktree. Stage and commit only files belonging to this release;
   preserve unrelated user edits unstaged and unmodified.
3. Push the release commit to the intended branch, then create the GitHub
   release using the same version as its tag and title. Follow the repository's
   prior release asset convention: upload `.dist/<version>/main.js` and
   `.dist/<version>/manifest.json`.
4. Verify the release URL, tag, and both uploaded assets with `gh release view`.
5. After the release is verified, run `.dist/distribute.ps1 -Target Both` and
   `.dist/reload.ps1 -Target Both` once, then report both vault results and the
   GitHub release URL. Do not perform a duplicate pre-publish deployment unless
   the user explicitly asks to verify the plugin in their vaults first.

Never commit, push, tag, or publish unless explicitly requested. If auth,
remote state, vault identity, or an asset cannot be verified, stop and report
the blocker. Do not treat a GitHub release as a substitute for updating either
local vault, or vice versa.