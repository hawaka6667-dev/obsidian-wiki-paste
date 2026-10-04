// @machine:
// Detects text cards changed by a native Canvas paste and grows them to fit rendered content.
// Uses Canvas node data for persisted dimensions while leaving Obsidian's paste conversion intact.
import { consumeRecentInternalMarkdownCopy } from "../escape-markdown-syntax/md-editor-paste-handler";
import { escapeMarkdownSyntax, escapeObsidianSyntax } from "../escape-markdown-syntax/md-syntax-escaping";

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
  initialized?: boolean;
  isContentMounted?: boolean;
  getData(): CanvasNodeData;
  setData(data: Partial<CanvasNodeData>): void;
}

interface CanvasView {
  getViewType(): string;
  canvas: { nodes: Map<string, CanvasNode> };
}

const CARD_WIDTH_GUTTER = 32;
const FULL_EXPAND_MAX_WIDTH = 980;
const CARD_HEIGHT_GUTTER = 2;
const EDITOR_LAYOUT_SETTLE_MS = 50;
const NODE_CONTENT_READY_TIMEOUT_MS = 1000;
const NODE_CONTENT_READY_POLL_MS = 10;

export function handleCanvasMarkdownPaste(event: ClipboardEvent, view: unknown): boolean {
  if (!isCanvasView(view)) {
    return false;
  }

  const clipboard = event.clipboardData;
  const clipboardText = clipboard?.getData("text/plain");
  const clipboardHtml = clipboard?.getData("text/html");
  if (!clipboardText && !clipboardHtml) {
    return false;
  }

  const isInternalCopy = consumeRecentInternalMarkdownCopy(document, clipboardText);
  const escapeText = clipboardHtml ? escapeObsidianSyntax : escapeMarkdownSyntax;
  const beforePaste = new Map<string, string | undefined>();
  for (const node of view.canvas.nodes.values()) {
    const data = node.getData();
    if (data.type === "text") {
      beforePaste.set(data.id, data.text);
    }
  }

  window.requestAnimationFrame(() => {
    if (isInternalCopy) {
      return;
    }

    for (const node of view.canvas.nodes.values()) {
      const data = node.getData();
      if (data.type !== "text" || beforePaste.get(data.id) === data.text || typeof data.text !== "string") {
        continue;
      }

      const escapedText = escapeText(data.text);
      if (escapedText !== data.text) {
        node.setData({ text: escapedText });
      }
    }
  });

  return true;
}

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
      void expandCanvasNodeWhenReady(node);
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

async function expandCanvasNodeWhenReady(node: CanvasNode): Promise<void> {
  if (await waitForCanvasNodeContent(node)) {
    expandCanvasNode(node);
  }
}

function waitForCanvasNodeContent(node: CanvasNode): Promise<boolean> {
  return new Promise((resolve) => {
    const startedAt = performance.now();
    let settled = false;
    let timeoutId: number | undefined;

    const finish = (ready: boolean) => {
      if (settled) {
        return;
      }
      settled = true;
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
      resolve(ready);
    };

    const check = () => {
      if (isCanvasNodeContentReady(node)) {
        window.requestAnimationFrame(() => {
          if (isCanvasNodeContentReady(node)) {
            finish(true);
          } else {
            scheduleCheck();
          }
        });
        return;
      }

      scheduleCheck();
    };

    const scheduleCheck = () => {
      if (performance.now() - startedAt >= NODE_CONTENT_READY_TIMEOUT_MS) {
        finish(false);
        return;
      }
      timeoutId = window.setTimeout(check, NODE_CONTENT_READY_POLL_MS);
    };

    check();
  });
}

function isCanvasNodeContentReady(node: CanvasNode): boolean {
  if (!node.nodeEl.isConnected || node.initialized === false || node.isContentMounted === false) {
    return false;
  }

  const contentElement = getCanvasNodeContentElement(node.nodeEl)
    ?? (node.isContentMounted === true
      ? node.nodeEl.querySelector<HTMLElement>(".canvas-node-container")
      : null);
  return node.nodeEl.getClientRects().length > 0
    && Boolean(contentElement && contentElement.getClientRects().length > 0);
}

function getCanvasNodeContentElement(nodeElement: HTMLElement): HTMLElement | null {
  const content = nodeElement.querySelector<HTMLElement>(
    ".cm-scroller, .markdown-preview-view.markdown-rendered",
  );
  if (content) {
    return content;
  }

  const editorFrame = nodeElement.querySelector<HTMLIFrameElement>("iframe.embed-iframe");
  return editorFrame?.contentDocument?.querySelector<HTMLElement>(".cm-scroller") ?? null;
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