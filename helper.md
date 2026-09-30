---
技术文档spec 规格说明poc
为人快速恢复上下文。
为llm快速恢复上下文
---

# Wiki Paste: Quick Project Context
## Purpose

帮助用户粘贴wiki文本到Obsidian时，不被解析colission

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

## Product Goal (Target)

- The product goal is faithful paste into Obsidian-native, editable Markdown, not
	webpage archival or wholesale HTML preservation.
- When converting rich clipboard content, lower its semantic structure to
	Markdown wherever Obsidian preserves the intended meaning and rendered
	appearance. Decide safety by Obsidian's parsing behavior, not merely by
	whether Markdown has a syntax for the content.
- If Obsidian would reinterpret a Markdown-representable span (for example,
	`[^abc]` as a footnote reference) or change its intended appearance, protect
	only the smallest affected span with minimal HTML or entities. Keep surrounding
	content as Markdown; HTML is a local escape hatch, not a second document format.
- The target is one `.md` document that combines readable native Markdown with
	localized fallback where needed, preserving faithful rendering while keeping
	content editable, searchable, diffable, and usable by other Markdown tools.
- This is the product target, not a claim about current implementation. See
	`Current Behavior` for the implemented behavior.

## Current Behavior

- Plugin id: `wiki-paste`; minimum Obsidian version: `1.5.0`.
- Plain-text syntax escaping is enabled by default. The setting is stored with
	Obsidian `loadData` / `saveData`; the former `escapeFootnoteReferences` value
	is read as a migration fallback.
- A document-level capture listener handles the active `MarkdownView`. The paste
	target must be inside `.cm-content` and the view's container.
- Rich HTML is left to Obsidian's native paste conversion. The plugin snapshots
	the document and selection before paste, then uses `editor-change` to find the
	inserted Markdown and protect only Obsidian-specific syntax conflicts.
	Markdown formatting, code spans/blocks, and Markdown tables are preserved.
- Without HTML, available plain text is transformed by the syntax escaper and
	inserted only when it changes.
- `escapeMarkdownSyntax` scans lines for active Markdown and Obsidian syntax,
	then adds only the delimiter escapes needed to prevent parsing. It covers
	block markers, links and footnotes, emphasis, paired markers, inline code,
	Obsidian tags/block IDs/comments, and HTML tags.
- Every paste rescans the current text and recalculates escape offsets; no cases,
	offsets, or output are cached. Add each new case as a scanner rule and a
	focused regression test; it is picked up after the updated plugin is reloaded.
- Plain-text escaping doubles existing backslashes before escapable punctuation.
- The rich-paste post-pass preserves existing Markdown, protects nested square
	brackets in inline-link labels, escapes unmatched opening brackets outside
	code and links, and doubles single existing backslashes before escapable
	punctuation in link labels to retain visible source characters. FX strings
	are collision-free examples, not exact output contracts; JSON-driven tests
	check source preservation and stable Obsidian post-processing. LF and CRLF
	line endings are preserved; table pipes are not escaped. Four-column code
	indentation is emitted as `&nbsp;`.

## Source Map

- `src/wiki-paste-plugin-entry.ts`: plugin lifecycle, setting load/migration,
	setting UI, and capture-phase paste listener.
- `src/md-editor-paste-handler.ts`: editor-target guard, rich-HTML
	paste snapshot, post-conversion change handling, plain-text transformation,
	and selection replacement.
- `src/md-syntax-escaping.ts`: plain-text Markdown escaping plus an
	Obsidian-only post-conversion pass that preserves standard Markdown syntax.
- `src/md-escape-optimization.ts`: secondary pass that renders those
	offsets with minimal backslashes; supports preserving existing Markdown
	escapes during post-processing.
- `tests/md-syntax-escaping.test.js` and
	`tests/rich-html-clipboard-to-md.test.js`: thin test-discovery entrypoints;
	each loads its behavior suite from `tests/cases/`.
- `tests/cases/md-syntax-escaping.js`: drives plain-text and native
	post-processing cases from the JSON fixture and checks source preservation,
	Obsidian collision stability, exact expectations where specified, ordinary
	text, pipes, line endings, indentation, and existing slashes.
- `tests/cases/rich-html-clipboard-to-md.js`: verifies native HTML conversion,
	selected-range handling, link-label preservation, and table preservation.
- `tests/escape-cases.json` and `tests/escape-case-provider.js`: manage examples
	extracted from the two populated `table.md` reference tables plus focused
	regressions, and expose normalized cases to suites. Blank `fx` cells are not
	included; `table.md` is not modified.
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

- `npm test` runs all JSON-driven syntax cases and rich-paste flow tests. For
	routine work, run the relevant thin entrypoint with `npx tsx --test` instead
	of running the full suite by default.
- For a paste-behavior change, build and distribute to the test vault with
	`\.dist\distribute.ps1 -Target Test`; use the script's reported reload result.
	The script does not enable a disabled plugin. Follow
	`.github/skills/wiki-paste-development-reload/SKILL.md` for versioning and
	runtime-delivery requirements.
- Keep the Obsidian plugin id and generated output name (`main.js`) unchanged.
	When renaming a source entry, update `.dist/build.mjs` and its machine summary.
- Source filename initialization applies to `src/`; do not rename existing
	Markdown files unless the user explicitly asks.
- `table.md` is a user-provided behavior reference. Preserve its filename and
	content unless a request specifically requires editing it.
