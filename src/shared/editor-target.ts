// @machine:
// Shared type guards and target-resolution helpers for Canvas views and active CodeMirror editors.
// Supports both direct DOM nodes and Canvas iframe.embed-iframe editors.

import type { Editor, MarkdownView } from "obsidian";
import type { CanvasAutoExpandNode } from "../auto-expand-canvas/canvas-auto-expand";

export interface CanvasNodeData {
  type: string;
  text?: string;
}

export interface TextInsertionTarget {
  replaceSelection: (text: string) => void;
}

export interface CanvasNodeLike extends Omit<Partial<CanvasAutoExpandNode>, "getData"> {
  getData?: () => CanvasNodeData;
  child?: {
    editor?: TextInsertionTarget & Partial<Editor>;
  };
}

export interface CanvasViewLike {
  getViewType: () => string;
  containerEl?: HTMLElement;
  canvas: {
    selection?: Iterable<CanvasNodeLike>;
    nodes?: Map<string, CanvasNodeLike>;
  };
}

export function isCanvasView(view: unknown): view is CanvasViewLike {
  if (!view || typeof view !== "object") {
    return false;
  }

  const candidate = view as Partial<CanvasViewLike>;
  return candidate.getViewType?.() === "canvas" && Boolean(candidate.canvas);
}

export function containerContainsTarget(container: HTMLElement | undefined, target: Node | null): boolean {
  if (!container || !target) {
    return false;
  }

  if (container.contains(target)) {
    return true;
  }

  const frameElement = target.ownerDocument?.defaultView?.frameElement ?? null;
  return Boolean(frameElement && container.contains(frameElement));
}

export function findCanvasNodeForTarget(view: unknown, target: Element): CanvasNodeLike | undefined {
  if (!isCanvasView(view)) {
    return undefined;
  }

  const nodes = view.canvas.nodes;
  const candidates: CanvasNodeLike[] = [];
  if (nodes instanceof Map) {
    candidates.push(...nodes.values());
  } else if (view.canvas.selection && typeof view.canvas.selection[Symbol.iterator] === "function") {
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

export function resolveActiveCmEditor(
  target: Element | null,
  markdownView: MarkdownView | null,
  activeView?: unknown,
  fallbackEditor?: Editor | null,
): Partial<Editor> | null {
  if (!target?.closest?.(".cm-content")) {
    return null;
  }

  if (markdownView && containerContainsTarget(markdownView.containerEl, target)) {
    return markdownView.editor;
  }

  const canvasEditor = findCanvasNodeForTarget(activeView, target)?.child?.editor;
  if (canvasEditor) {
    return canvasEditor;
  }

  return fallbackEditor ?? null;
}
