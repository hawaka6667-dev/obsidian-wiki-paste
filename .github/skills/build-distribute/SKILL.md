---
name: build-distribute
description: 'Use when a Wiki Paste change needs a local build or distribution, or when the user requests one, such as “快速分发” or “build-distribute”. Not for GitHub Releases.'
user-invocable: true
---
src改动才触发版本管理

# Build and Distribute Quickly

Use this workflow when a project change should be built or delivered to an Obsidian vault, or when the user explicitly asks for a build/distribution. For runtime changes, version management owns the version increment and should run first; this skill consumes that version and must not make another version decision.

Choose only the build and distribution steps that fit the request and current working tree. Local distribution is commonly useful after runtime changes so the user can test in Obsidian, but it is not mandatory for every project change. Do not run tests here; use `/test` when testing is requested or required. Do not impose unrelated build or distribution steps, and honor an explicitly named target. The usual commands are `npm run build` and `pwsh -File .dist/distribute.ps1 -Target Candidate`; `Candidate` resolves to `MainVaultPath` in `.publish-config.json` or `E:\GameDevVault` when no config exists.

This skill handles local delivery, not GitHub releases or A/B acceptance. Report the relevant build/distribution outcome and any blocker briefly.