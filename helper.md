---
Technical context and module contracts for Wiki Paste.
---

# Wiki Paste: Project Context

## Purpose

Enhances Obsidian Markdown and Canvas editing/pasting: converts web and AI-chat LaTeX formulas into Obsidian `$...$` / `$$...$$`, auto-expands pasted Canvas cards, supports Canvas card-to-Markdown and card-to-card pasting, provides OneNote-style `Ctrl+A` and `Alt+Up/Down` line movement, and keeps legacy Markdown-escaping / paste-popup / raw-HTML prototypes behind opt-in `[Hack]` toggles.

## Current Settings Contract

- Plugin id: `wiki-paste`; minimum Obsidian version: `1.5.0`.
- Enabled by default (`true`):
  - `convertLatexOnPaste`
  - `autoExpandCanvasCards`
  - `canvasCardCopyToMarkdown`
  - `selectLineBeforeAll`
  - `moveLinesWithAltArrows`
- `[Hack]` opt-in toggles (`false` by default):
  - `escapeMarkdownSyntax` (with `escapeFootnoteReferences` migration fallback)
  - `showPasteOptionsPopup` (visual-only popup)
  - `pasteWebContentAsHtml` (inserts raw clipboard HTML verbatim)

## Runtime Dispatch Order

- **`keydown` (capture phase)** in `src/wiki-paste-plugin-entry.ts`:
  1. `handleSelectLineThenAllKeydown` (`Ctrl+A` / `Cmd+A` on macOS): selects current logical line on first press; passes through to native Select All on second press, empty lines, multi-line selections, or repeat events.
  2. `handleMoveSelectedLinesKeydown` (`Alt+ArrowUp` / `Alt+ArrowDown`): swaps the current line or selected block with the adjacent line and shifts selection indices.
- **`paste` (capture phase)** in `src/wiki-paste-plugin-entry.ts`:
  1. `schedulePasteOptionsPopup` (when `[Hack] showPasteOptionsPopup` is enabled in `MarkdownView`).
  2. `handleCardMarkdownPaste` (consumes one-shot Canvas text card snapshot into `MarkdownView` or another Canvas text card editor; optionally triggers `autoExpandCanvasNode`).
  3. `pasteClipboardHtml` (when `[Hack] pasteWebContentAsHtml` is enabled in `MarkdownView`).
  4. `handleEditorPaste` (in `MarkdownView`) or `handleCanvasMarkdownPaste` (in `CanvasView`) when `convertLatexOnPaste` or `escapeMarkdownSyntax` is enabled; bypasses internal Obsidian copies via `recentInternalMarkdownCopies`.
  5. `handleCanvasPaste` (in `CanvasView` when `autoExpandCanvasCards` is enabled): waits for node render readiness and invokes `autoExpandCanvasNode`.
- **`editor-change`**: `handleEditorChange` post-processes native HTML pastes (`PendingHtmlPaste`) for `\(...\)` / `\[...\]` conversion and optional `escapeObsidianSyntax`.

## Source & Test Map

- `src/wiki-paste-plugin-entry.ts`: lifecycle, event registration, Canvas leaf lookup (`getLeavesOfType("canvas")`), and delegation.
- `src/settings.ts`: `WikiPasteSettings`, `DEFAULT_SETTINGS`, `normalizeSettings`, and `WikiPasteSettingTab`.
- `src/shared/editor-target.ts`: `isCanvasView`, `findCanvasNodeForTarget`, and `resolveActiveCmEditor`.
- `src/shared/issue-report.ts`: builds pre-filled GitHub Issue URLs (`buildIssueUrl`, `openIssueReport`) for Settings & Command Palette (`wiki-paste:submit-issue`).
- `src/latex-paste/latex-paste.ts` & `src/latex-paste/mathml-to-latex.ts`: web math DOM extraction (KaTeX, Wikipedia `.mwe-math-element`, MathJax v2/v3 + MathML fallback, Zhihu/Gemini/Notion `data-*`, `<math-renderer>`), `\(...\)`/`\[...\]` delimiter conversion, and `$...$`/`$$...$$` span protection.
- `src/auto-expand-canvas/canvas-auto-expand.ts`: `autoExpandCanvasNode` and `getExpandedCanvasSize` using `styles.css` measurement classes.
- `src/auto-expand-canvas/canvas-paste.ts`: detects new/changed Canvas text cards on paste and waits for mount before sizing.
- `src/auto-expand-canvas/canvas-markdown-escape.ts`: post-processes pasted Canvas text cards for LaTeX conversion and optional escaping.
- `src/card-copy-to-markdown/card-copy-to-markdown.ts`: snapshots sole selected Canvas text card on copy/cut for MIME-free paste into Markdown or another Canvas card.
- `src/editor-actions/select-line-then-all.ts` & `src/editor-actions/move-selected-lines.ts`: `Ctrl+A` and `Alt+Up/Down` editor actions.
- `src/escape-markdown-syntax/`: `md-editor-paste-handler.ts`, `md-syntax-escaping.ts`, `md-escape-optimization.ts` (lookbehind-free escaping).
- `src/paste-options/`: `[Hack]` inert Word-style popup (`paste-options-popup.ts`, `paste-options-menu.ts`, `paste-options-positioning.ts`).
- `src/paste-to-html/paste-to-html.ts`: `[Hack]` raw clipboard HTML paste.
- `tests/`: `canvas-auto-expand.test.mjs`, `card-copy-to-markdown.test.mjs`, `latex-paste.test.mjs`, `md-editor-paste-handler.test.mjs`, `md-syntax-escaping.test.mjs`, `move-selected-lines.test.mjs`, `select-line-then-all.test.mjs`, `escape-cases.json`.
- `docs/legacy/`: archived historical notes and reference fixtures (`table.md`, `md-syntax-escaping.md`, `design doc.md`, `test.md`).

## Validation & Delivery

```sh
npm test
npm run typecheck
npm run build
npm run distribute
```

- `manifest.json`, `package.json`, and both entries in `package-lock.json` must share the exact same version before `npm run build` / `npm run distribute` / `npm run release`.
- `.dist/build.mjs` bundles `src/wiki-paste-plugin-entry.ts` with `obsidian` external into `.dist/<version>/main.js` and keeps the two newest version folders.
- `.dist/distribute.ps1` deploys to `MainVaultPath` in `.publish-config.json` (`E:\GameDevVault`), verifies SHA-256 hashes, and hot-reloads via Obsidian CLI.
- Keep `styles.css` measurement classes instead of inline `element.style.*` assignments, and follow Obsidian Community Plugin review rules listed in `AGENTS.md`.
