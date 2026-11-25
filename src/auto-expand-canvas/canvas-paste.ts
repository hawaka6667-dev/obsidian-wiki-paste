// @machine:
// Detects text cards changed by native Canvas paste and expands them to fit rendered content.
// Delegates sizing to the reusable API while leaving Obsidian's paste conversion intact.
import { isCanvasView } from "../shared/editor-target";
import { autoExpandCanvasNode, type CanvasAutoExpandNode } from "./canvas-auto-expand";

export { handleCanvasMarkdownPaste } from "./canvas-markdown-escape";
export { getExpandedCanvasSize } from "./canvas-auto-expand";

const NODE_CONTENT_READY_TIMEOUT_MS = 1000;
const NODE_CONTENT_READY_POLL_MS = 10;

export function handleCanvasPaste(event: ClipboardEvent, view: unknown): boolean {
  if (!isCanvasView(view) || !(view.canvas.nodes instanceof Map)) {
    return false;
  }

  const clipboard = event.clipboardData;
  if (!clipboard?.getData("text/plain") && !clipboard?.getData("text/html")) {
    return false;
  }

  const beforePaste = new Map<string, string | undefined>();
  for (const node of view.canvas.nodes.values()) {
    const data = node.getData?.();
    if (data?.type === "text" && "id" in data) {
      beforePaste.set((data as { id: string }).id, data.text);
    }
  }

  window.requestAnimationFrame(() => {
    if (!(view.canvas.nodes instanceof Map)) {
      return;
    }
    for (const node of view.canvas.nodes.values()) {
      const data = node.getData?.() as { id?: string; type?: string; text?: string } | undefined;
      if (data?.type !== "text" || !data.id || beforePaste.get(data.id) === data.text) {
        continue;
      }
      void expandCanvasNodeWhenReady(node as CanvasAutoExpandNode);
    }
  });

  return true;
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