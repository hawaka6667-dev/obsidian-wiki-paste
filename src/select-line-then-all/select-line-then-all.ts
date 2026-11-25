// @machine:
// Implements OneNote-style progressive Ctrl+A in Markdown and Canvas text editors.
// First press selects the current logical line; a second press falls through to native Select All.

import type { Editor, MarkdownView } from "obsidian";
import { findCanvasNodeForTarget } from "../card-copy-to-markdown/card-copy-to-markdown";

type SelectableEditor = Pick<Editor, "getCursor" | "getLine" | "setSelection">;

function isSelectAllShortcut(event: KeyboardEvent): boolean {
  if (event.defaultPrevented || event.repeat || event.altKey || event.shiftKey) {
    return false;
  }

  if (event.key.toLowerCase() !== "a") {
    return false;
  }

  const platform = typeof navigator !== "undefined" ? (navigator.platform || navigator.userAgent) : "";
  const isMac = /mac/i.test(platform);
  return isMac ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
}

function resolveSelectableEditor(
  target: Element | null,
  markdownView: MarkdownView | null,
  activeView?: unknown,
): SelectableEditor | null {
  if (!target?.closest?.(".cm-content")) {
    return null;
  }

  if (markdownView && markdownView.containerEl.contains(target)) {
    return markdownView.editor;
  }

  const canvasEditor = findCanvasNodeForTarget(activeView, target)?.child?.editor;
  if (
    canvasEditor
    && typeof canvasEditor.getCursor === "function"
    && typeof canvasEditor.getLine === "function"
    && typeof canvasEditor.setSelection === "function"
  ) {
    return canvasEditor as SelectableEditor;
  }

  return null;
}

export function handleSelectLineThenAllKeydown(
  event: KeyboardEvent,
  markdownView: MarkdownView | null,
  activeView?: unknown,
): boolean {
  if (!isSelectAllShortcut(event)) {
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
