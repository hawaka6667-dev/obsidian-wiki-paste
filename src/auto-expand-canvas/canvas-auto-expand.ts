// @machine:
// Provides the reusable node-level Canvas auto-expansion API.
// Measures the supplied node's current content, updates dimensions, and persists changes.

export interface CanvasAutoExpandNodeData {
  id: string;
  type: string;
  text?: string;
  width: number;
  height: number;
}

export interface CanvasAutoExpandNode {
  canvas: { requestSave(): void };
  nodeEl: HTMLElement;
  initialized?: boolean;
  isContentMounted?: boolean;
  getData(): CanvasAutoExpandNodeData;
  setData(data: Partial<CanvasAutoExpandNodeData>): void;
}

const CARD_WIDTH_GUTTER = 32;
const FULL_EXPAND_MAX_WIDTH = 980;
const CARD_HEIGHT_GUTTER = 2;
const EDITOR_LAYOUT_SETTLE_MS = 50;

export function getExpandedCanvasSize(
  width: number,
  height: number,
  contentWidth: number,
  contentHeight: number,
): { width: number; height: number } {
  return {
    width: Math.max(width, Math.min(FULL_EXPAND_MAX_WIDTH, Math.ceil(contentWidth + CARD_WIDTH_GUTTER))),
    height: Math.max(height, Math.ceil(contentHeight + CARD_HEIGHT_GUTTER)),
  };
}

export async function autoExpandCanvasNode(node: CanvasAutoExpandNode): Promise<void> {
  if (!node.nodeEl.isConnected) {
    return;
  }

  await expandCanvasNode(node);
}

async function expandCanvasNode(node: CanvasAutoExpandNode): Promise<void> {
  const data = node.getData();
  const contentWidth = measureNaturalContentWidth(node.nodeEl);
  const expandedWidth = getExpandedCanvasSize(data.width, data.height, contentWidth, 0).width;
  let dimensionsChanged = false;
  if (expandedWidth > data.width) {
    node.setData({ width: expandedWidth });
    dimensionsChanged = true;
  }

  await new Promise<void>((resolve) => {
    window.setTimeout(() => window.requestAnimationFrame(() => resolve()), EDITOR_LAYOUT_SETTLE_MS);
  });

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
}

function measureCanvasContentHeight(nodeElement: HTMLElement): number {
  const directEditorContent = nodeElement.querySelector<HTMLElement>(".cm-scroller");
  if (directEditorContent?.scrollHeight) {
    return measureNaturalContentHeight(directEditorContent, "scrollHeight");
  }

  const editorFrame = nodeElement.querySelector<HTMLIFrameElement>("iframe.embed-iframe");
  const editorContent = editorFrame?.contentDocument?.querySelector<HTMLElement>(".cm-scroller");
  if (editorContent?.scrollHeight) {
    return measureNaturalContentHeight(editorContent, "scrollHeight");
  }

  const renderedMarkdown = nodeElement.querySelector<HTMLElement>(".markdown-preview-view.markdown-rendered");
  if (renderedMarkdown) {
    return measureNaturalContentHeight(renderedMarkdown, "scrollHeight");
  }

  return nodeElement.querySelector<HTMLElement>(".canvas-node-container")?.scrollHeight ?? 0;
}

function measureNaturalContentHeight(element: HTMLElement, dimension: "clientHeight" | "scrollHeight"): number {
  const measuredElements = [
    element,
    ...Array.from(element.querySelectorAll<HTMLElement>(".markdown-preview-sizer")),
  ];
  const previousClasses = measuredElements.map((measuredElement) => ({
    element: measuredElement,
    hadHeightClass: measuredElement.classList.contains("wiki-paste-measure-height"),
    hadMinHeightClass: measuredElement.classList.contains("wiki-paste-measure-min-height"),
  }));

  measuredElements.forEach((measuredElement) => measuredElement.classList.add("wiki-paste-measure-height"));
  for (const measuredElement of measuredElements.slice(1)) {
    measuredElement.classList.add("wiki-paste-measure-min-height");
  }

  try {
    return element[dimension];
  } finally {
    for (const previousClass of previousClasses) {
      if (!previousClass.hadHeightClass) {
        previousClass.element.classList.remove("wiki-paste-measure-height");
      }
      if (!previousClass.hadMinHeightClass) {
        previousClass.element.classList.remove("wiki-paste-measure-min-height");
      }
    }
  }
}

function measureNaturalContentWidth(nodeElement: HTMLElement): number {
  const clone = nodeElement.cloneNode(true) as HTMLElement;
  clone.classList.add("wiki-paste-measure-width");

  for (const element of Array.from(clone.querySelectorAll<HTMLElement>(
    ".canvas-node-container, .canvas-node-content, .markdown-preview-view, .markdown-preview-sizer, .cm-scroller",
  ))) {
    element.classList.add("wiki-paste-measure-width-content");
  }

  document.body.append(clone);
  try {
    return clone.querySelector<HTMLElement>(".canvas-node-container")?.scrollWidth ?? 0;
  } finally {
    clone.remove();
  }
}