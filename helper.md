---
技术文档spec 规格说明poc
为人快速恢复上下文。
为llm快速恢复上下文，内容级别不得上升为设计契约
---

# Wiki Paste: Quick Project Context
## Purpose

目标对象是从网页复制到 Obsidian 的网页内容。转义 case 列表维护在 [md-syntax-escaping.md](md-syntax-escaping.md)；本文件只提供项目入口和快速索引。

## Development Workflow

- Start from the named file or behavior. Before editing, identify the owning
	module, one falsifiable local hypothesis, and the cheapest check that could
	disconfirm it.
- Keep changes scoped to the requested outcome. Preserve unrelated worktree
	edits, and do not rename existing Markdown files unless asked.
- Begin source files with a concise, multi-line `@machine` header describing
	their inputs, outputs, dependencies, and global effects. Update it when the
	file's role changes; do not add tests just to verify a header comment.
- Choose validation by the changed behavior: run the narrowest relevant test or
	check for routine work. Do not run `npm test` by default; use it when the user
	asks for the full suite, a release workflow requires it, or the change spans
	multiple behavior contracts without adequate focused coverage.
- Complete a self-contained side request without dropping an unfinished primary
	task, unless the user explicitly pauses or redirects that task.

## Current Behavior

- Plugin id: `wiki-paste`; minimum Obsidian version: `1.5.0`.
- Plain-text syntax escaping is enabled by default. The setting is stored with
	Obsidian `loadData` / `saveData`; the former `escapeFootnoteReferences` value
	is read as a migration fallback.
- Canvas text-card auto-expansion is enabled by default and stored independently
	as `autoExpandCanvasCards`. On native paste into the active Canvas, only new or
	changed text nodes are resized after insertion; image/file cards and Markdown
	editor paste behavior are unaffected. Canvas native paste conversion remains
	in control of the inserted content.
- A document-level capture listener handles the active `MarkdownView`. The paste
	target must be inside `.cm-content` and the view's container.
- Paste and syntax-escaping behavior is documented in
	[md-syntax-escaping.md](md-syntax-escaping.md) as input/output cases; do not
	duplicate the case list in this quick-context file.

## Source Map

- `src/wiki-paste-plugin-entry.ts`: plugin lifecycle, setting load/migration,
	setting UI, shared option state, and capture-phase paste listener.
- `src/auto-expand-canvas/canvas-auto-expand.ts`: identifies text nodes changed by a Canvas paste,
  measures their rendered content, and persists expanded dimensions.
- `src/escape-markdown-syntax/md-editor-paste-handler.ts`: editor-target guard, rich-HTML
	paste snapshot, post-conversion change handling, plain-text transformation,
	and selection replacement.
- `md-syntax-escaping.md`: curated syntax-escaping input/output cases.
- `src/escape-markdown-syntax/md-syntax-escaping.ts` and
  `src/escape-markdown-syntax/md-escape-optimization.ts`: syntax
	scanning and escape rendering implementation; expected outputs are listed in
	the dedicated case document.
- `tests/md-syntax-escaping.test.ts`: focused regression coverage for escaping.
- `tests/md-syntax-escaping.test.mjs`: focused regression coverage for escaping.
- `tests/canvas-auto-expand.test.mjs`: Canvas paste node-selection and sizing
	regression coverage.
- `tests/escape-cases.json` and `table.md`: user-maintained behavior references;
	preserve their contents unless a request specifically requires editing them.
- `manifest.json`: root Obsidian metadata. Its version must match `package.json`
	and both version entries in `package-lock.json`.
- `.dist/build.mjs`: bundles `src/wiki-paste-plugin-entry.ts` with `obsidian`
	external into `.dist/<version>/main.js` and copies the manifest.
- `.dist/<version>/`: generated installable bundle and manifest; do not edit the
	generated bundle directly.
- `README.md`: end-user documentation. Keep its marketplace-style format; put
	developer workflow notes in this file instead.

## Validation and Delivery

```sh
npm test
npm run typecheck
npm run build
```

- `npm test` runs the current `tsx --test` suite. Use the owning module's
	narrowest relevant check for routine work.
- For a paste-behavior change, build and distribute with
	`\.dist\distribute.ps1` (default target `Both`) so Main and Test receive the
	same version and bundle; use the script's reported reload result. Use an
	explicit single-vault target only when requested. The script does not enable
	a disabled plugin. Follow
	`.github/skills/wiki-paste-development-reload/SKILL.md` for versioning and
	runtime-delivery requirements.
- Keep the Obsidian plugin id and generated output name (`main.js`) unchanged.
	When renaming a source entry, update `.dist/build.mjs` and its machine summary.
- Source filename initialization applies to `src/`; do not rename existing
	Markdown files unless the user explicitly asks.
- `table.md` is a user-provided behavior reference. Preserve its filename and
	content unless a request specifically requires editing it.
