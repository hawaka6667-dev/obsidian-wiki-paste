// @machine:
// Snapshots one selected Canvas text card on copy/cut and consumes its Markdown on the next editor or Canvas-card paste.
import type { MarkdownView } from "obsidian";
import type { CanvasAutoExpandNode } from "../auto-expand-canvas/canvas-auto-expand";

interface CanvasNodeData {
  type: string;
  text?: string;
}

interface TextInsertionTarget {
  replaceSelection: (text: string) => void;
}

interface CanvasNode extends Omit<Partial<CanvasAutoExpandNode>, "getData"> {
  getData?: () => CanvasNodeData;
  child?: {
    editor?: TextInsertionTarget;
  };
}

interface CanvasView {
  getViewType: () => string;
  containerEl: HTMLElement;
  canvas?: {
    selection?: Iterable<CanvasNode>;
    nodes?: Map<string, CanvasNode>;
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

export function handleCardMarkdownPaste(
  event: ClipboardEvent,
  document: Document,
  view: MarkdownView | null,
  activeView?: unknown,
  onCanvasCardPasted?: (node: CanvasNode) => void,
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
): { insert: (text: string) => void; canvasNode?: CanvasNode } | null {
  if (!target?.closest?.(".cm-content")) {
    return null;
  }

  if (markdownView && markdownView.containerEl.contains(target)) {
    return { insert: (text) => markdownView.editor.replaceSelection(text) };
  }

  if (!isCanvasView(activeView)) {
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

function findCanvasNodeForTarget(view: CanvasView, target: Element): CanvasNode | undefined {
  const nodes = view.canvas?.nodes;
  const candidates: CanvasNode[] = [];
  if (nodes instanceof Map) {
    candidates.push(...nodes.values());
  } else if (view.canvas?.selection && typeof view.canvas.selection[Symbol.iterator] === "function") {
    candidates.push(...view.canvas.selection);
  }

  return candidates.find((node) => {
    if (!node.nodeEl) {
      return false;
    }
    if (node.nodeEl.contains(target)) {
      return true;
    }
    const iframe = node.nodeEl.querySelector<HTMLIFrameElement>("iframe.embed-iframe");
    return Boolean(iframe?.contentDocument?.contains(target));
  });
}

function isCanvasView(view: unknown): view is CanvasView {
  if (!view || typeof view !== "object") {
    return false;
  }

  const candidate = view as CanvasView;
  return candidate.getViewType?.() === "canvas"
    && Boolean(candidate.containerEl && candidate.canvas);
}
