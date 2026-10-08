---
name: version-management
description: 'Wiki Paste 项目改动的自动版本管理入口，也用于用户要求升版本、bump version、选择版本号、校验版本/tag，或准备发版/release；适配当前仓库已有的版本策略、版本源和工具链。'
---

# Version Management

Apply this workflow to the repository in the current workspace. Discover its conventions instead of assuming a language, package manager, manifest path, version format, or release process.

## Wiki Paste Change Policy

- Only changes under `src/` automatically trigger version management and its mandatory build-distribute workflow. Changes outside `src/`, including tests, Markdown documents, manifests, styles, configuration, and tooling, do not trigger it by themselves. An explicit user request to bump or publish a version still triggers the workflow.
- Preserve the existing major and minor components. This repository currently uses a three-component numeric version such as `0.1.30`; the next change is `0.1.31`, not a reset to `0.0.x`.
- Apply one increment per delivery, not per file, hunk, build, or distribution step. If the current delivery already has a version bump, reuse it.

This workflow manages versions and then invokes the mandatory build-distribute workflow. It does not run tests; use `/test` for testing.

## Mandatory Build-Distribution

- Every completed version change must immediately run the complete `build-distribute` workflow after synchronized version declarations are updated, including version-only changes and non-functional deliveries.
- `build-distribute` is indivisible: it must run `npm run build` and then distribute the resulting package to the requested target, or `Candidate` when no target is specified. A successful build without distribution is an incomplete workflow.
- Do not make build or distribution optional based on whether runtime behavior changed. Do not increment the version again during build-distribute.

## When to Use

- For Wiki Paste, run automatically when a delivery changes files under `src/`; do not trigger it for non-`src` changes alone.
- The user asks to bump, choose, inspect, or validate a version.
- A release, package, or deployment needs a version decision.
- The user asks whether a change warrants a version update.

## Workflow

1. Identify the target package or deployable component. In a monorepo, do not bump unrelated packages; ask if the target is ambiguous.
2. Inspect nearby project guidance, manifests, build/release scripts, version tests, and relevant Git tags. Use the current repository's instructions as the source of truth.
3. Find the canonical editable version source and any synchronized version declarations. Distinguish source files from generated artifacts; do not edit generated output directly unless the project explicitly requires it.
4. Determine the established version scheme (for example SemVer, CalVer, or a custom format) and release channel. Apply constraints in this order: hard requirements from the target ecosystem/tooling, repository policy, then general versioning guidance. Preserve the required format; do not impose SemVer or a new policy when the repository already defines one. If an ecosystem requires three numeric components (for example, Obsidian's `MAJOR.MINOR.PATCH` format), never add a fourth component such as `0.0.0.0` for internal bookkeeping.
5. For Wiki Paste, increment the final numeric component once when a delivery changes files under `src/`. Non-`src`-only deliveries do not need a bump or automatic build-distribute. An explicit user request to change or release a version overrides this automatic trigger boundary. For other repositories, decide whether this delivery needs a bump according to that repository's policy and user intent.
6. Choose the increment required by repository policy. Refer to [version examples](./version-examples.md) only as general guidance; repository-specific policy takes precedence.
	Treat one requested delivery as one versioning decision. When a bump is
	required, start from the current working-tree version and apply the required
	increment only once. Do not increment again because the delivery touches
	multiple files or hunks, or passes through multiple workflow steps such as
	building, distributing, reloading, or publishing. If the version was already
	bumped for that same delivery, reuse it; another increment requires a distinct
	delivery or an explicit user request.
7. Keep one current version in the source tree and generated distribution directory: update the canonical source and only related declarations or changelog entries required by the project. Do not keep parallel version snapshots or historical source copies in the repository, and remove stale versioned build directories after a successful build. Let Git tags and GitHub Releases retain and manage published versions; generated release assets may be produced temporarily as required by the release workflow. Avoid introducing duplicate version sources.
8. Verify version-format constraints and synchronized version declarations. Check that the proposed release identifier is not already assigned to a tag or release, comparing tags using the project's version semantics rather than lexical ordering alone. Then invoke the complete build-distribute workflow; do not stop after version validation or build alone.
9. Keep versioning separate from publishing. Do not commit, create/push tags, or publish a release unless explicitly requested. When publishing is requested, follow the repository's release workflow.

Preserve unrelated working-tree changes. Do not stage or include them as part of version management. Report the selected component, old and new versions, files changed, validation performed, and any assumptions or release steps not performed.