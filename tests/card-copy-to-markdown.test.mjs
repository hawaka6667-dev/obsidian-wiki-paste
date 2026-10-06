import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import {
  clearCanvasMarkdownCutUnlessConsumed,
  clearRecentCanvasMarkdownCut,
  handleCanvasCut,
  handleCardMarkdownPaste,
} from "../src/card-copy-to-markdown/card-copy-to-markdown.ts";

function createEvent(target, values = {}) {
  let defaultPrevented = false;
  let propagationStopped = false;
  return {
    target,
    clipboardData: { getData: (type) => values[type] ?? "" },
    preventDefault() {
      defaultPrevented = true;
    },
    stopPropagation() {
      propagationStopped = true;
    },
    get defaultPrevented() {
      return defaultPrevented;
    },
    get propagationStopped() {
      return propagationStopped;
    },
  };
}

test("keeps native Canvas cut behavior and pastes a text card as Markdown", () => {
  const dom = new JSDOM("<div class='canvas'><div class='canvas-node'></div></div><div class='editor'><div class='cm-content'></div></div>");
  const canvasContainer = dom.window.document.querySelector(".canvas");
  const editorContainer = dom.window.document.querySelector(".editor");
  const canvasNode = canvasContainer.querySelector(".canvas-node");
  const editorContent = editorContainer.querySelector(".cm-content");
  const replacements = [];
  const markdownView = {
    containerEl: editorContainer,
    editor: { replaceSelection: (text) => replacements.push(text) },
  };
  const canvasView = {
    getViewType: () => "canvas",
    canvas: {
      selection: new Set([{ getData: () => ({ type: "text", text: "# Card\n\nBody" }) }]),
    },
  };

  const cut = createEvent(canvasNode, { "text/plain": "native canvas payload" });
  assert.equal(handleCanvasCut(cut, dom.window.document, canvasView), true);
  assert.equal(cut.defaultPrevented, false);

  const paste = createEvent(editorContent, { "text/plain": "native canvas payload" });
  assert.equal(handleCardMarkdownPaste(paste, markdownView), true);
  assert.deepEqual(replacements, ["# Card\n\nBody"]);
  assert.equal(paste.defaultPrevented, true);
  assert.equal(paste.propagationStopped, true);

  clearRecentCanvasMarkdownCut(dom.window.document);
  dom.window.close();
});

test("leaves multi-card and non-text cuts untouched", () => {
  const dom = new JSDOM("<div class='canvas'><div class='canvas-node'></div></div>");
  const canvasNode = dom.window.document.querySelector(".canvas-node");
  const textNode = { getData: () => ({ type: "text", text: "one" }) };
  const cut = createEvent(canvasNode, { "text/plain": "native canvas payload" });

  assert.equal(handleCanvasCut(cut, dom.window.document, {
    getViewType: () => "canvas",
    canvas: { selection: new Set([textNode, { getData: () => ({ type: "text", text: "two" }) }]) },
  }), false);
  assert.equal(handleCanvasCut(cut, dom.window.document, {
    getViewType: () => "canvas",
    canvas: { selection: new Set([{ getData: () => ({ type: "file", file: "note.md" }) }]) },
  }), false);

  dom.window.close();
});

test("clears a pending card cut after an unrelated paste and ignores handled cuts", () => {
  const dom = new JSDOM("<div class='canvas'><div class='canvas-node'></div></div><div class='editor'><div class='cm-content'></div></div>");
  const canvasNode = dom.window.document.querySelector(".canvas-node");
  const editorContainer = dom.window.document.querySelector(".editor");
  const editorContent = editorContainer.querySelector(".cm-content");
  const markdownView = {
    containerEl: editorContainer,
    editor: { replaceSelection: () => assert.fail("stale card cut was consumed") },
  };
  const canvasView = {
    getViewType: () => "canvas",
    canvas: {
      selection: new Set([{ getData: () => ({ type: "text", text: "stale" }) }]),
    },
  };

  assert.equal(handleCanvasCut(createEvent(canvasNode), dom.window.document, canvasView), true);
  clearCanvasMarkdownCutUnlessConsumed(dom.window.document, false);
  assert.equal(handleCardMarkdownPaste(createEvent(editorContent, { "text/plain": "native" }), markdownView), false);

  const handledCut = createEvent(canvasNode);
  handledCut.preventDefault();
  assert.equal(handleCanvasCut(handledCut, dom.window.document, canvasView), false);
  assert.equal(handleCardMarkdownPaste(createEvent(editorContent, { "text/plain": "native" }), markdownView), false);

  clearRecentCanvasMarkdownCut(dom.window.document);
  dom.window.close();
});
