import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { getExpandedCanvasSize, handleCanvasMarkdownPaste, handleCanvasPaste } from "../src/auto-expand-canvas/canvas-auto-expand.ts";
import { clearRecentInternalMarkdownCopy, handleObsidianCopy } from "../src/escape-markdown-syntax/md-editor-paste-handler.ts";

function createNode(data, document) {
  const nodeEl = document.createElement("div");
  nodeEl.className = "canvas-node";
  const content = nodeEl.appendChild(nodeEl.ownerDocument.createElement("div"));
  content.className = "canvas-node-container";
  content.dataset.scrollWidth = "531";
  content.dataset.scrollHeight = "79";
  const node = {
    nodeEl,
    data,
    initialized: true,
    isContentMounted: true,
    saves: 0,
    getData() {
      return this.data;
    },
    setData(patch) {
      Object.assign(this.data, patch);
    },
  };
  node.canvas = { requestSave: () => { node.saves += 1; } };
  document.body.append(nodeEl);
  return node;
}

test("Canvas sizing grows to fit content and preserves larger dimensions", () => {
  assert.deepEqual(getExpandedCanvasSize(250, 60, 531, 79), { width: 563, height: 81 });
  assert.deepEqual(getExpandedCanvasSize(808, 280, 762, 238), { width: 808, height: 280 });
  assert.deepEqual(getExpandedCanvasSize(250, 60, 1500, 79), { width: 980, height: 81 });
  assert.deepEqual(getExpandedCanvasSize(1000, 60, 1500, 79), { width: 1000, height: 81 });
});

test("native Canvas paste expands only new or changed text cards", async () => {
  const dom = new JSDOM();
  const frames = [];
  const timers = [];
  globalThis.document = dom.window.document;
  globalThis.window = dom.window;
  dom.window.requestAnimationFrame = (callback) => frames.push(callback);
  dom.window.setTimeout = (callback) => timers.push(callback);
  Object.defineProperty(dom.window.HTMLElement.prototype, "scrollWidth", {
    configurable: true,
    get() {
      return Number(this.dataset.scrollWidth ?? 0);
    },
  });
  Object.defineProperty(dom.window.HTMLElement.prototype, "scrollHeight", {
    configurable: true,
    get() {
      return Number(this.dataset.scrollHeight ?? 0);
    },
  });
  Object.defineProperty(dom.window.HTMLElement.prototype, "getClientRects", {
    configurable: true,
    value() {
      return this.isConnected ? [{}] : [];
    },
  });

  const existing = createNode({ id: "existing", type: "text", text: "before", width: 250, height: 60 }, dom.window.document);
  const unchanged = createNode({ id: "unchanged", type: "text", text: "same", width: 300, height: 100 }, dom.window.document);
  const editorScroller = dom.window.document.createElement("div");
  editorScroller.className = "cm-scroller";
  editorScroller.style.height = "48px";
  Object.defineProperty(editorScroller, "scrollHeight", {
    get() {
      return editorScroller.classList.contains("wiki-paste-measure-height") ? 142 : 48;
    },
  });
  existing.nodeEl.querySelector(".canvas-node-container").append(editorScroller);
  const added = createNode({ id: "added", type: "text", text: "pasted", width: 250, height: 60 }, dom.window.document);
  const preview = dom.window.document.createElement("div");
  preview.className = "markdown-preview-view markdown-rendered";
  preview.style.height = "534px";
  const markdownSizer = dom.window.document.createElement("div");
  markdownSizer.className = "markdown-preview-sizer";
  markdownSizer.style.minHeight = "534px";
  preview.append(markdownSizer);
  Object.defineProperty(preview, "scrollHeight", {
    get() {
      return preview.classList.contains("wiki-paste-measure-height")
        && markdownSizer.classList.contains("wiki-paste-measure-min-height") ? 631 : 534;
    },
  });
  added.nodeEl.querySelector(".canvas-node-container").append(preview);
  const canvas = { nodes: new Map([["existing", existing], ["unchanged", unchanged]]) };
  const view = { getViewType: () => "canvas", canvas };
  const event = { clipboardData: { getData: (type) => type === "text/plain" ? "after" : "" } };

  assert.equal(handleCanvasPaste(event, view), true);
  assert.equal(frames.length, 1);

  existing.data.text = "after";
  canvas.nodes.set("added", added);
  frames.shift()();
  frames.shift()();
  frames.shift()();
  await Promise.resolve();
  assert.deepEqual({ width: existing.data.width, height: existing.data.height }, { width: 563, height: 60 });
  assert.deepEqual({ width: added.data.width, height: added.data.height }, { width: 563, height: 60 });
  assert.deepEqual({ width: unchanged.data.width, height: unchanged.data.height }, { width: 300, height: 100 });

  timers.shift()();
  timers.shift()();
  frames.shift()();
  frames.shift()();
  await Promise.resolve();
  assert.deepEqual({ width: existing.data.width, height: existing.data.height }, { width: 563, height: 144 });
  assert.deepEqual({ width: added.data.width, height: added.data.height }, { width: 563, height: 633 });
  assert.equal(editorScroller.style.height, "48px");
  assert.equal(preview.style.height, "534px");
  assert.equal(markdownSizer.style.height, "");
  assert.equal(markdownSizer.style.minHeight, "534px");
  assert.equal(existing.saves, 1);
  assert.equal(added.saves, 1);
  delete globalThis.document;
  delete globalThis.window;
  dom.window.close();
});

