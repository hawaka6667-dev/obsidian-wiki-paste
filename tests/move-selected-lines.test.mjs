import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { handleMoveSelectedLinesKeydown } from "../src/move-selected-lines/move-selected-lines.ts";

function createKeydownEvent(target, key, overrides = {}) {
  let defaultPrevented = false;
  let propagationStopped = false;
  return {
    target,
    key,
    altKey: true,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
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

function createEditor(initialLines, anchorPos, headPos = anchorPos) {
  const lines = [...initialLines];
  let anchor = { ...anchorPos };
  let head = { ...headPos };

  const ordered = () => {
    if (anchor.line < head.line || (anchor.line === head.line && anchor.ch <= head.ch)) {
      return { from: anchor, to: head };
    }
    return { from: head, to: anchor };
  };

  return {
    getCursor: (side) => {
      if (side === "anchor") {
        return { ...anchor };
      }
      if (side === "head") {
        return { ...head };
      }
      const { from, to } = ordered();
      return side === "to" ? { ...to } : { ...from };
    },
    getLine: (line) => lines[line] ?? "",
    lineCount: () => lines.length,
    replaceRange: (replacement, from, to) => {
      const prefix = lines[from.line].slice(0, from.ch);
      const suffix = lines[to.line].slice(to.ch);
      const inserted = `${prefix}${replacement}${suffix}`.split("\n");
      lines.splice(from.line, to.line - from.line + 1, ...inserted);
    },
    setSelection: (nextAnchor, nextHead = nextAnchor) => {
      anchor = { ...nextAnchor };
      head = { ...nextHead };
    },
    get lines() {
      return [...lines];
    },
    get selection() {
      return { anchor, head };
    },
  };
}

test("moves a single line up and down while preserving cursor column", () => {
  const dom = new JSDOM("<div class='view'><div class='cm-content'></div></div>");
  const containerEl = dom.window.document.querySelector(".view");
  const cmContent = containerEl.querySelector(".cm-content");
  const editor = createEditor(["alpha", "beta", "gamma"], { line: 1, ch: 2 });
  const view = { containerEl, editor };

  const moveUp = createKeydownEvent(cmContent, "ArrowUp");
  assert.equal(handleMoveSelectedLinesKeydown(moveUp, view), true);
  assert.equal(moveUp.defaultPrevented, true);
  assert.deepEqual(editor.lines, ["beta", "alpha", "gamma"]);
  assert.deepEqual(editor.selection, { anchor: { line: 0, ch: 2 }, head: { line: 0, ch: 2 } });

  const moveDown = createKeydownEvent(cmContent, "ArrowDown");
  assert.equal(handleMoveSelectedLinesKeydown(moveDown, view), true);
  assert.deepEqual(editor.lines, ["alpha", "beta", "gamma"]);
  assert.deepEqual(editor.selection, { anchor: { line: 1, ch: 2 }, head: { line: 1, ch: 2 } });

  dom.window.close();
});

test("moves a multi-line backward selection and ignores trailing ch=0 line", () => {
  const dom = new JSDOM("<div class='view'><div class='cm-content'></div></div>");
  const containerEl = dom.window.document.querySelector(".view");
  const cmContent = containerEl.querySelector(".cm-content");
  const editor = createEditor(["zero", "one", "two", "three"], { line: 2, ch: 3 }, { line: 1, ch: 1 });
  const view = { containerEl, editor };

  assert.equal(handleMoveSelectedLinesKeydown(createKeydownEvent(cmContent, "ArrowDown"), view), true);
  assert.deepEqual(editor.lines, ["zero", "three", "one", "two"]);
  assert.deepEqual(editor.selection, { anchor: { line: 3, ch: 3 }, head: { line: 2, ch: 1 } });

  const chZeroEditor = createEditor(["zero", "one", "two", "three"], { line: 0, ch: 0 }, { line: 2, ch: 0 });
  assert.equal(handleMoveSelectedLinesKeydown(createKeydownEvent(cmContent, "ArrowDown"), { containerEl, editor: chZeroEditor }), true);
  assert.deepEqual(chZeroEditor.lines, ["two", "zero", "one", "three"]);
  assert.deepEqual(chZeroEditor.selection, { anchor: { line: 1, ch: 0 }, head: { line: 3, ch: 0 } });

  dom.window.close();
});

test("handles document boundaries and active Canvas card editors", () => {
  const dom = new JSDOM("<div class='canvas'><div class='canvas-node'><div class='cm-content'></div></div></div>");
  const canvasEl = dom.window.document.querySelector(".canvas");
  const nodeEl = dom.window.document.querySelector(".canvas-node");
  const cmContent = nodeEl.querySelector(".cm-content");
  const editor = createEditor(["top", "bottom"], { line: 0, ch: 1 });
  const canvasView = {
    getViewType: () => "canvas",
    containerEl: canvasEl,
    canvas: { nodes: new Map([["card", { nodeEl, child: { editor } }]]) },
  };

  const atTop = createKeydownEvent(cmContent, "ArrowUp");
  assert.equal(handleMoveSelectedLinesKeydown(atTop, null, canvasView), true);
  assert.equal(atTop.defaultPrevented, true);
  assert.deepEqual(editor.lines, ["top", "bottom"]);

  assert.equal(handleMoveSelectedLinesKeydown(createKeydownEvent(cmContent, "ArrowDown"), null, canvasView), true);
  assert.deepEqual(editor.lines, ["bottom", "top"]);
  assert.deepEqual(editor.selection, { anchor: { line: 1, ch: 1 }, head: { line: 1, ch: 1 } });

  dom.window.close();
});
