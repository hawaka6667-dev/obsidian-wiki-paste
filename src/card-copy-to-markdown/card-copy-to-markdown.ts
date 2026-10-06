// @machine:
// Preserves native Canvas card cutting while allowing the next Markdown paste to use card Markdown.
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
  canvas: {
    selection?: Set<CanvasNode>;
  };
}

const recentCanvasMarkdownCuts = new WeakMap<Document, { text: string }>();

export function handleCanvasCut(event: ClipboardEvent, document: Document, view: unknown): boolean {
  recentCanvasMarkdownCuts.delete(document);
  if (event.defaultPrevented) {
    return false;
  }

  if (!isCanvasView(view)) {
    return false;
  }

  const target = event.target as Element | null;
  if (target?.closest?.(".cm-content")) {
    return false;
  }

  const selection = view.canvas.selection;
  if (!(selection instanceof Set) || selection.size !== 1) {
    return false;
  }

  const selectedNode = selection.values().next().value as CanvasNode | undefined;
  const data = selectedNode?.getData?.();
  if (data?.type !== "text" || typeof data.text !== "string" || !data.text) {
    return false;
  }

  recentCanvasMarkdownCuts.set(document, { text: data.text });
  return true;
}

export function clearRecentCanvasMarkdownCut(document: Document): void {
  recentCanvasMarkdownCuts.delete(document);
}

export function handleCardMarkdownPaste(event: ClipboardEvent, view: MarkdownView): boolean {
  const target = event.target as Element | null;
  if (!target?.closest?.(".cm-content") || !view.containerEl.contains(target)) {
    return false;
  }

  const clipboardData = event.clipboardData;
  if (!clipboardData?.getData("text/plain") && !clipboardData?.getData("text/html")) {
    return false;
  }

  const cut = recentCanvasMarkdownCuts.get(view.containerEl.ownerDocument);
  if (!cut) {
    return false;
  }

  recentCanvasMarkdownCuts.delete(view.containerEl.ownerDocument);
  event.preventDefault();
  event.stopPropagation();
  view.editor.replaceSelection(cut.text);
  return true;
}

export function clearCanvasMarkdownCutUnlessConsumed(document: Document, consumed: boolean): void {
  if (!consumed) {
    recentCanvasMarkdownCuts.delete(document);
  }
}

function isCanvasView(view: unknown): view is CanvasView {
  if (!view || typeof view !== "object") {
    return false;
  }

  const candidate = view as CanvasView;
  return candidate.getViewType?.() === "canvas"
    && candidate.canvas?.selection instanceof Set;
}
