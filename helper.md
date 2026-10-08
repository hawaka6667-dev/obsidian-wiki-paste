---
技术文档spec 规格说明poc
为人快速恢复上下文。
为llm快速恢复上下文，内容级别不得上升为设计契约
---

# Wiki Paste: Quick Project Context
## Purpose

目标对象是从网页复制到 Obsidian 的网页内容。转义 case 列表维护在 [md-syntax-escaping.md](md-syntax-escaping.md)；本文件只提供项目入口和快速索引。

## Development Workflow

链条没跑通，弄啥测试？？？

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
- All three feature settings are enabled by default and persisted independently with
	Obsidian `loadData` / `saveData`; `escapeFootnoteReferences` is a migration
	fallback for the Markdown escaping setting.
- The fourth setting, `showPasteOptionsPopup`, is enabled by default and displays
	an inert Word-style options popup after Markdown-editor paste. Its menu choices
	only dismiss the popup; they do not change pasted content or call an API.
- Paste and syntax-escaping behavior is documented in
	[md-syntax-escaping.md](md-syntax-escaping.md) as input/output cases; do not
	duplicate the case list in this quick-context file.

## Options and Tests

### Escape pasted Markdown syntax

- Setting: `escapeMarkdownSyntax`, enabled by default.
- Boundary: applies to external web-to-Obsidian pastes in the Markdown editor
	or Canvas. It does not modify Obsidian-to-Obsidian copies. Matching internal
	copies and cuts are bypassed by a one-shot exact-text provenance marker,
	cleared on window blur; there is no time-based expiry.
- Plain text uses `escapeMarkdownSyntax`; rich HTML is handled after Obsidian's
	native conversion with `escapeObsidianSyntax`. Canvas conversion remains
	native; only newly added or changed text-node content is post-processed.
- Community-plugin compatibility includes iOS versions before 16.4; syntax
	scanning must not use JavaScript regular-expression lookbehind. Build output
	should be checked after changes to `md-syntax-escaping.ts`.
- Automated tests: `tests/md-syntax-escaping.test.mjs` covers syntax outputs;
	`tests/md-editor-paste-handler.test.mjs` covers Markdown-editor external vs
	internal copy/cut paste behavior; `tests/canvas-auto-expand.test.mjs` covers external
	plain/rich Canvas escaping and internal-copy preservation.
- Visual test: use the developer-selected external-paste scenario in
	`local-testing/`; verify syntax stays literal in both Markdown editor and
	Canvas where relevant.

### Auto-expand pasted Canvas cards

- Setting: `autoExpandCanvasCards`, enabled by default and independent of
	`escapeMarkdownSyntax`.
- Boundary: after native Canvas paste, resize only newly added or changed text
	nodes to fit content. Image/file cards and Markdown-editor paste are
	unaffected; Obsidian retains control of Canvas content conversion.
- Automated test: `tests/canvas-auto-expand.test.mjs` covers new/changed versus
	unchanged nodes, dimension growth, preserving larger dimensions, and clearing
	then restoring the Markdown preview sizer's minimum height during measurement.
- Visual test: use a Canvas fixture in `local-testing/`; compare the rendered
	content and card bounds for the developer-selected scenario.

### Paste Canvas text cards as Markdown

- Setting: `canvasCardCopyToMarkdown`, enabled by default and independent of
	`escapeMarkdownSyntax` and `autoExpandCanvasCards`.
- Boundary: on native Canvas `copy` or `cut`, snapshot the sole selected text
	node's `getData().text` without preventing the native clipboard or cut action.
	The next paste into a Markdown editor consumes that one-shot Markdown value,
	without requiring native clipboard MIME data; multi-selection and non-text
	cards are left to Obsidian.
- Confirmed user scenario: copy or cut one text card, switch to a Markdown
	editor, and paste; verify exact Markdown insertion and unchanged native copy/
	cut behavior. Automated coverage includes copy/cut snapshots, MIME-free paste,
	one-shot consumption, and clearing on non-editor paste; run
	`npx tsx --test tests/card-copy-to-markdown.test.mjs`.

### Show paste options popup

- Setting: `showPasteOptionsPopup`, enabled by default and persisted independently.
- Boundary: after paste events originating inside the Markdown editor, show a
	visual popup with three inert options. Ctrl opens the menu; Up/Down move
	focus through the options and Enter dismisses the selected option. Selection
	does not change editor content, clipboard data, or paste formatting. Popup
	positioning is not yet recorded as a verified behavior.

## Global Paste Execution Order

- `src/wiki-paste-plugin-entry.ts` registers one document capture-phase paste
	listener. It resolves the active `MarkdownView` and active leaf view first.
- On paste, `handleCardMarkdownPaste` gets first refusal when a Canvas card
	Markdown snapshot is pending; a successful insertion stops this plugin's
	later paste handlers. Without pending card Markdown, normal escaping and
	Canvas auto-expand handling proceed unchanged.
