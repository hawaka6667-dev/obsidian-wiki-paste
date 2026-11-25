import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { handleSelectLineThenAllKeydown } from "../src/select-line-then-all/select-line-then-all.ts";

function createKeydownEvent(target, overrides = {}) {
  let defaultPrevented = false;
  let propagationStopped = false;
  return {
    target,
    key: "a",
    ctrlKey: true,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    repeat: false,
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
    ...overrides,
  };
}

function createEditor(lines, initialFrom, initialTo = initialFrom) {
  let from = { ...initialFrom };
  let to = { ...initialTo };
  return {
    getCursor: (side) => (side === "to" ? { ...to } : { ...from }),
    getLine: (line) => lines[line] ?? "",
    setSelection: (anchor, head = anchor) => {
      from = { ...anchor };
      to = { ...head };
    },
    get selection() {
      return { from, to };
    },
  };
}

test("first Ctrl+A selects current line and second Ctrl+A falls through to native select all", () => {
  const dom = new JSDOM("<div class='view'><div class='cm-content'></div></div>");
  const containerEl = dom.window.document.querySelector(".view");
  const cmContent = containerEl.querySelector(".cm-content");
  const editor = createEditor(["first line", "second line"], { line: 1, ch: 3 });
  const markdownView = { containerEl, editor };

  const first = createKeydownEvent(cmContent);
  assert.equal(handleSelectLineThenAllKeydown(first, markdownView), true);
  assert.equal(first.defaultPrevented, true);
  assert.equal(first.propagationStopped, true);
  assert.deepEqual(editor.selection, {
    from: { line: 1, ch: 0 },
    to: { line: 1, ch: "second line".length },
  });

  const second = createKeydownEvent(cmContent);
  assert.equal(handleSelectLineThenAllKeydown(second, markdownView), false);
  assert.equal(second.defaultPrevented, false);

  dom.window.close();
});

test("falls through on empty lines, multiline selections, repeat keydown, and non-editor targets", () => {
  const dom = new JSDOM("<div class='view'><div class='cm-content'></div><input /></div>");
  const containerEl = dom.window.document.querySelector(".view");
  const cmContent = containerEl.querySelector(".cm-content");
  const input = containerEl.querySelector("input");

  const emptyLineEditor = createEditor(["", "body"], { line: 0, ch: 0 });
  assert.equal(handleSelectLineThenAllKeydown(createKeydownEvent(cmContent), { containerEl, editor: emptyLineEditor }), false);

  const multiLineEditor = createEditor(["a", "b"], { line: 0, ch: 0 }, { line: 1, ch: 1 });
  assert.equal(handleSelectLineThenAllKeydown(createKeydownEvent(cmContent), { containerEl, editor: multiLineEditor }), false);

  const nonEmptyEditor = createEditor(["abc"], { line: 0, ch: 1 });
  assert.equal(handleSelectLineThenAllKeydown(createKeydownEvent(cmContent, { repeat: true }), { containerEl, editor: nonEmptyEditor }), false);
  assert.equal(handleSelectLineThenAllKeydown(createKeydownEvent(input), { containerEl, editor: nonEmptyEditor }), false);

  dom.window.close();
});

test("works inside an active Canvas text card editor", () => {
  const dom = new JSDOM("<div class='canvas'><div class='canvas-node'><div class='cm-content'></div></div></div>");
  const canvasEl = dom.window.document.querySelector(".canvas");
  const nodeEl = dom.window.document.querySelector(".canvas-node");
  const cmContent = nodeEl.querySelector(".cm-content");
  const editor = createEditor(["card line"], { line: 0, ch: 4 });
  const canvasNode = { nodeEl, child: { editor } };
  const canvasView = {
    getViewType: () => "canvas",
    containerEl: canvasEl,
    canvas: { nodes: new Map([["card", canvasNode]]) },
  };

  const first = createKeydownEvent(cmContent);
  assert.equal(handleSelectLineThenAllKeydown(first, null, canvasView), true);
  assert.deepEqual(editor.selection, {
    from: { line: 0, ch: 0 },
    to: { line: 0, ch: "card line".length },
  });

  const second = createKeydownEvent(cmContent);
  assert.equal(handleSelectLineThenAllKeydown(second, null, canvasView), false);

  dom.window.close();
});
