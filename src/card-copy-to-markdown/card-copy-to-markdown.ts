// @machine:
// Snapshots one selected Canvas text card on copy/cut and consumes its Markdown on the next editor paste.
import type { MarkdownView } from "obsidian";

interface CanvasNodeData {
  type: string;
  text?: string;
}

interface CanvasNode {
  getData?: () => CanvasNodeData;
}

interface CanvasView {
  getViewType: () => string;
  containerEl: HTMLElement;
  canvas?: {
    selection?: Iterable<CanvasNode>;
  };
}

const pendingCanvasMarkdown = new WeakMap<Document, string>();

export function handleCanvasCardClipboardEvent(event: ClipboardEvent, document: Document, view: unknown): boolean {
  pendingCanvasMarkdown.delete(document);
  if (event.defaultPrevented || !isCanvasView(view)) {
    return false;
  }

  const target = event.target as Element | null;
  if (!target || target.closest(".cm-content") || !view.containerEl.contains(target)) {
    return false;
  }

  const canvas = view.canvas;
  if (!canvas) {
    return false;
  }

  const selection = canvas.selection;
  if (!selection || typeof selection[Symbol.iterator] !== "function") {
    return false;
  }

  const selectedNodes = Array.from(selection);
  if (selectedNodes.length !== 1) {
    return false;
  }

  const selectedNode = selectedNodes[0];
  const data = selectedNode?.getData?.();
  if (data?.type !== "text" || typeof data.text !== "string" || data.text.length === 0) {
    return false;
  }

  pendingCanvasMarkdown.set(document, data.text);
  return true;
}

export function clearPendingCanvasMarkdown(document: Document): void {
  pendingCanvasMarkdown.delete(document);
}

export function handleCardMarkdownPaste(event: ClipboardEvent, document: Document, view: MarkdownView | null): boolean {
  const markdown = pendingCanvasMarkdown.get(document);
  if (markdown === undefined) {
    return false;
  }

  const target = event.target as Element | null;
  if (!view || !target?.closest?.(".cm-content") || !view.containerEl.contains(target)) {
    pendingCanvasMarkdown.delete(document);
    return false;
  }

  pendingCanvasMarkdown.delete(document);
  event.preventDefault();
  event.stopPropagation();
  view.editor.replaceSelection(markdown);
  return true;
}

function isCanvasView(view: unknown): view is CanvasView {
  if (!view || typeof view !== "object") {
    return false;
  }

  const candidate = view as CanvasView;
  return candidate.getViewType?.() === "canvas"
    && Boolean(candidate.containerEl && candidate.canvas);
}
