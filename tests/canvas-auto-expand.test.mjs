import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { getExpandedCanvasSize, handleCanvasPaste } from "../src/auto-expand-canvas/canvas-auto-expand.ts";

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
    saves: 0,
    getData() {
      return this.data;
    },
    setData(patch) {
      Object.assign(this.data, patch);
    },
  };
  node.canvas = { requestSave: () => { node.saves += 1; } };
  return node;
}

test("Canvas sizing grows to fit content and preserves larger dimensions", () => {
  assert.deepEqual(getExpandedCanvasSize(250, 60, 531, 79), { width: 563, height: 81 });
  assert.deepEqual(getExpandedCanvasSize(808, 280, 762, 238), { width: 808, height: 280 });
});

test("native Canvas paste expands only new or changed text cards", () => {
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

  const existing = createNode({ id: "existing", type: "text", text: "before", width: 250, height: 60 }, dom.window.document);
  const unchanged = createNode({ id: "unchanged", type: "text", text: "same", width: 300, height: 100 }, dom.window.document);
  const canvas = { nodes: new Map([["existing", existing], ["unchanged", unchanged]]) };
  const view = { getViewType: () => "canvas", canvas };
  const event = { clipboardData: { getData: (type) => type === "text/plain" ? "after" : "" } };

  assert.equal(handleCanvasPaste(event, view), true);
  assert.equal(frames.length, 1);

  existing.data.text = "after";
  const added = createNode({ id: "added", type: "text", text: "pasted", width: 250, height: 60 }, dom.window.document);
  canvas.nodes.set("added", added);
  frames.shift()();
  assert.deepEqual({ width: existing.data.width, height: existing.data.height }, { width: 563, height: 60 });
  assert.deepEqual({ width: added.data.width, height: added.data.height }, { width: 563, height: 60 });
  assert.deepEqual({ width: unchanged.data.width, height: unchanged.data.height }, { width: 300, height: 100 });

  timers.shift()();
  timers.shift()();
  frames.shift()();
  frames.shift()();
  assert.deepEqual({ width: existing.data.width, height: existing.data.height }, { width: 563, height: 81 });
  assert.deepEqual({ width: added.data.width, height: added.data.height }, { width: 563, height: 81 });
  assert.equal(existing.saves, 1);
  assert.equal(added.saves, 1);
  delete globalThis.document;
  delete globalThis.window;
  dom.window.close();
});