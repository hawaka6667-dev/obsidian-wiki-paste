// @machine:
// Moves and swaps the current line or selected line block up/down on Alt+ArrowUp / Alt+ArrowDown.
// Works in both Markdown editors and active Canvas text cards while preserving cursor/selection offsets.

import type { Editor, MarkdownView } from "obsidian";
import { resolveActiveCmEditor } from "../shared/editor-target";

type MovableEditor = Pick<Editor, "getCursor" | "getLine" | "lineCount" | "replaceRange" | "setSelection">;

function resolveMovableEditor(
  target: Element | null,
  markdownView: MarkdownView | null,
  activeView?: unknown,
): MovableEditor | null {
  const editor = resolveActiveCmEditor(target, markdownView, activeView);
  if (
    editor
    && typeof editor.getCursor === "function"
    && typeof editor.getLine === "function"
    && typeof editor.lineCount === "function"
    && typeof editor.replaceRange === "function"
    && typeof editor.setSelection === "function"
  ) {
    return editor as MovableEditor;
  }

  return null;
}

export function handleMoveSelectedLinesKeydown(
  event: KeyboardEvent,
  markdownView: MarkdownView | null,
  activeView?: unknown,
): boolean {
  if (event.defaultPrevented || !event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
    return false;
  }

  const direction = event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;
  if (direction === 0) {
    return false;
  }

  const editor = resolveMovableEditor(event.target as Element | null, markdownView, activeView);
  if (!editor) {
    return false;
  }

  const from = editor.getCursor("from");
  const to = editor.getCursor("to");
  const anchor = editor.getCursor("anchor");
  const head = editor.getCursor("head");
  const firstLine = from.line;
  const lastLine = to.line > from.line && to.ch === 0 ? to.line - 1 : to.line;
  const totalLines = editor.lineCount();

  event.preventDefault();
  event.stopPropagation();

  if ((direction === -1 && firstLine <= 0) || (direction === 1 && lastLine >= totalLines - 1)) {
    return true;
  }

  const selectedLines: string[] = [];
  for (let line = firstLine; line <= lastLine; line += 1) {
    selectedLines.push(editor.getLine(line));
  }

  const swapStartLine = direction === -1 ? firstLine - 1 : firstLine;
  const swapEndLine = direction === -1 ? lastLine : lastLine + 1;
  const adjacentLine = editor.getLine(direction === -1 ? swapStartLine : swapEndLine);
  const replacement = direction === -1
    ? [...selectedLines, adjacentLine].join("\n")
    : [adjacentLine, ...selectedLines].join("\n");

  editor.replaceRange(
    replacement,
    { line: swapStartLine, ch: 0 },
    { line: swapEndLine, ch: editor.getLine(swapEndLine).length },
  );
  editor.setSelection(
    { line: anchor.line + direction, ch: anchor.ch },
    { line: head.line + direction, ch: head.ch },
  );
  return true;
}
