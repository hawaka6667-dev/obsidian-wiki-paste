// @machine:
// Detects paste into the focused editor of a Canvas text card, including a newly-created card.
// Resolves the owning node from the event path or current editor selection and delegates sizing to the API.
import { autoExpandCanvasNode, type CanvasAutoExpandNode } from "./canvas-auto-expand-api";

interface CanvasView {
  getViewType(): string;
  canvas: { nodes: Map<string, CanvasAutoExpandNode> };
}

export function handleCanvasEditPaste(event: ClipboardEvent, view: unknown): boolean {
  if (!isCanvasView(view)) {
    return false;
  }

  const clipboard = event.clipboardData;
  if (!clipboard?.getData("text/plain") && !clipboard?.getData("text/html")) {
    return false;
  }

  const editedNode = findPastedCanvasTextNode(event, view);
  if (!editedNode) {
    return false;
  }

  window.requestAnimationFrame(() => {
    void autoExpandCanvasNode(editedNode);
  });
  return true;
}

function findPastedCanvasTextNode(event: ClipboardEvent, view: CanvasView): CanvasAutoExpandNode | undefined {
  const candidates = [
    event.target,
    ...event.composedPath(),
    document.activeElement,
    document.getSelection()?.anchorNode,
  ].filter(isNode);

  return Array.from(view.canvas.nodes.values()).find((node) =>
    node.getData().type === "text" && candidates.some((candidate) => node.nodeEl.contains(candidate)),
  );
}

function isNode(value: EventTarget | Node | null | undefined): value is Node {
  return Boolean(value && typeof value === "object" && "nodeType" in value);
}

function isCanvasView(view: unknown): view is CanvasView {
  if (!view || typeof view !== "object") {
    return false;
  }

  const candidate = view as Partial<CanvasView>;
  return candidate.getViewType?.() === "canvas" && candidate.canvas?.nodes instanceof Map;
}