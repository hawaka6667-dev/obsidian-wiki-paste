import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { getExpandedCanvasSize } from "../src/auto-expand-canvas/canvas-paste.ts";
import { handleCanvasMarkdownPaste } from "../src/auto-expand-canvas/canvas-markdown-escape.ts";
import { clearRecentInternalMarkdownCopy, handleObsidianCopy } from "../src/escape-markdown-syntax/md-editor-paste-handler.ts";

test("getExpandedCanvasSize grows to fit content within max width and preserves larger bounds", () => {
  assert.deepEqual(getExpandedCanvasSize(250, 60, 531, 79), { width: 563, height: 81 });
  assert.deepEqual(getExpandedCanvasSize(808, 280, 762, 238), { width: 808, height: 280 });
  assert.deepEqual(getExpandedCanvasSize(250, 60, 1500, 79), { width: 980, height: 81 });
  assert.deepEqual(getExpandedCanvasSize(1000, 60, 1500, 79), { width: 1000, height: 81 });
});

test("handleCanvasMarkdownPaste converts AI LaTeX, escapes external paste when enabled, and preserves internal copies", () => {
  const dom = new JSDOM("<div class='canvas'></div>");
  const containerEl = dom.window.document.querySelector(".canvas");
  let rafCallback = null;
  globalThis.window = { requestAnimationFrame: (cb) => { rafCallback = cb; } };

  const nodeData = { id: "n1", type: "text", text: "before" };
  const node = {
    getData: () => nodeData,
    setData: (patch) => Object.assign(nodeData, patch),
  };
  const view = { getViewType: () => "canvas", containerEl, canvas: { nodes: new Map([["n1", node]]) } };

  // External AI LaTeX with escaping off
  const latexPaste = { clipboardData: { getData: (t) => t === "text/plain" ? "\\( x^2 \\)" : "" } };
  assert.equal(handleCanvasMarkdownPaste(latexPaste, view, { escapeMarkdownSyntax: false, convertLatexOnPaste: true }), true);
  nodeData.text = "\\( x^2 \\)";
  rafCallback();
  assert.equal(nodeData.text, "$x^2$");

  // Internal Obsidian copy is untouched
  const copiedText = "[^ref29]: Footnote source.";
  handleObsidianCopy({ target: containerEl, clipboardData: { getData: () => copiedText } }, dom.window.document);
  const internalPaste = { clipboardData: { getData: (t) => t === "text/plain" ? copiedText : "" } };
  assert.equal(handleCanvasMarkdownPaste(internalPaste, view, { escapeMarkdownSyntax: true, convertLatexOnPaste: true }), true);
  nodeData.text = copiedText;
  rafCallback();
  assert.equal(nodeData.text, copiedText);

  clearRecentInternalMarkdownCopy(dom.window.document);
  delete globalThis.window;
  dom.window.close();
});
