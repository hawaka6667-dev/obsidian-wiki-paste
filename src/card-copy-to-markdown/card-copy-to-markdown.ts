// @machine:
// Snapshots one selected Canvas text card on copy/cut and consumes its Markdown on the next editor or Canvas-card paste.

import type { MarkdownView } from "obsidian";
import { findCanvasNodeForTarget, isCanvasView, type CanvasNodeLike } from "../shared/editor-target";

const pendingCanvasMarkdown = new WeakMap<Document, string>();

export function handleCanvasCardClipboardEvent(event: ClipboardEvent, document: Document, view: unknown): boolean {
  pendingCanvasMarkdown.delete(document);
  if (event.defaultPrevented || !isCanvasView(view) || !view.containerEl) {
    return false;
  }

  const target = event.target as Element | null;
  if (!target || target.closest(".cm-content") || !view.containerEl.contains(target)) {
    return false;
  }

  const selection = view.canvas.selection;
  if (!selection || typeof selection[Symbol.iterator] !== "function") {
    return false;
  }

  const selectedNodes = Array.from(selection);
  if (selectedNodes.length !== 1) {
    return false;
  }

  const data = selectedNodes[0]?.getData?.();
  if (data?.type !== "text" || typeof data.text !== "string" || data.text.length === 0) {
    return false;
  }

  pendingCanvasMarkdown.set(document, data.text);
  return true;
}

export function clearPendingCanvasMarkdown(document: Document): void {
  pendingCanvasMarkdown.delete(document);
}

export function handleCardMarkdownPaste(
  event: ClipboardEvent,
  document: Document,
  view: MarkdownView | null,
  activeView?: unknown,
  onCanvasCardPasted?: (node: CanvasNodeLike) => void,
): boolean {
  const markdown = pendingCanvasMarkdown.get(document);
  if (markdown === undefined) {
    return false;
  }

  const target = event.target as Element | null;
  const resolved = resolvePasteTarget(target, view, activeView);
  if (!resolved) {
    pendingCanvasMarkdown.delete(document);
    return false;
  }

  pendingCanvasMarkdown.delete(document);
  event.preventDefault();
  event.stopPropagation();
  resolved.insert(markdown);
  if (resolved.canvasNode && onCanvasCardPasted) {
    onCanvasCardPasted(resolved.canvasNode);
  }
  return true;
}

function resolvePasteTarget(
  target: Element | null,
  markdownView: MarkdownView | null,
  activeView: unknown,
): { insert: (text: string) => void; canvasNode?: CanvasNodeLike } | null {
  if (!target?.closest?.(".cm-content")) {
    return null;
  }

  if (markdownView && markdownView.containerEl.contains(target)) {
    return { insert: (text) => markdownView.editor.replaceSelection(text) };
  }

  if (!isCanvasView(activeView) || !activeView.containerEl) {
    return null;
  }

  const canvasNode = findCanvasNodeForTarget(activeView, target);
  if (!canvasNode && !activeView.containerEl.contains(target)) {
    return null;
  }

  const cardEditor = canvasNode?.child?.editor;
  if (cardEditor && typeof cardEditor.replaceSelection === "function") {
    return {
      insert: (text) => cardEditor.replaceSelection(text),
      canvasNode,
    };
  }

  const targetDoc = target.ownerDocument;
  if (typeof targetDoc?.execCommand === "function") {
    return {
      insert: (text) => {
        targetDoc.execCommand("insertText", false, text);
      },
      canvasNode,
    };
  }

  return null;
}
