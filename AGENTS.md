# Wiki Paste — Agent Guide

Obsidian community plugin (`wiki-paste`, min Obsidian `1.5.0`) built with TypeScript + `esbuild` and tested with Node `tsx --test` + `jsdom`.

## Essential Commands

```sh
npm test              # Run all tests in tests/*.test.mjs
npm run typecheck     # tsc --noEmit
npm run build         # Bundle src/wiki-paste-plugin-entry.ts -> .dist/<version>/main.js
npm run distribute    # Deploy .dist/<version>/ to Candidate vault (E:\GameDevVault) and hot-reload
```

## Git & Release Workflow (Agent-Managed)

- Use standard `git` (`git status`, `git add`, `git commit` with Conventional Commits, `git push origin main`) and `gh release create <version> .dist/<version>/main.js .dist/<version>/manifest.json .dist/<version>/styles.css --title "Wiki Paste <version>" --generate-notes`.
- **Version & Delivery**: Any change under `src/` requires bumping the patch version across `package.json`, `manifest.json`, and `package-lock.json`, then running `npm test && npm run typecheck && npm run build && npm run distribute`.

## Architecture & Conventions

- **Entry & Settings**: [src/wiki-paste-plugin-entry.ts](src/wiki-paste-plugin-entry.ts) wires listeners and commands; [src/settings.ts](src/settings.ts) owns settings schema, defaults, and `PluginSettingTab`.
- **Shared Helpers**: [src/shared/editor-target.ts](src/shared/editor-target.ts) owns `isCanvasView`, `findCanvasNodeForTarget`, and `resolveActiveCmEditor`; [src/shared/issue-report.ts](src/shared/issue-report.ts) builds pre-filled GitHub Issue URLs.
- **Obsidian API Constraints** (enforced by Obsidian Community Plugins review):
  - Never use `document.createElement`, `insertAdjacentHTML`, `globalThis`, `setTimeout`, `activeLeaf`, `navigator` OS detection, inline `element.style.*` static assignments, or regex lookbehinds (iOS < 16.4 compatibility).
  - Use `Platform.isMacOS`, `window.setTimeout`, `createEl`/`createDiv`/`createSpan`/`createFragment`, `new Setting(containerEl).setName(...).setHeading()`, and CSS classes in `styles.css`.
  - Keep runtime `"obsidian"` value imports in `src/wiki-paste-plugin-entry.ts` / `src/settings.ts`; pass dependencies like `htmlToMarkdown`, `Menu`, and `Platform.isMacOS` into feature modules so unit tests run cleanly in Node without mocking `"obsidian"`.
- **Source Headers**: Start every `src/*.ts` file with a concise `// @machine:` comment describing its inputs, outputs, and dependencies.
- **Module Contracts**: See [helper.md](helper.md) for detailed runtime dispatch order and file map.