- When `escapeMarkdownSyntax` is enabled, an active Markdown view is sent to
	`handleEditorPaste`; otherwise the active view is sent to
	`handleCanvasMarkdownPaste` (which accepts Canvas views only).
- After that, when `autoExpandCanvasCards` is enabled, the active view is sent to
	`handleCanvasPaste` (which accepts Canvas views only).
- In a Markdown editor, plain-text escaping runs in the first handler; rich HTML
	is post-processed on the subsequent editor-change event. In Canvas, native
	paste performs insertion; the first scheduled frame escapes changed text-node
	content, then the second handler's scheduled frame detects those changes and
	resizes the nodes. This runtime order does not prescribe the A/B test plan.

## Source Map

- `src/wiki-paste-plugin-entry.ts`: plugin lifecycle, setting load/migration,
	setting UI, shared option state, and capture-phase paste listener.
- `src/auto-expand-canvas/canvas-auto-expand.ts`: post-processes external Canvas
	paste text when Markdown escaping is enabled; identifies Canvas resize targets,
	measures rendered content, and persists expanded dimensions.
- `src/card-copy-to-markdown/card-copy-to-markdown.ts`: snapshots selected text
	cards on native Canvas copy/cut and consumes the Markdown on the next editor
	paste.
- `src/escape-markdown-syntax/md-editor-paste-handler.ts`: editor-target guard, rich-HTML
	paste snapshot, Obsidian copy/cut provenance, post-conversion change handling,
	plain-text transformation, and selection replacement.
- `src/paste-options/paste-options-popup.ts`: renders, positions, and handles
	keyboard interaction for the inert post-paste options popup; menu choices
	do not modify editor or clipboard data.
- `md-syntax-escaping.md`: curated syntax-escaping input/output cases.
- `src/escape-markdown-syntax/md-syntax-escaping.ts` and
  `src/escape-markdown-syntax/md-escape-optimization.ts`: syntax
	scanning and escape rendering implementation; expected outputs are listed in
	the dedicated case document.
- `tests/md-syntax-escaping.test.ts`: focused regression coverage for escaping.
- `tests/md-syntax-escaping.test.mjs`: focused regression coverage for escaping.
- `tests/canvas-auto-expand.test.mjs`: Canvas paste node-selection and sizing
	regression coverage, including external Markdown escaping and internal-copy
	preservation.
- `tests/escape-cases.json` and `table.md`: user-maintained behavior references;
	preserve their contents unless a request specifically requires editing them.
- `manifest.json`: root Obsidian metadata. Its version must match `package.json`
	and both version entries in `package-lock.json`.
- `.dist/build.mjs`: bundles `src/wiki-paste-plugin-entry.ts` with `obsidian`
	external into `.dist/<version>/main.js` and copies the manifest and
	`styles.css`.
- `.dist/<version>/`: generated installable bundle and manifest; do not edit the
	generated bundle directly.
- `styles.css`: plugin-owned classes used for temporary Canvas measurement
	styles; keep measurement behavior here instead of assigning `element.style`
	directly.
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
- `.dist/build.mjs` keeps the two highest numeric version directories. If a
	previous Release package is missing during initial setup, seed it into
	`.dist/<version>` once; normal distribution uses local packages only.
- Every project version change, including version-only changes, requires the
	complete sequence: `npm run build`, then
	`pwsh -File .dist/distribute.ps1 -Target Candidate`. Build without
	distribution is incomplete. An explicitly requested target replaces
	`Candidate`.
- For A/B delivery, `-Target Baseline` selects `wiki paste`, and `-Target Both`
	plans both roles. Use `-CandidateVersion` and `-BaselineVersion` to select
	each local package independently, or `-Version` to override every selected
	target. Baseline feature settings are preserved; they are disabled only when
	`-DisableBaselineOptions` is explicit. Use `-PlanOnly` to inspect package
	selection without touching vaults. The script verifies bundle hashes and
	reloads only enabled plugin copies; it does not enable a disabled plugin.
- `.dist/reload.ps1` validates the installed manifest and requested version
	before reloading; the distribution script passes the expected version for
	each vault.
- For GitHub publishing, run `npm run sync` followed by `npm run release`.
	The release script uses the existing `.dist/<version>/main.js` and
	`manifest.json`; it does not build, run tests, or generate a ZIP.
- Keep the Obsidian plugin id and generated output name (`main.js`) unchanged.
	When renaming a source entry, update `.dist/build.mjs` and its machine summary.
- Source filename initialization applies to `src/`; do not rename existing
	Markdown files unless the user explicitly asks.
- `table.md` is a user-provided behavior reference. Preserve its filename and
	content unless a request specifically requires editing it.