test("Canvas escapes external Markdown paste but preserves Obsidian-internal copies", async () => {
  const dom = new JSDOM("<div class='canvas'></div>");
  const frames = [];
  const timers = [];
  globalThis.document = dom.window.document;
  globalThis.window = dom.window;
  dom.window.requestAnimationFrame = (callback) => frames.push(callback);
  dom.window.setTimeout = (callback) => timers.push(callback);
  Object.defineProperty(dom.window.HTMLElement.prototype, "scrollWidth", {
    configurable: true,
    get() {
      return Number(this.dataset.scrollWidth ?? 0);
    },
  });
  Object.defineProperty(dom.window.HTMLElement.prototype, "getClientRects", {
    configurable: true,
    value() {
      return this.isConnected ? [{}] : [];
    },
  });

  const canvas = { nodes: new Map() };
  const view = { getViewType: () => "canvas", canvas };
  const node = createNode({ id: "pasted", type: "text", text: "before", width: 250, height: 60 }, dom.window.document);
  const copiedText = "[^ref29]: Footnote source.";
  const externalPaste = { clipboardData: { getData: (type) => type === "text/plain" ? copiedText : "" } };

  assert.equal(handleCanvasMarkdownPaste(externalPaste, view), true);
  assert.equal(handleCanvasPaste(externalPaste, view), true);
  canvas.nodes.set("pasted", node);
  node.data.text = copiedText;
  frames.shift()();
  assert.equal(node.data.text, String.raw`\[^ref29]: Footnote source.`);
  frames.shift()();
  frames.shift()();
  await Promise.resolve();
  assert.equal(node.data.width, 563);

  const richText = "[^ref30]: Rich source.";
  const richPaste = {
    clipboardData: {
      getData: (type) => type === "text/plain" ? richText : type === "text/html" ? `<p>${richText}</p>` : "",
    },
  };
  assert.equal(handleCanvasMarkdownPaste(richPaste, view), true);
  const richNode = createNode({ id: "rich", type: "text", text: "before", width: 250, height: 60 }, dom.window.document);
  canvas.nodes.set("rich", richNode);
  richNode.data.text = richText;
  frames.shift()();
  assert.equal(richNode.data.text, String.raw`\[^ref30]: Rich source.`);

  handleObsidianCopy({
    target: dom.window.document.querySelector(".canvas"),
    clipboardData: { getData: (type) => type === "text/plain" ? copiedText : "" },
  }, dom.window.document);
  const internalPaste = { clipboardData: { getData: (type) => type === "text/plain" ? copiedText : "" } };
  assert.equal(handleCanvasMarkdownPaste(internalPaste, view), true);
  const internalNode = createNode({ id: "internal", type: "text", text: "before", width: 250, height: 60 }, dom.window.document);
  canvas.nodes.set("internal", internalNode);
  internalNode.data.text = copiedText;
  frames.shift()();
  assert.equal(internalNode.data.text, copiedText);

  clearRecentInternalMarkdownCopy(dom.window.document);
  delete globalThis.document;
  delete globalThis.window;
  dom.window.close();
});

test("Canvas paste waits for rendered content before measuring card width", async () => {
  const dom = new JSDOM();
  const frames = [];
  const timers = [];
  globalThis.document = dom.window.document;
  globalThis.window = dom.window;
  dom.window.requestAnimationFrame = (callback) => frames.push(callback);
  dom.window.setTimeout = (callback) => timers.push(callback);
  Object.defineProperty(dom.window.HTMLElement.prototype, "scrollWidth", {
    configurable: true,
    get() {
      return Number(this.dataset.scrollWidth ?? 0);
    },
  });
  Object.defineProperty(dom.window.HTMLElement.prototype, "getClientRects", {
    configurable: true,
    value() {
      return this.isConnected ? [{}] : [];
    },
  });

  const node = createNode({ id: "late", type: "text", text: "before", width: 250, height: 60 }, dom.window.document);
  node.initialized = false;
  node.isContentMounted = false;
  node.nodeEl.querySelector(".canvas-node-container").dataset.scrollWidth = "0";
  const canvas = { nodes: new Map() };
  const view = { getViewType: () => "canvas", canvas };
  const event = { clipboardData: { getData: (type) => type === "text/plain" ? "pasted" : "" } };

  assert.equal(handleCanvasPaste(event, view), true);
  node.data.text = "pasted";
  canvas.nodes.set("late", node);
  frames.shift()();
  assert.equal(node.data.width, 250);

  node.initialized = true;
  node.isContentMounted = true;
  node.nodeEl.querySelector(".canvas-node-container").dataset.scrollWidth = "531";
  timers.shift()();
  frames.shift()();
  await Promise.resolve();
  assert.equal(node.data.width, 563);

  delete globalThis.document;
  delete globalThis.window;
  dom.window.close();
});