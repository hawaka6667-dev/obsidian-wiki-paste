// @machine:
// Applies Markdown escaping to text nodes changed by native Canvas paste.
// Preserves Obsidian's Canvas conversion and skips known internal Markdown copies.
import { consumeRecentInternalMarkdownCopy } from "../escape-markdown-syntax/md-editor-paste-handler";
import { escapeMarkdownSyntax, escapeObsidianSyntax } from "../escape-markdown-syntax/md-syntax-escaping";
import type { CanvasAutoExpandNode } from "./canvas-auto-expand";

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

function isCanvasView(view: unknown): view is CanvasView {
  if (!view || typeof view !== "object") {
    return false;
  }

  const candidate = view as Partial<CanvasView>;
  return candidate.getViewType?.() === "canvas" && candidate.canvas?.nodes instanceof Map;
}