// @machine:
// Implements OneNote-style progressive Ctrl+A in Markdown and Canvas text editors.
// First press selects the current logical line; a second press falls through to native Select All.

import type { Editor, MarkdownView } from "obsidian";
import { resolveActiveCmEditor } from "../card-copy-to-markdown/card-copy-to-markdown";

type SelectableEditor = Pick<Editor, "getCursor" | "getLine" | "setSelection">;

export interface SelectLineOptions {
  isMacOS?: boolean;
}

function isSelectAllShortcut(event: KeyboardEvent, isMacOS: boolean): boolean {
  if (event.defaultPrevented || event.repeat || event.altKey || event.shiftKey) {
    return false;
  }

  if (event.key.toLowerCase() !== "a") {
    return false;
  }

  return isMacOS ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
}

function resolveSelectableEditor(
  target: Element | null,
  markdownView: MarkdownView | null,
  activeView?: unknown,
): SelectableEditor | null {
  const editor = resolveActiveCmEditor(target, markdownView, activeView);
  if (
    editor
    && typeof editor.getCursor === "function"
    && typeof editor.getLine === "function"
    && typeof editor.setSelection === "function"
  ) {
    return editor as SelectableEditor;
  }

  return null;
}

export function handleSelectLineThenAllKeydown(
  event: KeyboardEvent,
  markdownView: MarkdownView | null,
  activeView?: unknown,
  options: SelectLineOptions = {},
): boolean {
  if (!isSelectAllShortcut(event, options.isMacOS ?? false)) {
    return false;
  }

  const editor = resolveSelectableEditor(event.target as Element | null, markdownView, activeView);
  if (!editor) {
    return false;
  }

  const from = editor.getCursor("from");
  const to = editor.getCursor("to");
  if (from.line !== to.line) {
    return false;
  }

  const lineText = editor.getLine(from.line);
  if (lineText.length === 0) {
    return false;
  }

  if (from.ch === 0 && to.ch === lineText.length) {
    return false;
  }

  event.preventDefault();
  event.stopPropagation();
  editor.setSelection({ line: from.line, ch: 0 }, { line: from.line, ch: lineText.length });
  return true;
}
