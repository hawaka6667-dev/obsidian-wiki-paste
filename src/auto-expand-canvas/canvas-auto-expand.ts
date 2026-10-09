// @machine:
// Handles native Canvas paste conversion and detects nodes that need auto-expansion.
// Delegates resizing to the reusable node-level API without replacing Obsidian's paste behavior.
import { consumeRecentInternalMarkdownCopy } from "../escape-markdown-syntax/md-editor-paste-handler";
import { escapeMarkdownSyntax, escapeObsidianSyntax } from "../escape-markdown-syntax/md-syntax-escaping";
import { autoExpandCanvasNode, type CanvasAutoExpandNode } from "./canvas-auto-expand-api";

export { getExpandedCanvasSize } from "./canvas-auto-expand-api";

const NODE_CONTENT_READY_TIMEOUT_MS = 1000;
const NODE_CONTENT_READY_POLL_MS = 10;

interface CanvasView {
  getViewType(): string;
  canvas: { nodes: Map<string, CanvasAutoExpandNode> };
}

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

async function expandCanvasNodeWhenReady(node: CanvasAutoExpandNode): Promise<void> {
  if (await waitForCanvasNodeContent(node)) {
    void autoExpandCanvasNode(node);
  }
}

function waitForCanvasNodeContent(node: CanvasAutoExpandNode): Promise<boolean> {
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

function isCanvasNodeContentReady(node: CanvasAutoExpandNode): boolean {
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