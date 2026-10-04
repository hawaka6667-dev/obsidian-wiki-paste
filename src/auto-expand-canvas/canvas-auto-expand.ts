// @machine:
// Detects text cards changed by a native Canvas paste and grows them to fit rendered content.
// Uses Canvas node data for persisted dimensions while leaving Obsidian's paste conversion intact.
interface CanvasNodeData {
  id: string;
  type: string;
  text?: string;
  width: number;
  height: number;
}

interface CanvasNode {
  canvas: { requestSave(): void };
  nodeEl: HTMLElement;
  getData(): CanvasNodeData;
  setData(data: Partial<CanvasNodeData>): void;
}

interface CanvasView {
  getViewType(): string;
  canvas: { nodes: Map<string, CanvasNode> };
}

const CARD_WIDTH_GUTTER = 32;
const CARD_HEIGHT_GUTTER = 2;
const EDITOR_LAYOUT_SETTLE_MS = 50;

export function getExpandedCanvasSize(
  width: number,
  height: number,
  contentWidth: number,
  contentHeight: number,
): { width: number; height: number } {
  return {
    width: Math.max(width, Math.ceil(contentWidth + CARD_WIDTH_GUTTER)),
    height: Math.max(height, Math.ceil(contentHeight + CARD_HEIGHT_GUTTER)),
  };
}

export function handleCanvasPaste(event: ClipboardEvent, view: unknown): boolean {
  if (!isCanvasView(view)) {
    return false;
  }

  const clipboard = event.clipboardData;
  if (!clipboard?.getData("text/plain") && !clipboard?.getData("text/html")) {
    return false;
  }

  const beforePaste = new Map<string, string | undefined>();
  for (const node of view.canvas.nodes.values()) {
    const data = node.getData();
    if (data.type === "text") {
      beforePaste.set(data.id, data.text);
    }
  }

  window.requestAnimationFrame(() => {
    for (const node of view.canvas.nodes.values()) {
      const data = node.getData();
      if (data.type !== "text" || beforePaste.get(data.id) === data.text) {
        continue;
      }
      expandCanvasNode(node);
    }
  });

  return true;
}

function isCanvasView(view: unknown): view is CanvasView {
  if (!view || typeof view !== "object") {
    return false;
  }

  const candidate = view as Partial<CanvasView>;
  return candidate.getViewType?.() === "canvas" && candidate.canvas?.nodes instanceof Map;
}

function expandCanvasNode(node: CanvasNode): void {
  const data = node.getData();
  const contentWidth = measureNaturalContentWidth(node.nodeEl);
  const expandedWidth = getExpandedCanvasSize(data.width, data.height, contentWidth, 0).width;
  let dimensionsChanged = false;
  if (expandedWidth > data.width) {
    node.setData({ width: expandedWidth });
    dimensionsChanged = true;
  }

  window.setTimeout(() => window.requestAnimationFrame(() => {
    const contentHeight = measureCanvasContentHeight(node.nodeEl);
    if (contentHeight > 0) {
      const current = node.getData();
      const expandedHeight = Math.max(current.height, Math.ceil(contentHeight + CARD_HEIGHT_GUTTER));
      if (expandedHeight > current.height) {
        node.setData({ height: expandedHeight });
        dimensionsChanged = true;
      }
    }

    if (dimensionsChanged) {
      node.canvas.requestSave();
    }
  }), EDITOR_LAYOUT_SETTLE_MS);
}

function measureCanvasContentHeight(nodeElement: HTMLElement): number {
  const editorFrame = nodeElement.querySelector<HTMLIFrameElement>("iframe.embed-iframe");
  const editorContent = editorFrame?.contentDocument?.querySelector<HTMLElement>(".cm-scroller");
  if (editorContent?.scrollHeight) {
    return editorContent.scrollHeight;
  }

  return nodeElement.querySelector<HTMLElement>(".canvas-node-container")?.scrollHeight ?? 0;
}

function measureNaturalContentWidth(nodeElement: HTMLElement): number {
  const clone = nodeElement.cloneNode(true) as HTMLElement;
  clone.style.position = "fixed";
  clone.style.left = "-100000px";
  clone.style.top = "0";
  clone.style.transform = "none";
  clone.style.width = "max-content";
  clone.style.height = "max-content";
  clone.style.setProperty("--canvas-node-width", "max-content");
  clone.style.setProperty("--canvas-node-height", "max-content");

  for (const element of Array.from(clone.querySelectorAll<HTMLElement>(
    ".canvas-node-container, .canvas-node-content, .markdown-preview-view, .markdown-preview-sizer",
  ))) {
    element.style.setProperty("width", "max-content", "important");
    element.style.setProperty("height", "max-content", "important");
    element.style.setProperty("max-width", "none", "important");
    element.style.setProperty("max-height", "none", "important");
    element.style.setProperty("overflow", "visible", "important");
  }

  document.body.append(clone);
  try {
    return clone.querySelector<HTMLElement>(".canvas-node-container")?.scrollWidth ?? 0;
  } finally {
    clone.remove();
  }
}